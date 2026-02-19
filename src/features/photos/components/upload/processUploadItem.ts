import {
  DEFAULT_UPLOAD_CONFIG,
  ExifSummary,
  GeoRegion,
  ImageMetadata,
  ProcessingStage,
  ProcessingTaskMetric,
  UploadQueueItem,
  UploadResult,
} from "@/features/photos/types";
import { computePHash } from "@/features/photos/services/phashService";
import {
  createThumbnail,
  computeSHA256,
  detectBlur,
  extractDominantColor,
} from "@/features/photos/services/imageProcessor";
import { extractExif } from "@/features/photos/services/exifExtractor";
import { performOcr } from "@/features/photos/services/ocrService";
import { uploadService } from "@/features/photos/services/uploadService";
import { reverseGeocodeToRegion } from "@/features/photos/services/geoRegionService";

export interface ParseUploadItemOptions {
  item: UploadQueueItem;
  updateItem: (updates: Partial<UploadQueueItem>) => void;
  updateStage: (stageId: string, updates: Partial<ProcessingStage>) => void;
}

interface ProcessUploadItemOptions extends ParseUploadItemOptions {
  requestDescription: (params: {
    originalFilename: string;
    initialDescription?: string;
  }) => Promise<{ description?: string }>;
  onUploadComplete?: (metadata: ImageMetadata) => void;
}

export interface SubmitUploadItemOptions {
  item: UploadQueueItem;
  metadata: ImageMetadata;
  thumbBlob: Blob;
  onProgress?: (progress: number) => void;
}

export interface ParsedUploadItemResult {
  metadata: ImageMetadata;
  thumbBlob: Blob;
  thumbnailUrl: string;
  processingSummary?: ImageMetadata["processing"]["summary"];
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

const resolveRegion = async (exif: ExifSummary | null): Promise<GeoRegion | undefined> => {
  if (!exif) return undefined;
  if (typeof exif.GPSLatitude !== "number" || typeof exif.GPSLongitude !== "number") {
    return undefined;
  }

  const region = await reverseGeocodeToRegion(exif.GPSLatitude, exif.GPSLongitude);
  return {
    country: region.country,
    province: region.province,
    city: region.city,
    display_name: `${region.province}·${region.city}`,
    cache_key: `CN|${region.province}|${region.city}`,
    source: "nominatim",
    resolved_at: new Date().toISOString(),
  };
};

export const parseUploadItem = async ({
  item,
  updateItem,
  updateStage,
}: ParseUploadItemOptions): Promise<ParsedUploadItemResult> => {
  const file = item.file;
  const pipelineStart = now();
  const stageTimers = new Map<string, StageTimer>();
  const stageDurations = new Map<string, number>();
  const taskMetrics: ProcessingTaskMetric[] = [];

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
  const stillHashPromise = computeSHA256(file);
  const liveVideoHashPromise = item.liveVideoFile ? computeSHA256(item.liveVideoFile) : Promise.resolve<string | null>(null);
  const [stillHash, liveVideoHash] = await Promise.all([stillHashPromise, liveVideoHashPromise]);
  const imageId =
    item.uploadMode === "live_photo" && liveVideoHash
      ? await computeSHA256(new Blob([stillHash, ":", liveVideoHash], { type: "text/plain" }))
      : stillHash;
  taskMetrics.push({ task_id: "hash", status: "completed", duration_ms: Math.round(markStageDone("hash")) });
  updateItem({ metadata: { image_id: imageId } as ImageMetadata });

  markStageProcessing("thumbnail");
  const thumbResult = await createThumbnail(file, {
    maxThumbSize: DEFAULT_UPLOAD_CONFIG.maxThumbSize,
    thumbQuality: DEFAULT_UPLOAD_CONFIG.thumbQuality,
  });
  taskMetrics.push({ task_id: "thumbnail", status: "completed", duration_ms: Math.round(markStageDone("thumbnail")) });

  const thumbUrl = URL.createObjectURL(thumbResult.blob);
  updateItem({ thumbnail: thumbUrl });

  markStageProcessing("exif");
  const exifResult = await extractExif(file);
  taskMetrics.push({ task_id: "exif", status: "completed", duration_ms: Math.round(markStageDone("exif")) });

  markStageProcessing("region");
  const regionPromise = resolveRegion(exifResult.exif).catch(() => undefined);

  markStageProcessing("ocr");
  const ocrPromise = withOcrSemaphore(() =>
    performOcr(
      thumbResult.blob,
      { lang: DEFAULT_UPLOAD_CONFIG.ocrLang },
      (progress) => updateStage("ocr", { progress: progress.progress * 100 })
    )
  );

  markStageProcessing("phash");
  const pHashPromise = computePHash(thumbResult.blob);

  markStageProcessing("color");
  const dominantColorPromise = Promise.resolve(extractDominantColor(thumbResult.canvas));

  markStageProcessing("blur");
  const blurInfoPromise = Promise.resolve(
    detectBlur(thumbResult.canvas, 128, DEFAULT_UPLOAD_CONFIG.blurThreshold)
  );

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
};

export const submitUploadItem = async ({
  item,
  metadata,
  thumbBlob,
  onProgress,
}: SubmitUploadItemOptions): Promise<UploadResult> => {
  return uploadService.uploadImage(
    item.file,
    thumbBlob,
    metadata,
    item.liveVideoFile,
    item.uploadMode,
    onProgress
  );
};

export const processUploadItem = async ({
  item,
  requestDescription,
  updateItem,
  updateStage,
  onUploadComplete,
}: ProcessUploadItemOptions): Promise<void> => {
  const parsed = await parseUploadItem({ item, updateItem, updateStage });
  const descriptionResult = await requestDescription({
    originalFilename: item.file.name,
    initialDescription: parsed.metadata.description || "",
  });

  const nextMetadata: ImageMetadata = {
    ...parsed.metadata,
    ...(descriptionResult.description !== undefined
      ? { description: descriptionResult.description }
      : {}),
  };

  updateItem({ metadata: nextMetadata, status: "uploading", progress: 0 });

  const result = await submitUploadItem({
    item,
    metadata: nextMetadata,
    thumbBlob: parsed.thumbBlob,
    onProgress: (progress) => updateItem({ progress }),
  });

  updateItem({ status: "completed", result });
  onUploadComplete?.(nextMetadata);
};
