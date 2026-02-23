import type {
  ExifSummary,
  GeoRegion,
  ImageMetadata,
} from "@luminafe/contracts";
import { rgbaToThumbHash } from "thumbhash";

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
}

export interface BrowserThumbnailResult {
  blob: Blob;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

export interface BrowserUploadDeps {
  computeSHA256: (file: File | Blob) => Promise<string>;
  createThumbnail: (
    file: File | Blob,
    options: { maxThumbSize: number; thumbQuality: number },
  ) => Promise<BrowserThumbnailResult>;
  extractExif: (file: File | Blob) => Promise<{
    exif: ExifSummary | null;
    privacy: { original_contains_gps: boolean; exif_gps_removed: boolean };
  }>;
  performOcr: (
    file: File | Blob,
    options: { lang: string },
    onProgress?: (progress: { status: string; progress: number }) => void,
  ) => Promise<ImageMetadata["derived"]["ocr"]>;
  computePHash: (
    file: File | Blob,
  ) => Promise<ImageMetadata["derived"]["phash"]>;
  extractDominantColor: (
    canvas: HTMLCanvasElement,
  ) => ImageMetadata["derived"]["dominant_color"];
  detectBlur: (
    canvas: HTMLCanvasElement,
    sampleSize: number,
    threshold: number,
  ) => ImageMetadata["derived"]["blur"];
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
    editDraft?: {
      description?: string;
      original_filename?: string;
      category?: string;
    };
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
  thumbVariantBlobs?: Partial<Record<"400" | "800" | "1600", Blob>>;
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

const resolveImageDimensions = async (
  imageSrc: string,
): Promise<{ width: number; height: number }> => {
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

const sanitizeExifGps = (
  exif: ExifSummary | undefined,
): ExifSummary | undefined => {
  if (!exif) return undefined;
  const next = { ...exif };
  delete next.GPSLatitude;
  delete next.GPSLongitude;
  return next;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const buildThumbhash = (canvas: HTMLCanvasElement): string | undefined => {
  try {
    const maxDimension = 100;
    const ratio = Math.min(
      1,
      maxDimension / Math.max(canvas.width, canvas.height),
    );
    const targetWidth = Math.max(1, Math.round(canvas.width * ratio));
    const targetHeight = Math.max(1, Math.round(canvas.height * ratio));

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = targetWidth;
    sampleCanvas.height = targetHeight;
    const sampleCtx = sampleCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!sampleCtx) {
      return undefined;
    }

    sampleCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
    const imageData = sampleCtx.getImageData(0, 0, targetWidth, targetHeight);
    const rgba = new Uint8Array(
      imageData.data.buffer,
      imageData.data.byteOffset,
      imageData.data.byteLength,
    );
    const hash = rgbaToThumbHash(targetWidth, targetHeight, rgba);
    return bytesToBase64(hash);
  } catch {
    return undefined;
  }
};

const VARIANT_SIZES: Array<400 | 800 | 1600> = [400, 800, 1600];

const canvasToWebpBlob = (
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode thumbnail variant"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });

interface RasterImageSource {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  dispose: () => void;
}

const loadRasterImageSource = async (
  file: File | Blob,
): Promise<RasterImageSource> => {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, width, height) => {
        ctx.drawImage(bitmap, 0, 0, width, height);
      },
      dispose: () => {
        bitmap.close();
      },
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = objectUrl;
  });

  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    draw: (ctx, width, height) => {
      ctx.drawImage(image, 0, 0, width, height);
    },
    dispose: () => {
      URL.revokeObjectURL(objectUrl);
    },
  };
};

const createThumbVariants = async (
  sourceFile: File | Blob,
  quality: number,
): Promise<
  Partial<
    Record<
      "400" | "800" | "1600",
      { blob: Blob; width: number; height: number }
    >
  >
