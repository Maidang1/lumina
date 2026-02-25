import type { ImageListCursor, UploadResult } from "./types";

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
  };
}

export function encodeImageListCursor(cursor: ImageListCursor): string {
  return btoa(JSON.stringify(cursor));
}

export function decodeImageListCursor(cursor: string): ImageListCursor | null {
  try {
    const value = JSON.parse(atob(cursor)) as Partial<ImageListCursor>;
    if (!value.created_at || !value.image_id) {
      return null;
    }
    return {
      created_at: value.created_at,
      image_id: value.image_id,
    };
  } catch {
    return null;
  }
}
