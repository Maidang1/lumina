import crypto from "node:crypto";
import exifr from "exifr";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import type { GeoRegion, ImageMetadata } from "@lumina/contracts";
import type { NodePipelineOptions, UploadPipelineInput, UploadPipelineOutput } from "../types";

const DEFAULTS: Required<NodePipelineOptions> = {
  ocrLang: "eng+chi_sim",
  maxThumbSize: 1024,
  thumbQuality: 85,
  blurThreshold: 100,
  resolveRegion: true,
};

function sha256(bytes: Uint8Array): string {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function pickMimeExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
  };
  return map[mime] || "bin";
}

async function resolveRegion(lat: number, lng: number): Promise<GeoRegion | undefined> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "zh-CN,zh;q=0.95,en;q=0.8",
      "User-Agent": "lumina-upload-core/1.0",
    },
  });

  if (!response.ok) return undefined;
  const payload = (await response.json()) as {
    address?: { country?: string; state?: string; city?: string; municipality?: string };
  };

  const province = payload.address?.state || "未知省份";
  const city = payload.address?.city || payload.address?.municipality || province;

  return {
    country: payload.address?.country || "中国",
    province,
    city,
    display_name: `${province}·${city}`,
    cache_key: `CN|${province}|${city}`,
    source: "nominatim",
    resolved_at: new Date().toISOString(),
  };
}

export async function processForUpload(
  input: UploadPipelineInput,
  options: NodePipelineOptions = {}
): Promise<UploadPipelineOutput> {
  const opts = { ...DEFAULTS, ...options };
  const startedAt = Date.now();

  const stillHash = sha256(input.bytes);
  const videoHash = input.liveVideo ? sha256(input.liveVideo.bytes) : undefined;
  const imageId = videoHash
    ? sha256(Buffer.from(`${stillHash}:${videoHash}`))
    : stillHash;

  const originalImage = sharp(input.bytes, { failOn: "none" });
  const meta = await originalImage.metadata();

  const thumbBuffer = await originalImage
    .clone()
    .resize({ width: opts.maxThumbSize, height: opts.maxThumbSize, fit: "inside", withoutEnlargement: true })
    .webp({ quality: opts.thumbQuality })
    .toBuffer();

  const thumbMeta = await sharp(thumbBuffer).metadata();
  const stats = await sharp(thumbBuffer).stats();
  const dominant = stats.dominant;
  const dominantColor = `#${dominant.r.toString(16).padStart(2, "0")}${dominant.g
    .toString(16)
    .padStart(2, "0")}${dominant.b.toString(16).padStart(2, "0")}`;

  const exifRaw = (await exifr.parse(Buffer.from(input.bytes), {
    exif: true,
    iptc: true,
    xmp: true,
    icc: true,
    translateValues: true,
    mergeOutput: true,
  })) as Record<string, unknown> | null;
  const gpsRaw = (await exifr.gps(Buffer.from(input.bytes)).catch(() => null)) as
    | { latitude?: number; longitude?: number }
    | null;

  const exifSummary: ImageMetadata["exif"] = exifRaw
    ? {
        ...(typeof exifRaw.Make === "string" ? { Make: exifRaw.Make } : {}),
        ...(typeof exifRaw.Model === "string" ? { Model: exifRaw.Model } : {}),
        ...(typeof exifRaw.LensModel === "string" ? { LensModel: exifRaw.LensModel } : {}),
        ...(exifRaw.DateTimeOriginal instanceof Date
          ? { DateTimeOriginal: exifRaw.DateTimeOriginal.toISOString() }
          : {}),
        ...(typeof exifRaw.ExposureTime === "number" ? { ExposureTime: exifRaw.ExposureTime } : {}),
        ...(typeof exifRaw.FNumber === "number" ? { FNumber: exifRaw.FNumber } : {}),
        ...(typeof exifRaw.ISO === "number" ? { ISO: exifRaw.ISO } : {}),
        ...(typeof exifRaw.FocalLength === "number" ? { FocalLength: exifRaw.FocalLength } : {}),
      }
    : undefined;

  if (gpsRaw?.latitude !== undefined && exifSummary) {
    exifSummary.GPSLatitude = gpsRaw.latitude;
  }
  if (gpsRaw?.longitude !== undefined && exifSummary) {
    exifSummary.GPSLongitude = gpsRaw.longitude;
  }

  let ocr: ImageMetadata["derived"]["ocr"] = { status: "failed", lang: opts.ocrLang };
  try {
    const ocrResult = await Tesseract.recognize(Buffer.from(thumbBuffer), opts.ocrLang);
    const text = (ocrResult.data.text || "").trim();
    ocr = { status: text ? "ok" : "skipped", lang: opts.ocrLang, summary: text.slice(0, 2000) };
  } catch {
    ocr = { status: "failed", lang: opts.ocrLang };
  }

  const blurScore = Math.round((stats.channels[0]?.stdev || 0) + (stats.channels[1]?.stdev || 0));
  const isBlurry = blurScore < opts.blurThreshold;

  const phashFallback = crypto
    .createHash("sha256")
    .update(thumbBuffer)
    .digest("hex")
    .slice(0, 16);

  let region: GeoRegion | undefined;
  if (opts.resolveRegion && gpsRaw?.latitude !== undefined && gpsRaw?.longitude !== undefined) {
    region = await resolveRegion(gpsRaw.latitude, gpsRaw.longitude).catch(() => undefined);
  }

  const metadata: ImageMetadata = {
    schema_version: "1.2",
    image_id: imageId,
    original_filename: input.fileName,
    timestamps: {
      created_at: new Date().toISOString(),
      client_processed_at: new Date().toISOString(),
    },
    files: {
      original: {
        path: "",
        mime: input.mimeType,
        bytes: input.bytes.byteLength,
      },
      thumb: {
        path: "",
        mime: "image/webp",
        bytes: thumbBuffer.byteLength,
        width: thumbMeta.width || 0,
        height: thumbMeta.height || 0,
      },
      ...(input.liveVideo
        ? {
            live_video: {
              path: "",
              mime: input.liveVideo.mimeType,
              bytes: input.liveVideo.bytes.byteLength,
            },
          }
        : {}),
    },
    ...(input.liveVideo && videoHash
      ? {
          live_photo: {
            enabled: true,
            pair_id: imageId,
            still_hash: stillHash,
            video_hash: videoHash,
          },
        }
      : {}),
    exif: exifSummary
      ? {
          ...exifSummary,
          GPSLatitude: undefined,
          GPSLongitude: undefined,
        }
      : undefined,
    privacy: {
      original_contains_gps: gpsRaw?.latitude !== undefined && gpsRaw?.longitude !== undefined,
      exif_gps_removed: gpsRaw?.latitude !== undefined && gpsRaw?.longitude !== undefined,
    },
    ...(region ? { geo: { region } } : {}),
    derived: {
      dimensions: {
        width: meta.width || 0,
        height: meta.height || 0,
      },
      dominant_color: {
        hex: dominantColor,
      },
      blur: {
        score: blurScore,
        is_blurry: isBlurry,
        method: "variance_of_laplacian",
      },
      phash: {
        algo: "sha256_fallback",
        bits: 16,
        value: phashFallback,
      },
      ocr,
    },
    processing: {
      summary: {
        total_ms: Date.now() - startedAt,
        concurrency_profile: "node-cli:cpu",
        stage_durations: [],
      },
    },
  };

  const ext = pickMimeExt(input.mimeType);
  metadata.files.original.path = `pending/original.${ext}`;

  return {
    metadata,
    thumb: new Uint8Array(thumbBuffer),
  };
}
