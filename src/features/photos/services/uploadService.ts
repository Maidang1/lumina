import { ImageMetadata, UploadResult, UploadError, ImageListResponse } from "@/features/photos/types";

export interface UploadOptions {
  apiUrl: string;
  timeout: number;
}

const DEFAULT_OPTIONS: UploadOptions = {
  apiUrl: "/api",
  timeout: 120000,
};

const UPLOAD_TOKEN_STORAGE_KEY = "lumina.upload_token";

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export class UploadService {
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

  getUploadToken(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(UPLOAD_TOKEN_STORAGE_KEY) || "";
  }

  setUploadToken(token: string): void {
    if (typeof window === "undefined") return;
    const normalized = token.trim();
    if (!normalized) {
      window.localStorage.removeItem(UPLOAD_TOKEN_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(UPLOAD_TOKEN_STORAGE_KEY, normalized);
  }

  private async parseJson<T>(response: Response, fallbackMessage: string): Promise<T> {
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
    original: File,
    thumb: Blob,
    metadata: ImageMetadata,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    const uploadToken = this.getUploadToken();
    if (!uploadToken) {
      throw new ApiRequestError("Missing UPLOAD_TOKEN. Please configure it before upload.", 401);
    }

    const formData = new FormData();
    formData.append("original", original);
    formData.append("thumb", thumb, "thumb.webp");
    formData.append("metadata", JSON.stringify(metadata));

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        const fallbackMessage = xhr.status >= 200 && xhr.status < 300
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
        reject(new ApiRequestError(error.message || error.error || fallbackMessage, xhr.status));
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
    return this.parseJson<ImageMetadata>(response, `Failed to fetch image: ${response.status}`);
  }

  getImageUrl(imageId: string, type: "original" | "thumb"): string {
    return this.getEndpoint(`${this.getImagePath(imageId)}/${type}`);
  }

  async listImages(cursor?: string, limit: number = 20): Promise<ImageListResponse> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    params.set("limit", String(limit));

    const response = await fetch(this.getEndpoint(`/v1/images?${params.toString()}`));
    return this.parseJson<ImageListResponse>(response, `Failed to list images: ${response.status}`);
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
}

export const uploadService = new UploadService();
