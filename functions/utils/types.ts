export interface Env {
  GITHUB_TOKEN: string;
  GH_OWNER: string;
  GH_REPO: string;
  GH_BRANCH: string;
  ALLOW_ORIGIN: string;
  UPLOAD_TOKEN: string;
  SHARE_SIGNING_SECRET?: string;
}

export interface ImageMetadata {
  schema_version: "1.0" | "1.1";
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
  derived: DerivedData;
}

interface FileMeta {
  path: string;
  mime: string;
  bytes: number;
}

interface ThumbMeta extends FileMeta {
  width: number;
  height: number;
}

interface ExifSummary {
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

interface PrivacyInfo {
  original_contains_gps: boolean;
  exif_gps_removed: boolean;
}

interface DerivedData {
  dimensions: { width: number; height: number };
  dominant_color: { hex: string };
  blur: { score: number; is_blurry: boolean; method: string };
  phash: { algo: string; bits: number; value: string };
  ocr: { status: string; lang?: string; summary?: string };
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
}

export interface ImageListCursor {
  created_at: string;
  image_id: string;
}

export interface ImageIndexEntry {
  image_id: string;
  created_at: string;
  meta_path: string;
}

export interface ImageIndexFile {
  version: "1";
  updated_at: string;
  items: ImageIndexEntry[];
}

export interface GitHubFileResponse {
  name: string;
  path: string;
  sha: string;
  content: string;
  encoding: string;
  download_url: string | null;
  type?: string;
}
