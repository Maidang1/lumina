import { invoke } from '@tauri-apps/api/core';
import type { ImageMetadata, ProcessingTaskMetric } from '@/types/photo';

export interface ParseImageConfig {
  maxThumbSize?: number;
  thumbQuality?: number;
  blurThreshold?: number;
  enableRegionResolve?: boolean;
  generateThumbVariants?: boolean;
  useOptimized?: boolean;  // 新增：是否使用优化版本（返回路径而不是二进制数据）
}

export interface ParseFormatReport {
  declaredMime: string;
  detectedMime: string;
  converted: boolean;
  reason: string;
}

export interface ParseImageForUploadResult {
  normalizedOriginalBytes: number[];
  normalizedOriginalMime: string;
  normalizedOriginalFilename: string;
  thumbBytes: number[];
  thumbVariants: Record<string, number[]>;
  metadata: ImageMetadata;
  formatReport: ParseFormatReport;
  stageMetrics: ProcessingTaskMetric[];
}

export interface ParseImageForUploadResultOptimized {
  normalizedOriginalPath: string;
  normalizedOriginalMime: string;
  normalizedOriginalFilename: string;
  thumbPath: string;
  thumbVariants: Record<string, string>;  // size -> path
  metadata: ImageMetadata;
  formatReport: ParseFormatReport;
  stageMetrics: ProcessingTaskMetric[];
}

export async function parseImageForUploadFromPath(params: {
  path: string;
  declaredMime?: string;
  config?: ParseImageConfig;
}): Promise<ParseImageForUploadResult> {
  return invoke<ParseImageForUploadResult>('parse_image_for_upload_from_path', {
    path: params.path,
    declaredMime: params.declaredMime,
    config: params.config,
  });
}

export async function parseImageForUploadFromPathOptimized(params: {
  path: string;
  declaredMime?: string;
  config?: ParseImageConfig;
}): Promise<ParseImageForUploadResultOptimized> {
  return invoke<ParseImageForUploadResultOptimized>('parse_image_for_upload_from_path_optimized', {
    path: params.path,
    declaredMime: params.declaredMime,
    config: params.config,
  });
}

export interface CacheUploadRequest {
  imageId: string;
  originalPath: string;
  originalMime: string;
  thumbPath: string;
  thumbVariants: Record<string, string>;
  metadata: string;
  deferFinalize?: boolean;
}

export interface CacheUploadResponse {
  success: boolean;
  imageId: string;
  message: string;
}

export async function uploadFromCacheToGithub(
  requests: CacheUploadRequest[]
): Promise<CacheUploadResponse[]> {
  return invoke<CacheUploadResponse[]>('upload_from_cache_to_github', { requests });
}

// 元数据合并和验证接口
export interface EditDraft {
  description?: string;
  original_filename?: string;
  category?: string;
}

export interface MergeMetadataRequest {
  metadata: ImageMetadata;
  edit_draft: EditDraft;
}

export interface MergedMetadata {
  metadata: ImageMetadata;
  validation_warnings: string[];
}

export async function mergeAndValidateMetadata(
  request: MergeMetadataRequest
): Promise<MergedMetadata> {
  return invoke<MergedMetadata>('merge_and_validate_metadata', { request });
}

export interface BatchMergeRequest {
  items: MergeMetadataRequest[];
}

export interface BatchMergeResult {
  results: MergedMetadata[];
  total_warnings: number;
}

export async function batchMergeAndValidateMetadata(
  request: BatchMergeRequest
): Promise<BatchMergeResult> {
  return invoke<BatchMergeResult>('batch_merge_and_validate_metadata', { request });
}

// ============ 事件驱动上传接口 ============

export interface PreparedUploadItem {
  image_id: string;
  original_path: string;
  original_mime: string;
  thumb_path: string;
  thumb_variants: Record<string, string>;  // size -> path
  metadata: string;  // JSON
}

export interface UploadStartedPayload {
  image_id: string;
  total_size: number;
}

export interface UploadProgressPayload {
  image_id: string;
  progress: number;  // 0-100
  bytes_transferred: number;
  total_bytes: number;
}

export interface UploadCompletedPayload {
  image_id: string;
  success: boolean;
  message: string;
  result?: Record<string, unknown>;
}

export interface BatchUploadStartedPayload {
  batch_id: string;
  total_items: number;
  total_bytes: number;
}

export interface BatchUploadStatsPayload {
  batch_id: string;
  completed: number;
  failed: number;
  pending: number;
  overall_progress: number;  // 0-100
}

export interface BatchUploadFailure {
  image_id: string;
  reason: string;
}

export interface BatchUploadCompletedPayload {
  batch_id: string;
  total_items: number;
  successful_items: number;
  failed_items: number;
  total_duration_ms: number;
  failures: BatchUploadFailure[];
}

/**
 * 启动批量上传（事件驱动）
 * 返回 batch_id，用于后续事件关联
 */
export async function startBatchUploadWithEvents(
  items: PreparedUploadItem[]
): Promise<string> {
  return invoke<string>('start_batch_upload_with_events', { items });
}

