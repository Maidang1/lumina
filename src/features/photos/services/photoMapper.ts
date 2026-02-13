import { ImageMetadata, Photo } from "@/features/photos/types";

const GH_OWNER = "Maidang1";
const GH_REPO = "photos";
const GH_BRANCH = "main";

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

function toRawGitHubUrl(path: string): string {
  const normalizedPath = path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${normalizedPath}`;
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

  return {
    id: metadata.image_id,
    url: toRawGitHubUrl(getOriginalPath(metadata)),
    thumbnail: toRawGitHubUrl(getThumbPath(metadata)),
    title: metadata.exif?.Model || "Untitled",
    location: "",
    category: "",
    width: metadata.derived.dimensions.width,
    height: metadata.derived.dimensions.height,
    visualDescription: metadata.derived.ocr?.summary || "",
    filename: metadata.image_id.slice(7, 20),
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
