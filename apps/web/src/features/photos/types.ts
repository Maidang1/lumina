import type {
  FileMeta,
  ExifSummary,
  GeoRegion,
  ImageMetadata as ContractsImageMetadata,
  PrivacyInfo,
  BatchFinalizeResult as ContractsBatchFinalizeResult,
  ThumbMeta,
  UploadResult as ContractsUploadResult,
} from "@lumina/contracts";

export interface ExifData {
  camera: string;
  lens: string;
  iso: number;
  aperture: string;
  shutter: string;
  focalLength: string;
  date: string;
}

export type VideoSource =
  | {
      type: "live-photo";
      videoUrl: string;
      mime?: string;
    }
  | {
      type: "none";
    };

export interface Photo {
  id: string;
  url: string;
  thumbnail: string;
  isLive: boolean;
  liveUrl?: string;
  liveMime?: string;
  videoSource?: VideoSource;
  livePlaybackReady?: boolean;
  title: string;
  location: string;
  category: string;
  width: number;
  height: number;
  visualDescription: string;
  filename: string;
  format: string;
  size: string;
  exif: ExifData;
  metadata?: ImageMetadata;
}

export type ImageMetadata = ContractsImageMetadata;
export type UploadResult = ContractsUploadResult;
export type BatchFinalizeResult = ContractsBatchFinalizeResult;
export type { FileMeta, PrivacyInfo, ThumbMeta };

export interface Dimensions {
  width: number;
  height: number;
}

export interface DominantColor {
  hex: string;
}

export interface BlurInfo {
  score: number;
  is_blurry: boolean;
  method: "variance_of_laplacian";
}

export interface PHashInfo {
  algo: "blockhash";
  bits: 16 | 32;
  value: string;
}

export interface OcrInfo {
  status: "ok" | "skipped" | "failed";
  lang?: string;
  summary?: string;
}

export interface DerivedData {
  dimensions: Dimensions;
  dominant_color: DominantColor;
  blur: BlurInfo;
  phash: PHashInfo;
  ocr: OcrInfo;
}

export interface StageDuration {
  stage_id: string;
  duration_ms: number;
}

export interface ProcessingSummary {
  total_ms: number;
  concurrency_profile: string;
  stage_durations: StageDuration[];
}

export interface UploadError {
  error: string;
  message?: string;
  retry_after?: number;
}

export interface ImageListResponse {
  images: ImageMetadata[];
  next_cursor?: string;
  total: number;
}

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface ProcessingStage {
  id: string;
  name: string;
  status: ProcessingStatus;
  progress: number;
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

export interface UploadQueueItem {
  id: string;
  file: File;
  liveVideoFile?: File;
  uploadMode: "static" | "live_photo";
  status:
    | "queued"
    | "processing"
    | "uploading"
    | "completed"
    | "failed"
    | "queued_parse"
    | "parsing"
    | "parsed"
    | "parse_failed"
    | "ready_to_upload"
    | "upload_completed"
    | "upload_failed";
  progress: number;
  stages: ProcessingStage[];
  metadata?: ImageMetadata;
  result?: UploadResult;
  error?: string;
  parseError?: string;
  uploadError?: string;
  editDraft?: {
    description?: string;
    original_filename?: string;
    category?: string;
  };
  thumbnail?: string;
  retryCount?: number;
  workerSlot?: number;
  processingSummary?: ProcessingSummary;
  taskMetrics?: ProcessingTaskMetric[];
}

export interface UploadConfig {
  maxFileSize: number;
  maxThumbSize: number;
  thumbQuality: number;
  ocrLang: string;
  blurThreshold: number;
}

export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  maxFileSize: 25 * 1024 * 1024,
  maxThumbSize: 1024,
  thumbQuality: 0.85,
  ocrLang: "eng+chi_sim",
  blurThreshold: 100,
};

export type { ExifSummary, GeoRegion };
