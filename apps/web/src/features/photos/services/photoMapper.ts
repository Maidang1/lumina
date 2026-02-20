import { ImageMetadata, Photo } from "@/features/photos/types";

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

export function metadataToPhoto(metadata: ImageMetadata): Photo {
  const date = metadata.exif?.DateTimeOriginal
    ? metadata.exif.DateTimeOriginal.split("T")[0]
    : new Date(metadata.timestamps.created_at).toISOString().split("T")[0];

  const isLive = Boolean(metadata.files.live_video?.path);
  const liveUrl = metadata.files.live_video?.path
    ? `/api/v1/images/${encodeURIComponent(metadata.image_id)}/live`
    : undefined;
  return {
    id: metadata.image_id,
    url: `/api/v1/images/${encodeURIComponent(metadata.image_id)}/original`,
    thumbnail: `/api/v1/images/${encodeURIComponent(metadata.image_id)}/thumb`,
    isLive,
    liveUrl,
    liveMime: metadata.files.live_video?.mime,
    videoSource: liveUrl
      ? {
          type: "live-photo",
          videoUrl: liveUrl,
          mime: metadata.files.live_video?.mime,
        }
      : { type: "none" },
    title: metadata.original_filename || metadata.exif?.Model || "Untitled",
    location: metadata.geo?.region?.display_name || "",
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
      aperture: metadata.exif?.FNumber ? `f/${metadata.exif.FNumber}` : "f/?",
      shutter: formatShutter(metadata.exif?.ExposureTime),
      focalLength: metadata.exif?.FocalLength ? `${metadata.exif.FocalLength}mm` : "?mm",
      date,
    },
    metadata,
  };
}
