import { invoke } from '@tauri-apps/api/core';
import type { ImageMetadata, ProcessingTaskMetric } from '@/types/photo';

export interface ParseImageConfig {
  maxThumbSize?: number;
  thumbQuality?: number;
  blurThreshold?: number;
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
