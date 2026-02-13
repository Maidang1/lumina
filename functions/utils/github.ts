import {
  Env,
  GitHubFileResponse,
  ImageIndexEntry,
  ImageIndexFile,
  ImageMetadata,
} from "./types";
import { imageIdToMetaPath, imageIdToObjectPath } from "./image";

const GITHUB_API_VERSION = "2022-11-28";
const WRITE_INTERVAL_MS = 1100;
const IMAGE_INDEX_PATH = "objects/_index/images.json";

function getApiUrl(owner: string, repo: string, path: string): string {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
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

function sortIndexEntries(items: ImageIndexEntry[]): ImageIndexEntry[] {
  return items.sort((a, b) => {
    const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.image_id.localeCompare(a.image_id);
  });
}

export class GitHubClient {
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
        items: sortIndexEntries(
          parsed.items.filter((item): item is ImageIndexEntry => {
            return (
              typeof item?.image_id === "string" &&
              typeof item?.created_at === "string" &&
              typeof item?.meta_path === "string"
            );
          })
        ),
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

    const nextIndex: ImageIndexFile = {
      version: "1",
      updated_at: new Date().toISOString(),
      items: sortIndexEntries(nextItems),
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

  async updateImageMetadata(metadata: ImageMetadata): Promise<void> {
    const metaPath = imageIdToMetaPath(metadata.image_id);
    const metaBytes = new TextEncoder().encode(JSON.stringify(metadata, null, 2));
    const metaB64 = bytesToBase64(metaBytes);
    await this.putFile(metaPath, metaB64, `Update metadata: ${metadata.image_id}`);
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

export function createGitHubClient(env: Env): GitHubClient {
  return new GitHubClient(env);
}
