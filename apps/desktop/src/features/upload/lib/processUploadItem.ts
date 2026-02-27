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
import { parseImageForUploadFromPathOptimized } from '@/lib/tauri/image';
import type { ParseImageForUploadResultOptimized } from '@/lib/tauri/image';
import { logger } from '@/lib/logger';

interface ParseUploadItemOptions {
  item: UploadQueueItem;
  updateItem: (updates: Partial<UploadQueueItem>) => void;
  updateStage: (stageId: string, updates: Partial<ProcessingStage>) => void;
}

interface SubmitUploadItemOptions {
  imageId: string;
  originalPath: string;
  originalMime: string;
  thumbPath: string;
  metadata: ImageMetadata;
  thumbVariantPaths?: Partial<Record<'400' | '800' | '1600', string>>;
  deferFinalize?: boolean;
  onProgress?: (progress: number) => void;
}

interface ParsedUploadItemResult {
  metadata: ImageMetadata;
  originalPath: string;
  originalMime: string;
  thumbPath: string;
  thumbVariantPaths?: Partial<Record<'400' | '800' | '1600', string>>;
  thumbnailUrl: string;
  processingSummary?: ProcessingSummary;
  taskMetrics: ProcessingTaskMetric[];
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
  const parseStart = performance.now();
  const fileWithPath = item.file as File & { path?: string };
  const parsePath = item.sourcePath || fileWithPath.path;
  if (!parsePath) {
    throw new Error('Missing local file path for Rust parser');
  }
  const config = {
    maxThumbSize: DEFAULT_UPLOAD_CONFIG.maxThumbSize,
    thumbQuality: DEFAULT_UPLOAD_CONFIG.thumbQuality,
    blurThreshold: DEFAULT_UPLOAD_CONFIG.blurThreshold,
    enableRegionResolve: DEFAULT_UPLOAD_CONFIG.enableRegionResolve,
    generateThumbVariants: DEFAULT_UPLOAD_CONFIG.generateThumbVariants,
    useOptimized: true,  // 使用优化版本，获取文件路径
  };

  const rustParseStart = performance.now();
  const rustParsed = await parseImageForUploadFromPathOptimized({
    path: parsePath,
    declaredMime: item.sourceMime || item.file.type || 'application/octet-stream',
    config,
  });
  const rustParseDuration = performance.now() - rustParseStart;

  logger.debug(
    `[Performance] Image parse completed in ${rustParseDuration.toFixed(2)}ms`,
    `(file: ${item.file.name}, size: ${(item.file.size / 1024).toFixed(2)}KB)`,
  );

  rustParsed.stageMetrics.forEach((metric) => {
    mapStageFromMetric(updateStage, metric);
    if (metric.duration_ms > 100) {
      logger.debug(
        `[Performance] Stage "${metric.task_id}" took ${metric.duration_ms}ms`,
      );
    }
  });

  // 解析缩略图变体路径
  const thumbVariantPaths: Partial<Record<'400' | '800' | '1600', string>> = {};
  (['400', '800', '1600'] as const).forEach((size) => {
    const path = rustParsed.thumbVariants[size];
    if (path) {
      thumbVariantPaths[size] = path;
    }
  });

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

  const totalDuration = performance.now() - parseStart;
  logger.debug(
    `[Performance] Total parse time: ${totalDuration.toFixed(2)}ms`,
    `(Rust: ${rustParseDuration.toFixed(2)}ms, JS overhead: ${(totalDuration - rustParseDuration).toFixed(2)}ms)`,
  );

  // 为缩略图创建临时对象URL用于预览
  // 由于我们现在使用文件路径，无法直接创建blob
  // 可以使用tauri绑定或者等到上传时再处理
  const thumbnailUrl = ''; // placeholder，或通过tauri读取

  updateItem({
    metadata,
    thumbnail: thumbnailUrl,
    editDraft: {
      description: metadata.description || '',
      original_filename: metadata.original_filename || item.file.name,
      category: metadata.category || '',
    },
    processingSummary: metadata.processing?.summary,
    taskMetrics,
  });

  return {
    metadata,
    originalPath: rustParsed.normalizedOriginalPath,
    originalMime: rustParsed.normalizedOriginalMime,
    thumbPath: rustParsed.thumbPath,
    thumbVariantPaths,
    thumbnailUrl,
    processingSummary: metadata.processing?.summary,
    taskMetrics,
  };
};

export const submitUploadItem = async ({
  imageId,
  originalPath,
  originalMime,
  thumbPath,
  metadata,
  thumbVariantPaths,
  deferFinalize,
  onProgress,
}: SubmitUploadItemOptions): Promise<UploadResult> => {
  return uploadService.uploadImageFromCache({
    imageId,
    originalPath,
    originalMime,
    thumbPath,
    metadata,
    thumbVariantPaths,
    deferFinalize,
    onProgress,
  });
};
