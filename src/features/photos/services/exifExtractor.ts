import exifr from "exifr";
import { ExifSummary, PrivacyInfo } from "@/features/photos/types";

export interface ExifResult {
  exif: ExifSummary | null;
  privacy: PrivacyInfo;
  rawExif: Record<string, unknown> | null;
}

function formatExposureTime(value: number | undefined): number | undefined {
  return value;
}

function formatAperture(value: number | undefined): number | undefined {
  return value;
}

export async function extractExif(file: File | Blob): Promise<ExifResult> {
  try {
    const fullExif = await exifr.parse(file, {
      exif: true,
      iptc: true,
      xmp: true,
      icc: true,
      translateValues: true,
      mergeOutput: true,
    });

    const gpsData = await exifr.gps(file).catch(() => null);
    const originalContainsGPS = gpsData !== null && gpsData !== undefined;

    if (!fullExif) {
      return {
        exif: null,
        privacy: {
          original_contains_gps: false,
          exif_gps_removed: false,
        },
        rawExif: null,
      };
    }

    const exifSource =
      typeof fullExif === "object" && fullExif !== null
        ? (fullExif as Record<string, unknown>)
        : {};
    const sourceExif = exifSource;

    const exifSummary: ExifSummary = {};

    if (sourceExif.Make) exifSummary.Make = String(sourceExif.Make);
    if (sourceExif.Model) exifSummary.Model = String(sourceExif.Model);
    if (sourceExif.LensModel) exifSummary.LensModel = String(sourceExif.LensModel);
    if (sourceExif.DateTimeOriginal) {
      exifSummary.DateTimeOriginal = new Date(sourceExif.DateTimeOriginal as Date).toISOString();
    } else if (sourceExif.CreateDate) {
      exifSummary.DateTimeOriginal = new Date(sourceExif.CreateDate as Date).toISOString();
    }
    if (sourceExif.ExposureTime) {
      exifSummary.ExposureTime = formatExposureTime(sourceExif.ExposureTime as number);
    }
    if (sourceExif.FNumber || sourceExif.ApertureValue) {
      exifSummary.FNumber = formatAperture(
        (sourceExif.FNumber || sourceExif.ApertureValue) as number
      );
    }
    if (sourceExif.ISO) exifSummary.ISO = sourceExif.ISO as number;
    if (sourceExif.FocalLength) {
      exifSummary.FocalLength = sourceExif.FocalLength as number;
    }
    if (sourceExif.Orientation) {
      exifSummary.Orientation = sourceExif.Orientation as number;
    }
    if (sourceExif.Software) exifSummary.Software = String(sourceExif.Software);
    if (sourceExif.Artist) exifSummary.Artist = String(sourceExif.Artist);
    if (sourceExif.Copyright) exifSummary.Copyright = String(sourceExif.Copyright);
    if (gpsData && typeof gpsData === "object") {
      const raw = gpsData as Record<string, unknown>;
      const latitude = typeof raw.latitude === "number" ? raw.latitude : undefined;
      const longitude = typeof raw.longitude === "number" ? raw.longitude : undefined;
      if (latitude !== undefined) {
        exifSummary.GPSLatitude = latitude;
      }
      if (longitude !== undefined) {
        exifSummary.GPSLongitude = longitude;
      }
    }

    return {
      exif: exifSummary,
      privacy: {
        original_contains_gps: originalContainsGPS,
        exif_gps_removed: false,
      },
      rawExif: sourceExif,
    };
  } catch (error) {
    console.warn("EXIF extraction failed:", error);
    return {
      exif: null,
      privacy: {
        original_contains_gps: false,
        exif_gps_removed: false,
      },
      rawExif: null,
    };
  }
}

export async function getOrientation(file: File | Blob): Promise<number> {
  try {
    const orientation = await exifr.orientation(file);
    return orientation || 1;
  } catch {
    return 1;
  }
}

export async function getRotation(file: File | Blob): Promise<number> {
  try {
    const rotation = await exifr.rotation(file);
    return typeof rotation === "number" ? rotation : 0;
  } catch {
    return 0;
  }
}
