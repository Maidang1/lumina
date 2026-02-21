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
import {
  createThumbnail,
  computeSHA256,
  detectBlur,
  extractDominantColor,
  extractExif,
  performOcr,
  computePHash,
} from "@luminafe/upload-core/browser";
import { uploadService } from "@/features/photos/services/uploadService";
import { reverseGeocodeToRegion } from "@/features/photos/services/geoRegionService";
import { parseUploadItemInBrowser } from "@luminafe/upload-core/browser";

export interface ParseUploadItemOptions {
  item: UploadQueueItem;
  updateItem: (updates: Partial<UploadQueueItem>) => void;
  updateStage: (stageId: string, updates: Partial<ProcessingStage>) => void;
}

interface ProcessUploadItemOptions extends ParseUploadItemOptions {
  requestDescription: (params: {
    originalFilename: string;
    initialDescription?: string;
    initialCategory?: string;
  }) => Promise<{ description?: string; category?: string }>;
  onUploadComplete?: (metadata: ImageMetadata) => void;
}

export interface SubmitUploadItemOptions {
  item: UploadQueueItem;
  metadata: ImageMetadata;
  thumbBlob: Blob;
  deferFinalize?: boolean;
  onProgress?: (progress: number) => void;
}

export interface ParsedUploadItemResult {
  metadata: ImageMetadata;
  thumbBlob: Blob;
  thumbnailUrl: string;
  processingSummary?: ImageMetadata["processing"]["summary"];
  taskMetrics: ProcessingTaskMetric[];
}

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
  return parseUploadItemInBrowser({
    item,
    updateItem,
    updateStage,
    config: {
      maxThumbSize: DEFAULT_UPLOAD_CONFIG.maxThumbSize,
      thumbQuality: DEFAULT_UPLOAD_CONFIG.thumbQuality,
      ocrLang: DEFAULT_UPLOAD_CONFIG.ocrLang,
      blurThreshold: DEFAULT_UPLOAD_CONFIG.blurThreshold,
    },
    deps: {
      computeSHA256,
      createThumbnail,
      extractExif,
      performOcr,
      computePHash,
      extractDominantColor,
      detectBlur,
      resolveRegion,
    },
  });
};

export const submitUploadItem = async ({
  item,
  metadata,
  thumbBlob,
  deferFinalize,
  onProgress,
}: SubmitUploadItemOptions): Promise<UploadResult> => {
  return uploadService.uploadImage(
    item.file,
    thumbBlob,
    metadata,
    item.liveVideoFile,
    item.uploadMode,
    onProgress,
    { deferFinalize }
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
    initialCategory: parsed.metadata.category || "",
  });

  const nextMetadata: ImageMetadata = {
    ...parsed.metadata,
    schema_version: "1.3",
    ...(descriptionResult.description !== undefined
      ? { description: descriptionResult.description }
      : {}),
    ...(descriptionResult.category !== undefined && descriptionResult.category.trim() !== ""
      ? { category: descriptionResult.category.trim() }
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
