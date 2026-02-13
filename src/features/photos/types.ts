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

export interface ImageMetadata {
  schema_version: "1.0" | "1.1";
  image_id: string;
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
  derived: DerivedData;
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
}

export interface UploadQueueItem {
  id: string;
  file: File;
  liveVideoFile?: File;
  uploadMode: "static" | "live_photo";
  status: "queued" | "processing" | "uploading" | "completed" | "failed";
  progress: number;
  stages: ProcessingStage[];
  metadata?: ImageMetadata;
  result?: UploadResult;
  error?: string;
  thumbnail?: string;
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
