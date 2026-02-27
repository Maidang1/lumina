import {
  BatchFinalizeResult,
  ImageListResponse,
  ImageMetadata,
  UploadError,
  UploadResult,
} from "@/types/photo";
import { tauriStorage } from "@/lib/tauri/storage";
import {
  uploadImageToGitHub,
  deleteImageFromGitHub,
  finalizeBatchToGitHub,
  listImagesFromGitHub,
  updateImageMetadataInRepo,
  getRepoStatus,
  commitAndPushRepo,
  syncRepo as syncRepoInTauri,
} from "@/lib/tauri/github";
import { uploadFromCacheToGithub } from "@/lib/tauri/image";
import { logger } from "@/lib/logger";

interface UploadOptions {
  apiUrl: string;
  timeout: number;
}

interface DeleteImageResult {
  image_id: string;
  deleted_paths: string[];
}

interface SignedShareResult {
  url: string;
  expires_in_seconds: number;
  type: "original" | "thumb";
}

const DEFAULT_OPTIONS: UploadOptions = {
  apiUrl: "/api",
  timeout: 120000,
};

const REPO_PATH_STORAGE_KEY = "lumina.git_repo_path";

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

class UploadService {
  private options: UploadOptions;

  constructor(options: Partial<UploadOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private getEndpoint(path: string): string {
    const base = this.options.apiUrl.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }

  private getImagePath(imageId: string): string {
    return `/v1/images/${encodeURIComponent(imageId)}`;
  }

  private buildImageApiUrls(imageId: string): UploadResult["urls"] {
    const encoded = encodeURIComponent(imageId);
    return {
      meta: `/api/v1/images/${encoded}`,
      thumb: `/api/v1/images/${encoded}/thumb`,
      original: `/api/v1/images/${encoded}/original`,
    };
  }

  async getRepoPath(): Promise<string> {
    return (await tauriStorage.getItem(REPO_PATH_STORAGE_KEY)) || "";
  }

  async hasRepoPath(): Promise<boolean> {
    if (!isTauriEnvironment()) {
      const repoPath = await this.getRepoPath();
      return repoPath.trim().length > 0;
    }
    try {
      await getRepoStatus();
      return true;
    } catch {
      return false;
    }
  }

  async setRepoPath(repoPath: string): Promise<void> {
    const normalized = repoPath.trim();
    if (!normalized) {
      await tauriStorage.removeItem(REPO_PATH_STORAGE_KEY);
      return;
    }
    await tauriStorage.setItem(REPO_PATH_STORAGE_KEY, normalized);
  }

  async getRepoStatus() {
    return getRepoStatus();
  }

  async commitAndPush(message?: string): Promise<string> {
    return commitAndPushRepo(message);
  }

  async syncRepo(): Promise<string> {
    return syncRepoInTauri();
  }

  // Backward-compatible aliases. Use repo-path terminology in new code.
  async getUploadToken(): Promise<string> {
    return this.getRepoPath();
  }

  async hasUploadToken(): Promise<boolean> {
    return this.hasRepoPath();
  }

  async setUploadToken(token: string): Promise<void> {
    await this.setRepoPath(token);
  }

  private async parseJson<T>(
    response: Response,
    fallbackMessage: string,
  ): Promise<T> {
    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new ApiRequestError(fallbackMessage, response.status);
    }

    if (!response.ok) {
      const err = payload as UploadError;
      const message = err.message || err.error || fallbackMessage;
      throw new ApiRequestError(message, response.status);
    }

    return payload as T;
  }

  async uploadImage(
    original: File | Blob,
    thumb: Blob,
    metadata: ImageMetadata,
    thumbVariantBlobs?: Partial<Record<"400" | "800" | "1600", Blob>>,
    onProgress?: (progress: number) => void,
    options?: { deferFinalize?: boolean },
  ): Promise<UploadResult> {
    const isTauri = isTauriEnvironment();

    if (isTauri) {
      // 使用 Rust 后端直接上传到 GitHub
      return this.uploadImageViaGitHub(
        original,
        thumb,
        metadata,
        thumbVariantBlobs,
        onProgress,
        options,
      );
    } else {
      // 使用现有的 HTTP API（Web 端或开发模式）
      return this.uploadImageViaHttp(
        original,
        thumb,
        metadata,
        thumbVariantBlobs,
        onProgress,
        options,
      );
    }
  }

