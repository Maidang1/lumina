export interface VideoLoadState {
  isConverting?: boolean;
  loadingProgress?: number;
  conversionMessage?: string;
}

export interface VideoLoadCallbacks {
  onLoadingStateUpdate?: (state: VideoLoadState) => void;
}

export interface VideoProcessResult {
  convertedVideoUrl?: string;
  conversionMethod: "direct" | "mov-to-mp4";
}

export interface CachedVideo {
  objectUrl: string;
  mime: string;
  from: "direct" | "converted";
}

export const MAX_VIDEO_CACHE_ENTRIES = 20;
export const FFMPEG_CORE_JS_URL = "https://images.felixwliu.cn/ffmpeg-core.js";
export const FFMPEG_CORE_WASM_URL = "https://images.felixwliu.cn/ffmpeg-core.wasm";

export const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mov: "video/quicktime",
  mp4: "video/mp4",
};
