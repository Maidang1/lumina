import { imageIdToMetaPath, imageIdToObjectPath } from "@lumina/contracts";
import type {
  Env,
  GitHubFileResponse,
  ImageIndexEntry,
  ImageIndexFile,
  ImageMetadata,
} from "@lumina/contracts";
import { bytesToBase64, decodeBase64Utf8 } from "./encoding";

const GITHUB_API_VERSION = "2022-11-28";
const WRITE_INTERVAL_MS = 1100;
const IMAGE_INDEX_PATH = "objects/_index/images.json";
const GIT_BATCH_MAX_ATTEMPTS = 3;

function getApiUrl(owner: string, repo: string, path: string): string {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
}

function getGitApiUrl(owner: string, repo: string, path: string): string {
  return `https://api.github.com/repos/${owner}/${repo}/git/${path}`;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sortIndexEntries(items: ImageIndexEntry[]): ImageIndexEntry[] {
  return items.sort((a, b) => {
    const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.image_id.localeCompare(a.image_id);
  });
}

export interface GitHubClientOptions {
  retryMaxAttempts?: number;
  retryBaseDelayMs?: number;
}

export class GitHubClient {
  private env: Env;
  private lastWriteTime = 0;
  private retryMaxAttempts: number;
  private retryBaseDelayMs: number;

  constructor(env: Env, options: GitHubClientOptions = {}) {
    if (!env.GITHUB_TOKEN?.trim()) {
      throw new Error("GITHUB_TOKEN is not configured");
    }
    if (!env.GH_OWNER?.trim()) {
      throw new Error("GH_OWNER is not configured");
    }
    if (!env.GH_REPO?.trim()) {
      throw new Error("GH_REPO is not configured");
    }
    if (!env.GH_BRANCH?.trim()) {
      throw new Error("GH_BRANCH is not configured");
    }

    this.env = env;
    this.retryMaxAttempts = options.retryMaxAttempts ?? 5;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 600;
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
      "User-Agent": "lumina-github-storage/1.0",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "Content-Type": "application/json",
    };
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, init);
        if (![429, 500, 502, 503, 504].includes(response.status)) {
          return response;
        }

        if (attempt === this.retryMaxAttempts) {
          return response;
        }

        const jitter = Math.floor(Math.random() * 250);
        const backoff = this.retryBaseDelayMs * 2 ** (attempt - 1) + jitter;
        await sleep(backoff);
      } catch (error) {
        lastError = error;
        if (attempt === this.retryMaxAttempts) {
          break;
        }
        const jitter = Math.floor(Math.random() * 250);
        const backoff = this.retryBaseDelayMs * 2 ** (attempt - 1) + jitter;
        await sleep(backoff);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("GitHub request failed");
  }

  private normalizeMetadataPaths(
    metadata: ImageMetadata,
    originalMime?: string,
    liveVideoMime?: string
  ): {
    originalPath: string;
    thumbPath: string;
    liveVideoPath?: string;
    metaPath: string;
  } {
    const objectDir = imageIdToObjectPath(metadata.image_id);
    const originalPath =
      metadata.files.original.path ||
      `${objectDir}/original.${guessExtension(originalMime || metadata.files.original.mime)}`;
    const thumbPath = metadata.files.thumb.path || `${objectDir}/thumb.webp`;
    const liveVideoPath = metadata.files.live_video
      ? metadata.files.live_video.path ||
        `${objectDir}/live.${guessExtension(liveVideoMime || metadata.files.live_video.mime)}`
      : undefined;
    const metaPath = imageIdToMetaPath(metadata.image_id);

    metadata.files.original.path = originalPath;
    metadata.files.thumb.path = thumbPath;
    if (liveVideoPath && metadata.files.live_video) {
      metadata.files.live_video.path = liveVideoPath;
    }

    return { originalPath, thumbPath, liveVideoPath, metaPath };
  }

  private buildNextIndex(existing: ImageIndexFile | null, metadatas: ImageMetadata[]): ImageIndexFile {
    const map = new Map<string, ImageIndexEntry>();
    if (existing?.items) {
      for (const item of existing.items) {
        map.set(item.image_id, item);
      }
    }

    for (const metadata of metadatas) {
      map.set(metadata.image_id, {
        image_id: metadata.image_id,
        created_at: metadata.timestamps.created_at,
        meta_path: imageIdToMetaPath(metadata.image_id),
      });
    }

    return {
      version: "1",
      updated_at: new Date().toISOString(),
      items: sortIndexEntries(Array.from(map.values())),
    };
  }

  private async commitFilesBatch(
    files: Array<{ path: string; contentBase64: string }>,
    message: string
  ): Promise<void> {
    if (files.length === 0) {
      return;
    }

    for (let attempt = 1; attempt <= GIT_BATCH_MAX_ATTEMPTS; attempt += 1) {
      const refUrl = getGitApiUrl(
        this.env.GH_OWNER,
        this.env.GH_REPO,
        `ref/heads/${encodeURIComponent(this.env.GH_BRANCH)}`
      );
      const refRes = await this.fetchWithRetry(refUrl, {
        method: "GET",
        headers: this.getHeaders(),
      });
      if (!refRes.ok) {
        const text = await refRes.text();
        throw new Error(`GitHub ref lookup failed: ${refRes.status} ${text}`);
      }
      const refData = (await refRes.json()) as { object?: { sha?: string } };
      const headSha = refData.object?.sha;
      if (!headSha) {
        throw new Error("GitHub ref lookup failed: missing head sha");
      }

      const commitUrl = getGitApiUrl(this.env.GH_OWNER, this.env.GH_REPO, `commits/${headSha}`);
      const commitRes = await this.fetchWithRetry(commitUrl, {
        method: "GET",
        headers: this.getHeaders(),
      });
      if (!commitRes.ok) {
        const text = await commitRes.text();
        throw new Error(`GitHub commit lookup failed: ${commitRes.status} ${text}`);
      }
      const commitData = (await commitRes.json()) as { tree?: { sha?: string } };
      const baseTreeSha = commitData.tree?.sha;
      if (!baseTreeSha) {
        throw new Error("GitHub commit lookup failed: missing base tree sha");
      }

      const treeEntries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string }> = [];
      for (const file of files) {
        const blobUrl = getGitApiUrl(this.env.GH_OWNER, this.env.GH_REPO, "blobs");
        const blobRes = await this.fetchWithRetry(blobUrl, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({
            content: file.contentBase64,
            encoding: "base64",
          }),
        });
        if (!blobRes.ok) {
          const text = await blobRes.text();
          throw new Error(`GitHub blob create failed: ${blobRes.status} ${text}`);
        }
        const blobData = (await blobRes.json()) as { sha?: string };
        if (!blobData.sha) {
          throw new Error("GitHub blob create failed: missing blob sha");
        }
        treeEntries.push({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: blobData.sha,
        });
      }

      const treeUrl = getGitApiUrl(this.env.GH_OWNER, this.env.GH_REPO, "trees");
      const treeRes = await this.fetchWithRetry(treeUrl, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
      });
      if (!treeRes.ok) {
        const text = await treeRes.text();
        throw new Error(`GitHub tree create failed: ${treeRes.status} ${text}`);
      }
      const treeData = (await treeRes.json()) as { sha?: string };
      if (!treeData.sha) {
        throw new Error("GitHub tree create failed: missing tree sha");
      }

      const createCommitUrl = getGitApiUrl(this.env.GH_OWNER, this.env.GH_REPO, "commits");
      const createCommitRes = await this.fetchWithRetry(createCommitUrl, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          message,
          tree: treeData.sha,
          parents: [headSha],
        }),
      });
      if (!createCommitRes.ok) {
        const text = await createCommitRes.text();
        throw new Error(`GitHub commit create failed: ${createCommitRes.status} ${text}`);
      }
      const createCommitData = (await createCommitRes.json()) as { sha?: string };
      if (!createCommitData.sha) {
        throw new Error("GitHub commit create failed: missing commit sha");
      }

      const updateRefUrl = getGitApiUrl(
        this.env.GH_OWNER,
        this.env.GH_REPO,
        `refs/heads/${encodeURIComponent(this.env.GH_BRANCH)}`
      );
      const updateRefRes = await this.fetchWithRetry(updateRefUrl, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify({
          sha: createCommitData.sha,
          force: false,
        }),
      });
      if (updateRefRes.ok) {
        this.lastWriteTime = Date.now();
        return;
      }

      if ([409, 422].includes(updateRefRes.status) && attempt < GIT_BATCH_MAX_ATTEMPTS) {
        await sleep(this.retryBaseDelayMs * attempt);
        continue;
      }

      const text = await updateRefRes.text();
      throw new Error(`GitHub ref update failed: ${updateRefRes.status} ${text}`);
    }
  }

  async getFile(path: string): Promise<GitHubFileResponse> {
    const url = getApiUrl(this.env.GH_OWNER, this.env.GH_REPO, path);
    const response = await this.fetchWithRetry(url, { method: "GET", headers: this.getHeaders() });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("File not found");
      }
      const text = await response.text();
      throw new Error(`GitHub GET failed: ${response.status} ${text}`);
    }

    return response.json() as Promise<GitHubFileResponse>;
  }

  async listDirectory(path: string): Promise<GitHubFileResponse[]> {
    const url = getApiUrl(this.env.GH_OWNER, this.env.GH_REPO, path);
    const response = await this.fetchWithRetry(url, { method: "GET", headers: this.getHeaders() });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      const text = await response.text();
      throw new Error(`GitHub list failed: ${response.status} ${text}`);
    }

    return response.json() as Promise<GitHubFileResponse[]>;
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

    const response = await this.fetchWithRetry(url, {
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

    const response = await this.fetchWithRetry(url, {
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

  async getImageIndex(): Promise<ImageIndexFile | null> {
    try {
      const file = await this.getFile(IMAGE_INDEX_PATH);
      const content = decodeBase64Utf8(file.content);
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
    if (!existing) return;

    const nextItems = existing.items.filter((item) => item.image_id !== imageId);
    if (nextItems.length === existing.items.length) return;

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
    liveVideo?: { bytes: Uint8Array; mime: string },
    options?: { deferFinalize?: boolean }
  ): Promise<{ originalPath: string; thumbPath: string; liveVideoPath?: string; metaPath: string }> {
    const { originalPath, thumbPath, liveVideoPath, metaPath } = this.normalizeMetadataPaths(
      metadata,
      originalMime,
      liveVideo?.mime
    );

    const originalB64 = bytesToBase64(original);
    const thumbB64 = bytesToBase64(thumb);
    const liveVideoB64 = liveVideo ? bytesToBase64(liveVideo.bytes) : undefined;

    await this.putFile(originalPath, originalB64, `Upload ${metadata.image_id} - original`);
    await sleep(WRITE_INTERVAL_MS);
    await this.putFile(thumbPath, thumbB64, `Upload ${metadata.image_id} - thumbnail`);
    await sleep(WRITE_INTERVAL_MS);
    if (liveVideoPath && liveVideoB64) {
      await this.putFile(liveVideoPath, liveVideoB64, `Upload ${metadata.image_id} - live video`);
      await sleep(WRITE_INTERVAL_MS);
    }

    if (!options?.deferFinalize) {
      await this.updateImageMetadataWithIndex(metadata);
    }

    return { originalPath, thumbPath, liveVideoPath, metaPath };
  }

  async updateImageMetadata(metadata: ImageMetadata): Promise<void> {
    this.normalizeMetadataPaths(metadata);
    const metaPath = imageIdToMetaPath(metadata.image_id);
    const metaBytes = new TextEncoder().encode(JSON.stringify(metadata, null, 2));
    const metaB64 = bytesToBase64(metaBytes);
    await this.putFile(metaPath, metaB64, `Update metadata: ${metadata.image_id}`);
  }

  async updateImageMetadataWithIndex(metadata: ImageMetadata): Promise<void> {
    await this.updateImageMetadata(metadata);
    await sleep(WRITE_INTERVAL_MS);
    await this.upsertImageIndex(metadata, imageIdToMetaPath(metadata.image_id));
  }

  async finalizeImageMetadataBatch(metadatas: ImageMetadata[]): Promise<void> {
    if (metadatas.length === 0) {
      return;
    }

    const normalized = metadatas.map((metadata) => {
      this.normalizeMetadataPaths(metadata);
      return metadata;
    });

    const existingIndex = await this.getImageIndex();
    const nextIndex = this.buildNextIndex(existingIndex, normalized);
    const indexBytes = new TextEncoder().encode(JSON.stringify(nextIndex, null, 2));

    const files: Array<{ path: string; contentBase64: string }> = normalized.map((metadata) => {
      const metaBytes = new TextEncoder().encode(JSON.stringify(metadata, null, 2));
      return {
        path: imageIdToMetaPath(metadata.image_id),
        contentBase64: bytesToBase64(metaBytes),
      };
    });

    files.push({
      path: IMAGE_INDEX_PATH,
      contentBase64: bytesToBase64(indexBytes),
    });

    await this.commitFilesBatch(files, `Finalize ${normalized.length} image metadata entries`);
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

export function createGitHubClient(env: Env, options?: GitHubClientOptions): GitHubClient {
  return new GitHubClient(env, options);
}
