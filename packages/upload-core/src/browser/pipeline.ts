import type { ExifSummary, GeoRegion, ImageMetadata } from "@luminafe/contracts";

export interface ProcessingStagePatch {
  status?: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
  started_at?: number;
  completed_at?: number;
  duration_ms?: number;
}

export interface ProcessingTaskMetric {
  task_id: string;
  status: "completed" | "failed" | "skipped";
  duration_ms: number;
  degraded?: boolean;
}

export interface BrowserUploadItem {
  file: File;
  liveVideoFile?: File;
  uploadMode: "static" | "live_photo";
}

export interface BrowserThumbnailResult {
  blob: Blob;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

export interface BrowserUploadDeps {
  computeSHA256: (file: File | Blob) => Promise<string>;
  createThumbnail: (file: File | Blob, options: { maxThumbSize: number; thumbQuality: number }) => Promise<BrowserThumbnailResult>;
  extractExif: (file: File | Blob) => Promise<{
    exif: ExifSummary | null;
    privacy: { original_contains_gps: boolean; exif_gps_removed: boolean };
  }>;
  performOcr: (
    file: File | Blob,
    options: { lang: string },
    onProgress?: (progress: { status: string; progress: number }) => void
  ) => Promise<ImageMetadata["derived"]["ocr"]>;
  computePHash: (file: File | Blob) => Promise<ImageMetadata["derived"]["phash"]>;
  extractDominantColor: (canvas: HTMLCanvasElement) => ImageMetadata["derived"]["dominant_color"];
  detectBlur: (canvas: HTMLCanvasElement, sampleSize: number, threshold: number) => ImageMetadata["derived"]["blur"];
  resolveRegion: (exif: ExifSummary | null) => Promise<GeoRegion | undefined>;
}

export interface ParseBrowserUploadOptions {
  item: BrowserUploadItem;
  deps: BrowserUploadDeps;
  updateItem: (updates: {
    metadata?: ImageMetadata;
    thumbnail?: string;
    processingSummary?: NonNullable<ImageMetadata["processing"]>["summary"];
    taskMetrics?: ProcessingTaskMetric[];
    editDraft?: { description?: string; original_filename?: string; category?: string };
  }) => void;
  updateStage: (stageId: string, updates: ProcessingStagePatch) => void;
  config?: {
    maxThumbSize?: number;
    thumbQuality?: number;
    ocrLang?: string;
    blurThreshold?: number;
  };
}

export interface ParsedBrowserUploadResult {
  metadata: ImageMetadata;
  thumbBlob: Blob;
  thumbnailUrl: string;
  processingSummary?: NonNullable<ImageMetadata["processing"]>["summary"];
  taskMetrics: ProcessingTaskMetric[];
}

interface StageTimer {
  stageId: string;
  startedAt: number;
}

const now = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const getHardwareConcurrency = (): number => {
  if (typeof navigator === "undefined" || !navigator.hardwareConcurrency) {
    return 4;
  }
  return navigator.hardwareConcurrency;
};

const getOcrConcurrency = (): number => {
  const hardware = getHardwareConcurrency();
  return Math.min(2, Math.max(1, Math.floor(hardware / 4)));
};

let activeOcrJobs = 0;
const ocrWaiters: Array<() => void> = [];

const withOcrSemaphore = async <T>(task: () => Promise<T>): Promise<T> => {
  const maxConcurrency = getOcrConcurrency();
  if (activeOcrJobs >= maxConcurrency) {
    await new Promise<void>((resolve) => {
      ocrWaiters.push(resolve);
    });
  }

  activeOcrJobs += 1;
  try {
    return await task();
  } finally {
    activeOcrJobs = Math.max(0, activeOcrJobs - 1);
    const waiter = ocrWaiters.shift();
    waiter?.();
  }
};

const resolveImageDimensions = async (imageSrc: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.src = imageSrc;
  });
};

const cloneExif = (exif: ExifSummary | null): ExifSummary | undefined => {
  if (!exif) return undefined;
  return { ...exif };
};

const sanitizeExifGps = (exif: ExifSummary | undefined): ExifSummary | undefined => {
  if (!exif) return undefined;
  const next = { ...exif };
  delete next.GPSLatitude;
  delete next.GPSLongitude;
  return next;
};

