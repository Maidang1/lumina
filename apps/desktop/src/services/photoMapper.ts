import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageMetadata, Photo } from "@/types/photo";

interface LocalRepoConfig {
  repoPath: string;
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
  };
  return mimeMap[mime] || "bin";
}

function imageIdToObjectPath(imageId: string): string {
  const hex = imageId.replace("sha256:", "");
  const p1 = hex.slice(0, 2);
  const p2 = hex.slice(2, 4);
  return `objects/${p1}/${p2}/sha256_${hex}`;
}

function getOriginalPath(metadata: ImageMetadata): string {
  if (metadata.files.original.path) {
    return metadata.files.original.path;
  }
  const objectPath = imageIdToObjectPath(metadata.image_id);
  const ext = guessExtension(metadata.files.original.mime);
  return `${objectPath}/original.${ext}`;
}

function getThumbPath(metadata: ImageMetadata): string {
  if (metadata.files.thumb.path) {
    return metadata.files.thumb.path;
  }
  const objectPath = imageIdToObjectPath(metadata.image_id);
  return `${objectPath}/thumb.webp`;
}

function formatShutter(exposureTime?: number): string {
  if (!exposureTime || exposureTime <= 0) {
    return "?s";
  }
  if (exposureTime >= 1) {
    return `${exposureTime.toFixed(1)}s`;
  }
  const denominator = Math.round(1 / exposureTime);
  return `1/${denominator}s`;
}

function extractPrimaryRegion(metadata: ImageMetadata): string {
  const region = metadata.geo?.region;
  if (!region) {
    return "";
  }
  if (region.province?.trim()) {
    return region.province.trim();
  }
  if (region.country?.trim()) {
    return region.country.trim();
  }
  if (region.display_name?.trim()) {
    const raw = region.display_name.trim();
    return raw.split(/[·,，/]/)[0]?.trim() || raw;
  }
  return "";
}

export function metadataToPhoto(
  metadata: ImageMetadata,
  localRepo: LocalRepoConfig,
): Photo {
  const date = metadata.exif?.DateTimeOriginal
    ? metadata.exif.DateTimeOriginal.split("T")[0]
    : new Date(metadata.timestamps.created_at).toISOString().split("T")[0];

  const originalPath = getOriginalPath(metadata);
  const thumbPath = getThumbPath(metadata);

  const repoPath = localRepo.repoPath.replace(/\/+$/, "");
  const originalFullPath = `${repoPath}/${originalPath}`;
  const thumbFullPath = `${repoPath}/${thumbPath}`;

  const originalUrl = convertFileSrc(originalFullPath);
  const thumbUrl = convertFileSrc(thumbFullPath);

  return {
    id: metadata.image_id,
    url: originalUrl,
    thumbnail: thumbUrl,
    thumbnailSrcSet: undefined,
    thumbnailSizes: undefined,
    title: metadata.original_filename || metadata.exif?.Model || "Untitled",
    location: extractPrimaryRegion(metadata),
    category: metadata.category || "",
    width: metadata.derived.dimensions.width,
    height: metadata.derived.dimensions.height,
    visualDescription: metadata.description || "",
    filename: metadata.original_filename || metadata.image_id.slice(7, 20),
    format: metadata.files.original.mime.split("/")[1]?.toUpperCase() || "IMG",
    size: `${(metadata.files.original.bytes / 1024 / 1024).toFixed(1)}MB`,
    exif: {
      camera: metadata.exif?.Model || "Unknown",
      lens: metadata.exif?.LensModel || "Unknown",
      iso: metadata.exif?.ISO || 0,
      aperture: metadata.exif?.FNumber
        ? metadata.exif.FNumber.toString()
        : "?",
      shutter: formatShutter(metadata.exif?.ExposureTime),
      focalLength: metadata.exif?.FocalLength
        ? `${metadata.exif.FocalLength}mm`
        : "?mm",
      date: metadata.exif?.DateTimeOriginal || date,
    },
    metadata,
  };
}