  async uploadImageFromCache(options: {
    imageId: string;
    originalPath: string;
    originalMime: string;
    thumbPath: string;
    metadata: ImageMetadata;
    thumbVariantPaths?: Partial<Record<"400" | "800" | "1600", string>>;
    deferFinalize?: boolean;
    onProgress?: (progress: number) => void;
  }): Promise<UploadResult> {
    const isTauri = isTauriEnvironment();

    if (isTauri) {
      // 使用优化版本：直接从缓存路径上传
      return this.uploadImageFromCacheViaRust(options);
    } else {
      throw new ApiRequestError(
        "Optimized upload only available in Tauri environment",
        400,
      );
    }
  }

  private async uploadImageFromCacheViaRust(options: {
    imageId: string;
    originalPath: string;
    originalMime: string;
    thumbPath: string;
    metadata: ImageMetadata;
    thumbVariantPaths?: Partial<Record<"400" | "800" | "1600", string>>;
    deferFinalize?: boolean;
    onProgress?: (progress: number) => void;
  }): Promise<UploadResult> {
    try {
      if (options.onProgress) {
        options.onProgress(10);
      }

      logger.debug(
        "[uploadService] Starting optimized GitHub upload for image:",
        options.imageId,
      );

      const cacheUploadRequest = {
        imageId: options.imageId,
        originalPath: options.originalPath,
        originalMime: options.originalMime,
        thumbPath: options.thumbPath,
        thumbVariants: options.thumbVariantPaths || {},
        metadata: JSON.stringify(options.metadata),
        deferFinalize: options.deferFinalize ?? false,
      };

      const results = await uploadFromCacheToGithub([cacheUploadRequest]);
      const result = results[0];

      if (options.onProgress) {
        options.onProgress(100);
      }

      if (!result.success) {
        logger.error("[uploadService] Upload failed:", result.message);
        throw new ApiRequestError(result.message || "Upload failed", 500);
      }

      logger.debug("[uploadService] Optimized upload successful");

      return {
        image_id: result.imageId,
        stored: {
          original_path: "",
          thumb_path: "",
          meta_path: "",
        },
        urls: this.buildImageApiUrls(result.imageId),
      };
    } catch (error) {
      logger.error("[uploadService] Optimized upload error:", error);
      if (error instanceof ApiRequestError) {
        throw error;
      }
      throw new ApiRequestError(
        error instanceof Error ? error.message : "Upload failed",
        500,
      );
    }
  }

  private async uploadImageViaGitHub(
    original: File | Blob,
    thumb: Blob,
    metadata: ImageMetadata,
    thumbVariantBlobs?: Partial<Record<"400" | "800" | "1600", Blob>>,
    onProgress?: (progress: number) => void,
    options?: { deferFinalize?: boolean },
  ): Promise<UploadResult> {
    logger.debug(
      "[uploadService] Starting GitHub upload for image:",
      metadata.image_id,
    );
    const originalName =
      original instanceof File
        ? original.name
        : `${metadata.image_id}-original`;
    logger.debug(
      "[uploadService] Original file:",
      originalName,
      original.size,
      "bytes",
    );
    logger.debug("[uploadService] Thumb size:", thumb.size, "bytes");

    try {
      // 读取文件为 Uint8Array
      logger.debug("[uploadService] Reading file buffers...");
      const originalBuffer = new Uint8Array(await original.arrayBuffer());
      const thumbBuffer = new Uint8Array(await thumb.arrayBuffer());

      const thumbVariants: Record<string, Uint8Array> = {};
      if (thumbVariantBlobs) {
        for (const [size, blob] of Object.entries(thumbVariantBlobs)) {
          if (blob) {
            logger.debug(
              `[uploadService] Reading thumb variant ${size}:`,
              blob.size,
              "bytes",
            );
            thumbVariants[size] = new Uint8Array(await blob.arrayBuffer());
          }
        }
      }

      // 模拟进度
      if (onProgress) {
        onProgress(10);
      }

      logger.debug("[uploadService] Calling uploadImageToGitHub...");
      const result = await uploadImageToGitHub({
        imageId: metadata.image_id,
        original: originalBuffer,
        originalMime: original.type,
        thumb: thumbBuffer,
        thumbVariants,
        metadata: JSON.stringify(metadata),
        deferFinalize: options?.deferFinalize ?? false,
      });

      logger.debug("[uploadService] Upload result:", result);

      if (onProgress) {
        onProgress(100);
      }

      if (!result.success) {
        logger.error("[uploadService] Upload failed:", result.message);
        throw new ApiRequestError(result.message || "Upload failed", 500);
      }

      logger.debug("[uploadService] Upload successful, returning result");

      return {
        image_id: result.image_id,
        stored: {
          original_path: result.stored.original_path,
          thumb_path: result.stored.thumb_path,
          meta_path: result.stored.meta_path,
        },
        urls: this.buildImageApiUrls(result.image_id),
      };
    } catch (error) {
      logger.error("[uploadService] Upload error:", error);
      if (error instanceof ApiRequestError) {
        throw error;
      }
      throw new ApiRequestError(
        error instanceof Error ? error.message : "Upload failed",
        500,
      );
    }
  }

