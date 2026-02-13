/// <reference types="@cloudflare/workers-types" />

interface Env {
  GITHUB_TOKEN: string;
  GH_OWNER: string;
  GH_REPO: string;
  GH_BRANCH: string;
  ALLOW_ORIGIN: string;
  UPLOAD_TOKEN: string;
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

interface GitHubFileResponse {
  name: string;
  path: string;
  sha: string;
  content: string;
  encoding: string;
  download_url: string | null;
  type?: string;
}

interface UploadResult {
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

interface ImageIndexEntry {
  image_id: string;
  created_at: string;
  meta_path: string;
}

interface ImageIndexFile {
  version: "1";
  updated_at: string;
  items: ImageIndexEntry[];
}

const GITHUB_API_VERSION = "2022-11-28";
const WRITE_INTERVAL_MS = 1100;
const IMAGE_INDEX_PATH = "objects/_index/images.json";

function getApiUrl(owner: string, repo: string, path: string): string {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
}

export function isValidImageId(imageId: string): boolean {
  return /^sha256:[a-f0-9]{64}$/i.test(imageId);
}

export function imageIdToObjectPath(imageId: string): string {
  const hex = imageId.replace("sha256:", "");
  const p1 = hex.slice(0, 2);
  const p2 = hex.slice(2, 4);
  return `objects/${p1}/${p2}/sha256_${hex}`;
}

export function imageIdToMetaPath(imageId: string): string {
  return `${imageIdToObjectPath(imageId)}/meta.json`;
}

export function buildImageApiUrls(imageId: string): UploadResult["urls"] {
  const encoded = encodeURIComponent(imageId);
  return {
    meta: `/api/v1/images/${encoded}`,
    thumb: `/api/v1/images/${encoded}/thumb`,
    original: `/api/v1/images/${encoded}/original`,
    live: `/api/v1/images/${encoded}/live`,
  };
}

export interface ImageListCursor {
  created_at: string;
  image_id: string;
}

export function encodeImageListCursor(cursor: ImageListCursor): string {
  return btoa(JSON.stringify(cursor));
}

export function decodeImageListCursor(cursor: string): ImageListCursor | null {
  try {
    const value = JSON.parse(atob(cursor)) as ImageListCursor;
    if (!value.created_at || !value.image_id) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function guessExtension(mime: string): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "video/quicktime": "mov",
    "video/mp4": "mp4",
  };
  return mimeMap[mime] || "bin";
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

class GitHubClient {
  private env: Env;
  private lastWriteTime: number = 0;

  constructor(env: Env) {
    this.env = env;
  }

  private async waitForWriteSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastWriteTime;
    if (elapsed < WRITE_INTERVAL_MS) {
      await sleep(WRITE_INTERVAL_MS - elapsed);
    }
  }

  private getHeaders(): HeadersInit {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
      "User-Agent": "lumina-cloudflare-pages/1.0",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "Content-Type": "application/json",
    };
  }

  async putFile(path: string, content: string, message: string): Promise<void> {
    await this.waitForWriteSlot();

    const url = getApiUrl(this.env.GH_OWNER, this.env.GH_REPO, path);
    let existingSha: string | undefined;

    try {
      const existing = await this.getFile(path);
      existingSha = existing.sha;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "File not found") {
        throw error;
      }
    }

    const response = await fetch(url, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({
        message,
        content,
        branch: this.env.GH_BRANCH,
        sha: existingSha,
      }),
    });

