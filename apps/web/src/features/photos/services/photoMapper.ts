import { ImageMetadata, Photo } from "@/features/photos/types";

const DEFAULT_GH_OWNER = "Maidang1";
const DEFAULT_GH_REPO = "photos";
const DEFAULT_GH_BRANCH = "main";

interface RuntimeProcessLike {
  env?: Record<string, string | undefined>;
}

function getRuntimeEnv(name: string): string | undefined {
  const processLike = (globalThis as { process?: RuntimeProcessLike }).process;
  return processLike?.env?.[name];
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

function buildFallbackApiAssetUrl(
  imageId: string,
  type: "original" | "thumb",
  version: string,
  cacheBust: string,
): string {
  return `/api/v1/images/${encodeURIComponent(imageId)}/${type}?v=${version}&cb=${cacheBust}`;
}

function buildJsDelivrUrl(path?: string): string | undefined {
  if (!path) {
    return undefined;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const owner = (getRuntimeEnv("RSBUILD_GH_OWNER") || DEFAULT_GH_OWNER).trim();
  const repo = (getRuntimeEnv("RSBUILD_GH_REPO") || DEFAULT_GH_REPO).trim();
  const branch = (
    getRuntimeEnv("RSBUILD_GH_BRANCH") || DEFAULT_GH_BRANCH
  ).trim();

  if (!owner || !repo || !branch) {
    return undefined;
  }

  const normalizedPath = path.replace(/^\/+/, "");
  const encodedPath = encodeURIComponent(normalizedPath).replace(/%2F/g, "/");
  return `https://cdn.jsdelivr.net/gh/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}@${encodeURIComponent(branch)}/${encodedPath}`;
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

function buildThumbSrcSet(
  metadata: ImageMetadata,
  version: string,
  cacheBust: string,
): string | undefined {
  const directCandidates: Array<[string | undefined, number]> = [
    [metadata.files.thumb_variants?.["400"]?.path, 400],
    [metadata.files.thumb_variants?.["800"]?.path, 800],
    [metadata.files.thumb_variants?.["1600"]?.path, 1600],
  ];
  const directEntries = directCandidates
    .map(([path, width]) => {
      const cdnUrl = buildJsDelivrUrl(path);
      if (!cdnUrl) {
        return undefined;
      }
      return `${cdnUrl}?v=${version}&cb=${cacheBust} ${width}w`;
    })
    .filter((item): item is string => Boolean(item));

  if (directEntries.length > 0) {
    return directEntries.join(", ");
  }

  const hasVariants = Boolean(
    metadata.files.thumb_variants?.["400"] ||
    metadata.files.thumb_variants?.["800"] ||
    metadata.files.thumb_variants?.["1600"],
  );
  if (!hasVariants) {
    return undefined;
  }
  const encodedId = encodeURIComponent(metadata.image_id);
  return [
    `/api/v1/images/${encodedId}/thumb?size=400&v=${version}&cb=${cacheBust} 400w`,
    `/api/v1/images/${encodedId}/thumb?size=800&v=${version}&cb=${cacheBust} 800w`,
    `/api/v1/images/${encodedId}/thumb?size=1600&v=${version}&cb=${cacheBust} 1600w`,
  ].join(", ");
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

export function metadataToPhoto(metadata: ImageMetadata): Photo {
  const date = metadata.exif?.DateTimeOriginal
    ? metadata.exif.DateTimeOriginal.split("T")[0]
    : new Date(metadata.timestamps.created_at).toISOString().split("T")[0];

  const version = encodeURIComponent(metadata.timestamps.created_at);
  const cacheBust = encodeURIComponent(
    `${metadata.image_id.slice(7, 19)}-${metadata.timestamps.created_at}`,
  );
  const originalPath = getOriginalPath(metadata);
  const thumbPath = getThumbPath(metadata);
  const originalCdnUrl = buildJsDelivrUrl(originalPath);
  const thumbCdnUrl = buildJsDelivrUrl(thumbPath);
  return {
    id: metadata.image_id,
    url:
      (originalCdnUrl && `${originalCdnUrl}?v=${version}&cb=${cacheBust}`) ||
      buildFallbackApiAssetUrl(metadata.image_id, "original", version, cacheBust),
    thumbnail:
      (thumbCdnUrl && `${thumbCdnUrl}?v=${version}&cb=${cacheBust}`) ||
      buildFallbackApiAssetUrl(metadata.image_id, "thumb", version, cacheBust),
    thumbnailSrcSet: buildThumbSrcSet(metadata, version, cacheBust),
    thumbnailSizes: "(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw",
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
      aperture: metadata.exif?.FNumber ? `f/${metadata.exif.FNumber}` : "f/?",
      shutter: formatShutter(metadata.exif?.ExposureTime),
      focalLength: metadata.exif?.FocalLength
        ? `${metadata.exif.FocalLength}mm`
        : "?mm",
      date,
    },
    metadata,
  };
}