  private async uploadImageViaHttp(
    original: File | Blob,
    thumb: Blob,
    metadata: ImageMetadata,
    thumbVariantBlobs?: Partial<Record<"400" | "800" | "1600", Blob>>,
    onProgress?: (progress: number) => void,
    options?: { deferFinalize?: boolean },
  ): Promise<UploadResult> {
    const uploadToken = await this.getRepoPath();
    if (!uploadToken) {
      throw new ApiRequestError(
        "Missing repository path. Please configure it before upload.",
        401,
      );
    }

    const formData = new FormData();
    formData.append(
      "original",
      original,
      original instanceof File ? original.name : `${metadata.image_id}.bin`,
    );
    formData.append("thumb", thumb, "thumb.webp");
    if (thumbVariantBlobs) {
      for (const size of ["400", "800", "1600"] as const) {
        const variant = thumbVariantBlobs[size];
        if (variant) {
          formData.append(`thumb_${size}`, variant, `thumb-${size}.webp`);
        }
      }
    }
    formData.append("metadata", JSON.stringify(metadata));
    if (options?.deferFinalize) {
      formData.append("defer_finalize", "true");
    }
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        const fallbackMessage =
          xhr.status >= 200 && xhr.status < 300
            ? "Failed to parse upload response"
            : `Upload failed: ${xhr.status}`;

        let parsed: unknown;
        try {
          parsed = JSON.parse(xhr.responseText);
        } catch {
          reject(new ApiRequestError(fallbackMessage, xhr.status || 0));
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed as UploadResult);
          return;
        }