    this.lastWriteTime = Date.now();

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub PUT failed: ${response.status} ${text}`);
    }
  }

  async deleteFile(path: string, message: string): Promise<void> {
    await this.waitForWriteSlot();

    const url = getApiUrl(this.env.GH_OWNER, this.env.GH_REPO, path);
    const existing = await this.getFile(path);

    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getHeaders(),
      body: JSON.stringify({
        message,
        branch: this.env.GH_BRANCH,
        sha: existing.sha,
      }),
    });

    this.lastWriteTime = Date.now();

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub DELETE failed: ${response.status} ${text}`);
    }
  }

  async getFile(path: string): Promise<GitHubFileResponse> {
    const url = getApiUrl(this.env.GH_OWNER, this.env.GH_REPO, path);

    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("File not found");
      }
      const text = await response.text();
      throw new Error(`GitHub GET failed: ${response.status} ${text}`);
    }

    return response.json();
  }

  async listDirectory(path: string): Promise<GitHubFileResponse[]> {
    const url = getApiUrl(this.env.GH_OWNER, this.env.GH_REPO, path);

    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      const text = await response.text();
      throw new Error(`GitHub list failed: ${response.status} ${text}`);
    }

    return response.json();
  }

  async getImageIndex(): Promise<ImageIndexFile | null> {
    try {
      const file = await this.getFile(IMAGE_INDEX_PATH);
      const content = atob(file.content);
      const parsed = JSON.parse(content) as Partial<ImageIndexFile>;

      if (!Array.isArray(parsed.items)) {
        return null;
      }

      return {
        version: "1",
        updated_at: parsed.updated_at || new Date().toISOString(),
        items: parsed.items
          .filter((item): item is ImageIndexEntry => {
            return (
              typeof item?.image_id === "string" &&
              typeof item?.created_at === "string" &&
              typeof item?.meta_path === "string"
            );
          })
          .sort((a, b) => {
            const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            if (timeDiff !== 0) return timeDiff;
            return b.image_id.localeCompare(a.image_id);
          }),
      };
    } catch (error) {
      if (error instanceof Error && error.message === "File not found") {
        return null;
      }
      throw error;
    }
  }

  async upsertImageIndex(metadata: ImageMetadata, metaPath: string): Promise<void> {
    const existing =
      (await this.getImageIndex()) ||
      ({
        version: "1",
        updated_at: new Date().toISOString(),
        items: [],
      } as ImageIndexFile);

    const nextItems = existing.items.filter((item) => item.image_id !== metadata.image_id);
    nextItems.push({
      image_id: metadata.image_id,
      created_at: metadata.timestamps.created_at,
      meta_path: metaPath,
    });

    nextItems.sort((a, b) => {
      const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.image_id.localeCompare(a.image_id);
    });

    const nextIndex: ImageIndexFile = {
      version: "1",
      updated_at: new Date().toISOString(),
      items: nextItems,
    };

    const bytes = new TextEncoder().encode(JSON.stringify(nextIndex, null, 2));
    const b64 = bytesToBase64(bytes);
    await this.putFile(IMAGE_INDEX_PATH, b64, `Update image index: ${metadata.image_id}`);
  }

  async removeImageIndex(imageId: string): Promise<void> {
    const existing = await this.getImageIndex();
    if (!existing) {
      return;
    }

    const nextItems = existing.items.filter((item) => item.image_id !== imageId);
    if (nextItems.length === existing.items.length) {
      return;
    }

    const nextIndex: ImageIndexFile = {
      version: "1",
      updated_at: new Date().toISOString(),
      items: nextItems,
    };

    const bytes = new TextEncoder().encode(JSON.stringify(nextIndex, null, 2));
    const b64 = bytesToBase64(bytes);
    await this.putFile(IMAGE_INDEX_PATH, b64, `Remove image from index: ${imageId}`);
  }

  async uploadImage(
    original: Uint8Array,
    originalMime: string,
    thumb: Uint8Array,
    metadata: ImageMetadata,
    liveVideo?: { bytes: Uint8Array; mime: string }
  ): Promise<{ originalPath: string; thumbPath: string; liveVideoPath?: string; metaPath: string }> {
    const objectDir = imageIdToObjectPath(metadata.image_id);
    const ext = guessExtension(originalMime);

    const originalPath = `${objectDir}/original.${ext}`;
    const thumbPath = `${objectDir}/thumb.webp`;
    const liveVideoPath = liveVideo
      ? `${objectDir}/live.${guessExtension(liveVideo.mime)}`
      : undefined;
    const metaPath = `${objectDir}/meta.json`;

    const originalB64 = bytesToBase64(original);
    const thumbB64 = bytesToBase64(thumb);
    const liveVideoB64 = liveVideo ? bytesToBase64(liveVideo.bytes) : undefined;
    metadata.files.original.path = originalPath;
    metadata.files.thumb.path = thumbPath;
    if (liveVideoPath && metadata.files.live_video) {
      metadata.files.live_video.path = liveVideoPath;
    }
    const metaBytes = new TextEncoder().encode(JSON.stringify(metadata, null, 2));
    const metaB64 = bytesToBase64(metaBytes);

    await this.putFile(originalPath, originalB64, `Upload ${metadata.image_id} - original`);
    await sleep(WRITE_INTERVAL_MS);
    await this.putFile(thumbPath, thumbB64, `Upload ${metadata.image_id} - thumbnail`);
    await sleep(WRITE_INTERVAL_MS);
    if (liveVideoPath && liveVideoB64) {
      await this.putFile(liveVideoPath, liveVideoB64, `Upload ${metadata.image_id} - live video`);
      await sleep(WRITE_INTERVAL_MS);
    }
    await this.putFile(metaPath, metaB64, `Upload ${metadata.image_id} - metadata`);
    await sleep(WRITE_INTERVAL_MS);
    await this.upsertImageIndex(metadata, metaPath);

    return { originalPath, thumbPath, liveVideoPath, metaPath };
  }

  async deleteImageAssets(metadata: ImageMetadata): Promise<string[]> {
    const imageId = metadata.image_id;
    const objectDir = imageIdToObjectPath(imageId);
    const fallbackOriginalPath = `${objectDir}/original.${guessExtension(metadata.files.original.mime)}`;
    const fallbackThumbPath = `${objectDir}/thumb.webp`;
    const fallbackLivePath = metadata.files.live_video
      ? `${objectDir}/live.${guessExtension(metadata.files.live_video.mime)}`
      : undefined;
    const paths = [
      metadata.files.original.path || fallbackOriginalPath,
      metadata.files.thumb.path || fallbackThumbPath,
      metadata.files.live_video?.path || fallbackLivePath,
      imageIdToMetaPath(imageId),
    ].filter((path): path is string => Boolean(path));
    const uniquePaths = Array.from(new Set(paths));
    const deletedPaths: string[] = [];

    for (const path of uniquePaths) {
      try {
        await this.deleteFile(path, `Delete ${imageId} - ${path}`);
        deletedPaths.push(path);
        await sleep(WRITE_INTERVAL_MS);
      } catch (error) {
        if (error instanceof Error && error.message.includes("File not found")) {
          continue;
        }
        throw error;
      }
    }

    await this.removeImageIndex(imageId);
    return deletedPaths;
  }
}

export function corsHeaders(env: Env): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Upload-Token",
    "Access-Control-Max-Age": "86400",
  };
}

export function validateUploadToken(request: Request, env: Env): Response | null {
  const expectedToken = env.UPLOAD_TOKEN?.trim();
  if (!expectedToken) {
    return errorResponse(env, "Server upload token is not configured", 500);
  }

  const providedToken = request.headers.get("x-upload-token")?.trim();
  if (!providedToken) {
    return errorResponse(env, "Missing upload token", 401);
  }

  if (providedToken !== expectedToken) {
    return errorResponse(env, "Invalid upload token", 403);
  }

  return null;
}

export function jsonResponse(env: Env, data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(env: Env, message: string, status: number = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json",
    },
  });
}

export function createGitHubClient(env: Env): GitHubClient {
  return new GitHubClient(env);
}

export type { Env, UploadResult };