export async function parseUploadItemInBrowser({
  item,
  deps,
  updateItem,
  updateStage,
  config,
}: ParseBrowserUploadOptions): Promise<ParsedBrowserUploadResult> {
  const file = item.file;
  const pipelineStart = now();
  const stageTimers = new Map<string, StageTimer>();
  const stageDurations = new Map<string, number>();
  const taskMetrics: ProcessingTaskMetric[] = [];

  const maxThumbSize = config?.maxThumbSize ?? 1024;
  const thumbQuality = config?.thumbQuality ?? 0.85;
  const ocrLang = config?.ocrLang ?? "eng+chi_sim";
  const blurThreshold = config?.blurThreshold ?? 100;

  const markStageProcessing = (stageId: string): void => {
    const startedAt = now();
    stageTimers.set(stageId, { stageId, startedAt });
    updateStage(stageId, { status: "processing", progress: 0, started_at: Date.now() });
  };

  const markStageDone = (stageId: string): number => {
    const timer = stageTimers.get(stageId);
    const duration = timer ? Math.max(0, now() - timer.startedAt) : 0;
    stageDurations.set(stageId, duration);
    updateStage(stageId, {
      status: "completed",
      progress: 100,
      completed_at: Date.now(),
      duration_ms: Math.round(duration),
    });
    return duration;
  };

  const markStageFailed = (stageId: string, message: string): number => {
    const timer = stageTimers.get(stageId);
    const duration = timer ? Math.max(0, now() - timer.startedAt) : 0;
    stageDurations.set(stageId, duration);
    updateStage(stageId, {
      status: "failed",
      progress: 100,
      error: message,
      completed_at: Date.now(),
      duration_ms: Math.round(duration),
    });
    return duration;
  };

  const concurrencyProfile = `adaptive:${Math.min(4, Math.max(2, Math.floor(getHardwareConcurrency() / 2)))}w:${getOcrConcurrency()}ocr`;

  markStageProcessing("hash");
  const stillHashPromise = deps.computeSHA256(file);
  const liveVideoHashPromise = item.liveVideoFile
    ? deps.computeSHA256(item.liveVideoFile)
    : Promise.resolve<string | null>(null);
  const [stillHash, liveVideoHash] = await Promise.all([stillHashPromise, liveVideoHashPromise]);
  const imageId =
    item.uploadMode === "live_photo" && liveVideoHash
      ? await deps.computeSHA256(new Blob([stillHash, ":", liveVideoHash], { type: "text/plain" }))
      : stillHash;
  taskMetrics.push({ task_id: "hash", status: "completed", duration_ms: Math.round(markStageDone("hash")) });
  updateItem({ metadata: { image_id: imageId } as ImageMetadata });

  markStageProcessing("thumbnail");
  const thumbResult = await deps.createThumbnail(file, {
    maxThumbSize,
    thumbQuality,
  });
  taskMetrics.push({
    task_id: "thumbnail",
    status: "completed",
    duration_ms: Math.round(markStageDone("thumbnail")),
  });

  const thumbUrl = URL.createObjectURL(thumbResult.blob);
  updateItem({ thumbnail: thumbUrl });

  markStageProcessing("exif");
  const exifResult = await deps.extractExif(file);
  taskMetrics.push({ task_id: "exif", status: "completed", duration_ms: Math.round(markStageDone("exif")) });

  markStageProcessing("region");
  const regionPromise = deps.resolveRegion(exifResult.exif).catch(() => undefined);

  markStageProcessing("ocr");
  const ocrPromise = withOcrSemaphore(() =>
    deps.performOcr(thumbResult.blob, { lang: ocrLang }, (progress) =>
      updateStage("ocr", { progress: progress.progress * 100 })
    )
  );

  markStageProcessing("phash");
  const pHashPromise = deps.computePHash(thumbResult.blob);

  markStageProcessing("color");
  const dominantColorPromise = Promise.resolve(deps.extractDominantColor(thumbResult.canvas));

  markStageProcessing("blur");
  const blurInfoPromise = Promise.resolve(deps.detectBlur(thumbResult.canvas, 128, blurThreshold));

  const dimensionsPromise = resolveImageDimensions(thumbUrl);

  let ocrResult: ImageMetadata["derived"]["ocr"] = { status: "failed", summary: "OCR processing failed" };
  try {
    ocrResult = await ocrPromise;
    const duration = markStageDone("ocr");
    taskMetrics.push({
      task_id: "ocr",
      status: ocrResult.status === "failed" ? "failed" : "completed",
      duration_ms: Math.round(duration),
      degraded: ocrResult.status === "failed",
    });
  } catch (error) {
    const duration = markStageFailed("ocr", error instanceof Error ? error.message : "OCR failed");
    taskMetrics.push({ task_id: "ocr", status: "failed", duration_ms: Math.round(duration), degraded: true });
    ocrResult = { status: "failed", summary: "OCR processing failed" };
  }

  let phashInfo: ImageMetadata["derived"]["phash"] = { algo: "blockhash", bits: 16, value: "" };
  try {
    phashInfo = await pHashPromise;
    const duration = markStageDone("phash");
    taskMetrics.push({ task_id: "phash", status: "completed", duration_ms: Math.round(duration) });
  } catch (error) {
    const duration = markStageFailed("phash", error instanceof Error ? error.message : "pHash failed");
    taskMetrics.push({ task_id: "phash", status: "failed", duration_ms: Math.round(duration), degraded: true });
  }

  const dominantColor = await dominantColorPromise;
  taskMetrics.push({ task_id: "color", status: "completed", duration_ms: Math.round(markStageDone("color")) });

  const blurInfo = await blurInfoPromise;
  taskMetrics.push({ task_id: "blur", status: "completed", duration_ms: Math.round(markStageDone("blur")) });

  const dimensions = await dimensionsPromise;

  let region: GeoRegion | undefined;
  try {
    region = await regionPromise;
    const duration = markStageDone("region");
    taskMetrics.push({
      task_id: "region",
      status: region ? "completed" : "skipped",
      duration_ms: Math.round(duration),
      degraded: !region,
    });
  } catch (error) {
    const duration = markStageFailed("region", error instanceof Error ? error.message : "region resolve failed");
    taskMetrics.push({ task_id: "region", status: "failed", duration_ms: Math.round(duration), degraded: true });
  }

  markStageProcessing("privacy");
  const hasGps = Boolean(
    exifResult.exif &&
      typeof exifResult.exif.GPSLatitude === "number" &&
      typeof exifResult.exif.GPSLongitude === "number"
  );
  const sanitizedExif = sanitizeExifGps(cloneExif(exifResult.exif));
  const privacy = {
    ...exifResult.privacy,
    original_contains_gps: hasGps || exifResult.privacy.original_contains_gps,
    exif_gps_removed: hasGps ? true : exifResult.privacy.exif_gps_removed,
  };
  taskMetrics.push({ task_id: "privacy", status: "completed", duration_ms: Math.round(markStageDone("privacy")) });

  markStageProcessing("finalize");
  const metadata: ImageMetadata = {
    schema_version: "1.2",
    image_id: imageId,
    original_filename: file.name,
    timestamps: {
      created_at: new Date().toISOString(),
      client_processed_at: new Date().toISOString(),
    },
    files: {
      original: {
        path: "",
        mime: file.type,
        bytes: file.size,
      },
      thumb: {
        path: "",
        mime: "image/webp",
        bytes: thumbResult.blob.size,
        width: thumbResult.width,
        height: thumbResult.height,
      },
      ...(item.liveVideoFile
        ? {
            live_video: {
              path: "",
              mime: item.liveVideoFile.type || "video/quicktime",
              bytes: item.liveVideoFile.size,
            },
          }
        : {}),
    },
    ...(item.uploadMode === "live_photo" && liveVideoHash
      ? {
          live_photo: {
            enabled: true,
            pair_id: imageId,
            still_hash: stillHash,
            video_hash: liveVideoHash,
          },
        }
      : {}),
    exif: sanitizedExif,
    privacy,
    ...(region ? { geo: { region } } : {}),
    derived: {
      dimensions,
      dominant_color: dominantColor,
      blur: blurInfo,
      phash: phashInfo,
      ocr: ocrResult,
    },
    processing: {
      summary: {
        total_ms: Math.round(Math.max(0, now() - pipelineStart)),
        concurrency_profile: concurrencyProfile,
        stage_durations: Array.from(stageDurations.entries()).map(([stage_id, duration_ms]) => ({
          stage_id,
          duration_ms: Math.round(duration_ms),
        })),
      },
    },
  };

  taskMetrics.push({ task_id: "finalize", status: "completed", duration_ms: Math.round(markStageDone("finalize")) });

  updateItem({
    metadata,
    editDraft: {
      description: metadata.description || "",
      original_filename: metadata.original_filename || file.name,
      category: metadata.category || "",
    },
    processingSummary: metadata.processing?.summary,
    taskMetrics,
  });

  return {
    metadata,
    thumbBlob: thumbResult.blob,
    thumbnailUrl: thumbUrl,
    processingSummary: metadata.processing?.summary,
    taskMetrics,
  };
}
