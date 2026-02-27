import type { ImageMetadata } from "@luminafe/contracts";

export interface ExifData {
  camera: string;
  lens: string;
  iso: number;
  aperture: string;
  shutter: string;
  focalLength: string;
  date: string;
}

export interface GalleryPhoto {
  id: string;
  url: string;
  thumbnail: string;
  thumbnailSrcSet?: string;
  thumbnailSizes?: string;
  title: string;
  location: string;
  category: string;
  width: number;
  height: number;
  visualDescription: string;
  filename: string;
  format: string;
  size: string;
  exif: ExifData;
  metadata: ImageMetadata;
}

export interface CdnRepoConfig {
  owner?: string;
  repo?: string;
  branch?: string;
}

export interface MetadataToPhotoOptions {
  cdnRepo?: CdnRepoConfig;
  apiBasePath?: string;
  includeCacheBust?: boolean;
  defaultGhOwner?: string;
  defaultGhRepo?: string;
  defaultGhBranch?: string;
}

const DEFAULT_GH_OWNER = "Maidang1";
const DEFAULT_GH_REPO = "photos";
const DEFAULT_GH_BRANCH = "main";

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

function appendVersionQuery(
  url: string,
  version: string,
  cacheBust: string,
  includeCacheBust: boolean,
): string {
  const separator = url.includes("?") ? "&" : "?";
  const cacheSegment = includeCacheBust ? `&cb=${cacheBust}` : "";
  return `${url}${separator}v=${version}${cacheSegment}`;
}

function buildFallbackApiAssetUrl(
  imageId: string,
  type: "original" | "thumb",
  version: string,
  cacheBust: string,
  apiBasePath: string,
  includeCacheBust: boolean,
): string {
  return appendVersionQuery(
    `${apiBasePath}/v1/images/${encodeURIComponent(imageId)}/${type}`,
    version,
    cacheBust,
    includeCacheBust,
  );
}

function buildJsDelivrUrl(
  path: string | undefined,
  cdnRepo: CdnRepoConfig | undefined,
  defaults: Required<Pick<
    MetadataToPhotoOptions,
    "defaultGhOwner" | "defaultGhRepo" | "defaultGhBranch"
  >>,
): string | undefined {
  if (!path) {
    return undefined;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const owner = (cdnRepo?.owner || defaults.defaultGhOwner).trim();
  const repo = (cdnRepo?.repo || defaults.defaultGhRepo).trim();
  const branch = (cdnRepo?.branch || defaults.defaultGhBranch).trim();

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
  includeCacheBust: boolean,
  apiBasePath: string,
  cdnRepo: CdnRepoConfig | undefined,
  defaults: Required<Pick<
    MetadataToPhotoOptions,
    "defaultGhOwner" | "defaultGhRepo" | "defaultGhBranch"
  >>,
): string | undefined {
  const directCandidates: Array<[string | undefined, number]> = [
    [metadata.files.thumb_variants?.["400"]?.path, 400],
    [metadata.files.thumb_variants?.["800"]?.path, 800],
    [metadata.files.thumb_variants?.["1600"]?.path, 1600],
  ];
  const directEntries = directCandidates
    .map(([path, width]) => {
      const cdnUrl = buildJsDelivrUrl(path, cdnRepo, defaults);
      if (!cdnUrl) {
        return undefined;
      }
      return `${appendVersionQuery(cdnUrl, version, cacheBust, includeCacheBust)} ${width}w`;
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
  const cacheSegment = includeCacheBust ? `&cb=${cacheBust}` : "";
  return [
    `${apiBasePath}/v1/images/${encodedId}/thumb?size=400&v=${version}${cacheSegment} 400w`,
    `${apiBasePath}/v1/images/${encodedId}/thumb?size=800&v=${version}${cacheSegment} 800w`,
    `${apiBasePath}/v1/images/${encodedId}/thumb?size=1600&v=${version}${cacheSegment} 1600w`,
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

export function metadataToPhoto(
  metadata: ImageMetadata,
  options: MetadataToPhotoOptions = {},
): GalleryPhoto {
  const date = metadata.exif?.DateTimeOriginal
    ? metadata.exif.DateTimeOriginal.split("T")[0]
    : new Date(metadata.timestamps.created_at).toISOString().split("T")[0];

  const version = encodeURIComponent(metadata.timestamps.created_at);
  const cacheBust = encodeURIComponent(
    `${metadata.image_id.slice(7, 19)}-${metadata.timestamps.created_at}`,
  );
  const includeCacheBust = options.includeCacheBust ?? false;
  const defaults = {
    defaultGhOwner: options.defaultGhOwner || DEFAULT_GH_OWNER,
    defaultGhRepo: options.defaultGhRepo || DEFAULT_GH_REPO,
    defaultGhBranch: options.defaultGhBranch || DEFAULT_GH_BRANCH,
  };
  const apiBasePath = (options.apiBasePath || "/api").replace(/\/+$/, "");

  const originalPath = getOriginalPath(metadata);
  const thumbPath = getThumbPath(metadata);
  const originalCdnUrl = buildJsDelivrUrl(originalPath, options.cdnRepo, defaults);
  const thumbCdnUrl = buildJsDelivrUrl(thumbPath, options.cdnRepo, defaults);

  return {
    id: metadata.image_id,
    url:
      (originalCdnUrl &&
        appendVersionQuery(originalCdnUrl, version, cacheBust, includeCacheBust)) ||
      buildFallbackApiAssetUrl(
        metadata.image_id,
        "original",
        version,
        cacheBust,
        apiBasePath,
        includeCacheBust,
      ),
    thumbnail:
      (thumbCdnUrl &&
        appendVersionQuery(thumbCdnUrl, version, cacheBust, includeCacheBust)) ||
      buildFallbackApiAssetUrl(
        metadata.image_id,
        "thumb",
        version,
        cacheBust,
        apiBasePath,
        includeCacheBust,
      ),
    thumbnailSrcSet: buildThumbSrcSet(
      metadata,
      version,
      cacheBust,
      includeCacheBust,
      apiBasePath,
      options.cdnRepo,
      defaults,
    ),
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
