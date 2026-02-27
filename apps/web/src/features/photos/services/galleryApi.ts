import type { ImageListResponse, ImageMetadata, UploadError } from "@/features/photos/types";

interface GalleryApiOptions {
  apiUrl: string;
}

const DEFAULT_OPTIONS: GalleryApiOptions = {
  apiUrl: "/api",
};

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

class GalleryApi {
  private options: GalleryApiOptions;

  constructor(options: Partial<GalleryApiOptions> = {}) {
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

  async listImages(cursor?: string, limit: number = 20): Promise<ImageListResponse> {
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
}

export const galleryApi = new GalleryApi();
