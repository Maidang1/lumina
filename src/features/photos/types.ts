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

export interface FileMeta {
  path: string;
  mime: string;
  bytes: number;
}

export interface ThumbMeta extends FileMeta {
  width: number;
  height: number;
}

export interface ExifSummary {
  Make?: string;
  Model?: string;
  LensModel?: string;
  GPSLatitude?: number;
  GPSLongitude?: number;
  DateTimeOriginal?: string;
  ExposureTime?: number;
  FNumber?: number;
  ISO?: number;
  FocalLength?: number;
  Orientation?: number;
  Software?: string;
  Artist?: string;
  Copyright?: string;
}

export interface PrivacyInfo {
  original_contains_gps: boolean;
  exif_gps_removed: boolean;
}

export interface GeoRegion {
  country: string;
  province: string;
  city: string;
  display_name: string;
  cache_key: string;
  source: "nominatim";
  resolved_at: string;
}

export interface GeoInfo {
  region?: GeoRegion;
}

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

export interface ImageMetadata {
  schema_version: "1.0" | "1.1" | "1.2";
  image_id: string;
  original_filename?: string;
  description?: string;
  timestamps: {
    created_at: string;
    client_processed_at?: string;
  };
  files: {
    original: FileMeta;
    thumb: ThumbMeta;
    live_video?: FileMeta;
  };
  live_photo?: {
    enabled: boolean;
    pair_id: string;
    still_hash: string;
    video_hash: string;
    duration_ms?: number;
  };
  exif?: ExifSummary;
  privacy: PrivacyInfo;
  geo?: GeoInfo;
  derived: DerivedData;
  processing?: {
    summary: ProcessingSummary;
  };
}

export interface UploadResult {
  image_id: string;
  stored: {
    original_path: string;
    thumb_path: string;
    live_video_path?: string;
    meta_path: string;
  };
  urls: {
    meta: string;
    thumb: string;
    original: string;
    live?: string;
  };
  etag?: string;
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