        const error = parsed as UploadError;
        reject(
          new ApiRequestError(
            error.message || error.error || fallbackMessage,
            xhr.status,
          ),
        );
      });

      xhr.addEventListener("error", () => {
        reject(new ApiRequestError("Network error during upload", 0));
      });

      xhr.addEventListener("timeout", () => {
        reject(new ApiRequestError("Upload timeout", 408));
      });

      xhr.timeout = this.options.timeout;
      xhr.open("POST", this.getEndpoint("/v1/images"));
      xhr.setRequestHeader("X-Upload-Token", uploadToken);
      xhr.send(formData);
    });
  }

  async getImage(imageId: string): Promise<ImageMetadata> {
    const response = await fetch(this.getEndpoint(this.getImagePath(imageId)));
    return this.parseJson<ImageMetadata>(
      response,
      `Failed to fetch image: ${response.status}`,
    );
  }

  getImageUrl(imageId: string, type: "original" | "thumb"): string {
    return this.getEndpoint(`${this.getImagePath(imageId)}/${type}`);
  }

  async listImages(
    cursor?: string,
    limit: number = 20,
  ): Promise<ImageListResponse> {
    const isTauri = isTauriEnvironment();

    if (isTauri) {
      // 使用 Rust 后端从 GitHub 读取
      const result = await listImagesFromGitHub(cursor, limit);
      return result;
    } else {
      // 使用现有的 HTTP API
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      params.set("limit", String(limit));

      const response = await fetch(
        this.getEndpoint(`/v1/images?${params.toString()}`),
      );
      return this.parseJson<ImageListResponse>(
        response,
        `Failed to list images: ${response.status}`,
      );
    }
  }

  async listAllImages(limitPerPage: number = 50): Promise<ImageMetadata[]> {
    const images: ImageMetadata[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.listImages(cursor, limitPerPage);
      images.push(...page.images);
      cursor = page.next_cursor;
    } while (cursor);

    return images;
  }

  async deleteImage(imageId: string): Promise<DeleteImageResult> {
    const isTauri = isTauriEnvironment();

    if (isTauri) {
      // 使用 Rust 后端从 GitHub 删除
      const result = await deleteImageFromGitHub(imageId);
      if (!result.success) {
        throw new ApiRequestError(result.message || "Delete failed", 500);
      }
      return {
        image_id: result.image_id,
        deleted_paths: [],
      };
    } else {
      // 使用现有的 HTTP API
      const uploadToken = await this.getUploadToken();
      if (!uploadToken) {
        throw new ApiRequestError(
          "Missing repository path. Please configure it before delete.",
          401,
        );
      }

      const response = await fetch(
        this.getEndpoint(this.getImagePath(imageId)),
        {
          method: "DELETE",
          headers: {
            "X-Upload-Token": uploadToken,
          },
        },
      );

      return this.parseJson<DeleteImageResult>(
        response,
        `Failed to delete image: ${response.status}`,
      );
    }
  }

  async updateImageMetadata(
    imageId: string,
    updates: Partial<
      Pick<
        ImageMetadata,
        | "description"
        | "original_filename"
        | "category"
        | "privacy"
        | "geo"
        | "processing"
      >
    >,
  ): Promise<ImageMetadata> {
    const isTauri = isTauriEnvironment();
    if (isTauri) {
      return updateImageMetadataInRepo(imageId, updates);
    }

    const uploadToken = await this.getRepoPath();
    if (!uploadToken) {
      throw new ApiRequestError(
        "Missing repository path. Please configure it before update.",
        401,
      );
    }

    const response = await fetch(this.getEndpoint(this.getImagePath(imageId)), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Upload-Token": uploadToken,
      },
      body: JSON.stringify(updates),
    });

    return this.parseJson<ImageMetadata>(
      response,
      `Failed to update metadata: ${response.status}`,
    );
  }

  async finalizeImageBatch(
    items: ImageMetadata[],
  ): Promise<BatchFinalizeResult> {
    const isTauri = isTauriEnvironment();

    if (isTauri) {
      // 使用 Rust 后端批量提交到 GitHub
      if (items.length === 0) {
        return {
          success_count: 0,
          mode: "batch_commit",
        };
      }

      const metadatas = items.map((item) => JSON.stringify(item));
      return finalizeBatchToGitHub(metadatas);
    } else {
      // 使用现有的 HTTP API
      const uploadToken = await this.getRepoPath();
      if (!uploadToken) {
        throw new ApiRequestError(
          "Missing repository path. Please configure it before finalize.",
          401,
        );
      }
      if (items.length === 0) {
        return {
          success_count: 0,
          mode: "batch_commit",
        };
      }

      const response = await fetch(
        this.getEndpoint("/v1/images/finalize-batch"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Upload-Token": uploadToken,
          },
          body: JSON.stringify({
            items: items.map((metadata) => ({ metadata })),
          }),
        },
      );

      return this.parseJson<BatchFinalizeResult>(
        response,
        `Failed to finalize batch: ${response.status}`,
      );
    }
  }

  async createSignedShareUrl(
    imageId: string,
    type: "original" | "thumb" = "original",
    expiresInSeconds: number = 24 * 60 * 60,
  ): Promise<SignedShareResult> {
    const uploadToken = await this.getRepoPath();
    if (!uploadToken) {
      throw new ApiRequestError(
        "Missing repository path. Please configure it before creating share links.",
        401,
      );
    }

    const response = await fetch(
      this.getEndpoint(`${this.getImagePath(imageId)}/share`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Upload-Token": uploadToken,
        },
        body: JSON.stringify({
          type,
          expires_in_seconds: expiresInSeconds,
        }),
      },
    );

    return this.parseJson<SignedShareResult>(
      response,
      `Failed to create signed share url: ${response.status}`,
    );
  }
}

export const uploadService = new UploadService();