> => {
  const variants: Partial<
    Record<
      "400" | "800" | "1600",
      { blob: Blob; width: number; height: number }
    >
  > = {};
  const source = await loadRasterImageSource(sourceFile);

  try {
    for (const size of VARIANT_SIZES) {
      const ratio = Math.min(1, size / source.width, size / source.height);
      const width = Math.max(1, Math.round(source.width * ratio));
      const height = Math.max(1, Math.round(source.height * ratio));

      const variantCanvas = document.createElement("canvas");
      variantCanvas.width = width;
      variantCanvas.height = height;
      const ctx = variantCanvas.getContext("2d");
      if (!ctx) {
        continue;
      }
      source.draw(ctx, width, height);
      const blob = await canvasToWebpBlob(variantCanvas, quality);
      variants[String(size) as "400" | "800" | "1600"] = {
        blob,
        width,
        height,
      };
    }
  } finally {
    source.dispose();
  }

  return variants;
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
    updateStage(stageId, {
      status: "processing",
      progress: 0,
      started_at: Date.now(),
    });
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
  const imageId = await deps.computeSHA256(file);
  taskMetrics.push({
    task_id: "hash",
    status: "completed",
    duration_ms: Math.round(markStageDone("hash")),
  });
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
  const thumbVariants = await createThumbVariants(file, thumbQuality);

  markStageProcessing("exif");
  const exifResult = await deps.extractExif(file);
  taskMetrics.push({
    task_id: "exif",
    status: "completed",
    duration_ms: Math.round(markStageDone("exif")),
  });

  markStageProcessing("region");
  const regionPromise = deps
    .resolveRegion(exifResult.exif)
    .catch(() => undefined);

  markStageProcessing("ocr");
  const ocrPromise = withOcrSemaphore(() =>
    deps.performOcr(thumbResult.blob, { lang: ocrLang }, (progress) =>
      updateStage("ocr", { progress: progress.progress * 100 }),
    ),
  );

  markStageProcessing("phash");
  const pHashPromise = deps.computePHash(thumbResult.blob);

  markStageProcessing("color");
  const dominantColorPromise = Promise.resolve(
    deps.extractDominantColor(thumbResult.canvas),
  );

  markStageProcessing("blur");
  const blurInfoPromise = Promise.resolve(
    deps.detectBlur(thumbResult.canvas, 128, blurThreshold),
  );

  const dimensionsPromise = resolveImageDimensions(thumbUrl);

  let ocrResult: ImageMetadata["derived"]["ocr"] = {
    status: "failed",
    summary: "OCR processing failed",
  };
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
    const duration = markStageFailed(
      "ocr",
      error instanceof Error ? error.message : "OCR failed",
    );
    taskMetrics.push({
      task_id: "ocr",
      status: "failed",
      duration_ms: Math.round(duration),
      degraded: true,
    });
    ocrResult = { status: "failed", summary: "OCR processing failed" };
  }

  let phashInfo: ImageMetadata["derived"]["phash"] = {
    algo: "blockhash",
    bits: 16,
    value: "",
  };
  try {
    phashInfo = await pHashPromise;
    const duration = markStageDone("phash");
    taskMetrics.push({
      task_id: "phash",
      status: "completed",
      duration_ms: Math.round(duration),
    });
  } catch (error) {
    const duration = markStageFailed(
      "phash",
      error instanceof Error ? error.message : "pHash failed",
    );
    taskMetrics.push({
      task_id: "phash",
      status: "failed",
      duration_ms: Math.round(duration),
      degraded: true,
    });
  }

  const dominantColor = await dominantColorPromise;
  taskMetrics.push({
    task_id: "color",
    status: "completed",
    duration_ms: Math.round(markStageDone("color")),
  });

  const blurInfo = await blurInfoPromise;
  taskMetrics.push({
    task_id: "blur",
    status: "completed",
    duration_ms: Math.round(markStageDone("blur")),
  });

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
    const duration = markStageFailed(
      "region",
      error instanceof Error ? error.message : "region resolve failed",
    );
    taskMetrics.push({
      task_id: "region",
      status: "failed",
      duration_ms: Math.round(duration),
      degraded: true,
    });
  }

  markStageProcessing("privacy");
  const hasGps = Boolean(
    exifResult.exif &&
    typeof exifResult.exif.GPSLatitude === "number" &&
    typeof exifResult.exif.GPSLongitude === "number",
  );
  const sanitizedExif = sanitizeExifGps(cloneExif(exifResult.exif));
  const privacy = {
    ...exifResult.privacy,
    original_contains_gps: hasGps || exifResult.privacy.original_contains_gps,
    exif_gps_removed: hasGps ? true : exifResult.privacy.exif_gps_removed,
  };
  taskMetrics.push({
    task_id: "privacy",
    status: "completed",
    duration_ms: Math.round(markStageDone("privacy")),
  });

  markStageProcessing("finalize");
  const metadata: ImageMetadata = {
    schema_version: "1.3",
    image_id: imageId,
    thumbhash: buildThumbhash(thumbResult.canvas),
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
      ...(Object.keys(thumbVariants).length > 0
        ? {
            thumb_variants: Object.fromEntries(
              Object.entries(thumbVariants).map(([key, variant]) => [
                key,
                {
                  path: "",
                  mime: "image/webp",
                  bytes: variant.blob.size,
                  width: variant.width,
                  height: variant.height,
                  size: Number(key) as 400 | 800 | 1600,
                },
              ]),
            ),
          }
        : {}),
    },
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
        stage_durations: Array.from(stageDurations.entries()).map(
          ([stage_id, duration_ms]) => ({
            stage_id,
            duration_ms: Math.round(duration_ms),
          }),
        ),
      },
    },
  };

  taskMetrics.push({
    task_id: "finalize",
    status: "completed",
    duration_ms: Math.round(markStageDone("finalize")),
  });

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
    thumbVariantBlobs: Object.fromEntries(
      Object.entries(thumbVariants).map(([key, variant]) => [
        key,
        variant.blob,
      ]),
    ) as Partial<Record<"400" | "800" | "1600", Blob>>,
    thumbnailUrl: thumbUrl,
    processingSummary: metadata.processing?.summary,
    taskMetrics,
  };
}
