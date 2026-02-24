import {
  DEFAULT_UPLOAD_CONFIG,
  ImageMetadata,
  ProcessingStage,
  ProcessingSummary,
  ProcessingTaskMetric,
  UploadQueueItem,
  UploadResult,
} from '@/types/photo';
import { uploadService } from '@/services/uploadService';
import { parseImageForUploadFromPath } from '@/lib/tauri/image';

interface ParseUploadItemOptions {
  item: UploadQueueItem;
  updateItem: (updates: Partial<UploadQueueItem>) => void;
  updateStage: (stageId: string, updates: Partial<ProcessingStage>) => void;
}

interface SubmitUploadItemOptions {
  original: File;
  metadata: ImageMetadata;
  thumbBlob: Blob;
  thumbVariantBlobs?: Partial<Record<'400' | '800' | '1600', Blob>>;
  deferFinalize?: boolean;
  onProgress?: (progress: number) => void;
}

interface ParsedUploadItemResult {
  metadata: ImageMetadata;
  thumbBlob: Blob;
  thumbVariantBlobs?: Partial<Record<'400' | '800' | '1600', Blob>>;
  thumbnailUrl: string;
  processingSummary?: ProcessingSummary;
  taskMetrics: ProcessingTaskMetric[];
  normalizedOriginalFile: File;
}

const mapStageFromMetric = (
  updateStage: (stageId: string, updates: Partial<ProcessingStage>) => void,
  metric: ProcessingTaskMetric,
): void => {
  updateStage(metric.task_id, {
    status: metric.status === 'failed' ? 'failed' : 'completed',
    progress: 100,
    duration_ms: Math.max(0, Math.round(metric.duration_ms)),
    completed_at: Date.now(),
    ...(metric.status === 'failed' ? { error: 'Processing failed' } : {}),
  });
};

export const parseUploadItem = async ({
  item,
  updateItem,
  updateStage,
}: ParseUploadItemOptions): Promise<ParsedUploadItemResult> => {
  const fileWithPath = item.file as File & { path?: string };
  const parsePath = item.sourcePath || fileWithPath.path;
  if (!parsePath) {
    throw new Error('Missing local file path for Rust parser');
  }
  const config = {
    maxThumbSize: DEFAULT_UPLOAD_CONFIG.maxThumbSize,
    thumbQuality: DEFAULT_UPLOAD_CONFIG.thumbQuality,
    blurThreshold: DEFAULT_UPLOAD_CONFIG.blurThreshold,
  };

  const rustParsed = await parseImageForUploadFromPath({
    path: parsePath,
    declaredMime: item.sourceMime || item.file.type || 'application/octet-stream',
    config,
  });

  rustParsed.stageMetrics.forEach((metric) => mapStageFromMetric(updateStage, metric));

  const normalizedOriginalFile = new File(
    [new Uint8Array(rustParsed.normalizedOriginalBytes)],
    rustParsed.normalizedOriginalFilename,
    {
      type: rustParsed.normalizedOriginalMime,
      lastModified: item.file.lastModified || Date.now(),
    },
  );

  const thumbBlob = new Blob([new Uint8Array(rustParsed.thumbBytes)], {
    type: 'image/webp',
  });

  const thumbVariantBlobs: Partial<Record<'400' | '800' | '1600', Blob>> = {};
  (['400', '800', '1600'] as const).forEach((size) => {
    const data = rustParsed.thumbVariants[size];
    if (!data) {
      return;
    }
    thumbVariantBlobs[size] = new Blob([new Uint8Array(data)], {
      type: 'image/webp',
    });
  });

  const thumbUrl = URL.createObjectURL(thumbBlob);
  const metadata = rustParsed.metadata;

  metadata.derived.ocr = {
    status: 'skipped',
    lang: DEFAULT_UPLOAD_CONFIG.ocrLang,
    summary: '',
  };

  updateStage('ocr', {
    status: 'completed',
    progress: 100,
    duration_ms: 0,
    completed_at: Date.now(),
    error: undefined,
  });

  const ocrMetric: ProcessingTaskMetric = {
    task_id: 'ocr',
    status: 'skipped',
    duration_ms: 0,
    degraded: false,
  };
  const taskMetrics = [...rustParsed.stageMetrics, ocrMetric];

  updateItem({
    metadata,
    thumbnail: thumbUrl,
    editDraft: {
      description: metadata.description || '',
      original_filename: metadata.original_filename || normalizedOriginalFile.name,
      category: metadata.category || '',
    },
    processingSummary: metadata.processing?.summary,
    taskMetrics,
  });

  return {
    metadata,
    thumbBlob,
    thumbVariantBlobs,
    thumbnailUrl: thumbUrl,
    processingSummary: metadata.processing?.summary,
    taskMetrics,
    normalizedOriginalFile,
  };
};

export const submitUploadItem = async ({
  original,
  metadata,
  thumbBlob,
  thumbVariantBlobs,
  deferFinalize,
  onProgress,
}: SubmitUploadItemOptions): Promise<UploadResult> => {
  return uploadService.uploadImage(
    original,
    thumbBlob,
    metadata,
    thumbVariantBlobs,
    onProgress,
    { deferFinalize },
  );
};
