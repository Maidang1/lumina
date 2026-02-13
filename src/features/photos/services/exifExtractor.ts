import exifr from "exifr";
import { ExifSummary, PrivacyInfo } from "@/features/photos/types";

export interface ExifResult {
  exif: ExifSummary | null;
  privacy: PrivacyInfo;
  rawExif: Record<string, unknown> | null;
}

const GPS_TAGS = [
  "GPSLatitude",
  "GPSLongitude",
  "GPSLatitudeRef",
  "GPSLongitudeRef",
  "GPSAltitude",
  "GPSAltitudeRef",
  "GPSImgDirection",
  "GPSImgDirectionRef",
  "GPSTimeStamp",
  "GPSDateStamp",
  "GPSAreaInformation",
  "GPSDOP",
  "GPSMeasureMode",
  "GPSProcessingMethod",
  "GPSVersionID",
  "latitude",
  "longitude",
];

function hasGPSData(exif: Record<string, unknown> | null): boolean {
  if (!exif) return false;

  for (const tag of GPS_TAGS) {
    if (exif[tag] !== undefined) {
      return true;
    }
  }

  return false;
}

function removeGPSData(exif: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...exif };
  for (const tag of GPS_TAGS) {
    delete cleaned[tag];
  }
  return cleaned;
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
    const cleanedExif = removeGPSData(exifSource);

    const exifSummary: ExifSummary = {};

    if (cleanedExif.Make) exifSummary.Make = String(cleanedExif.Make);
    if (cleanedExif.Model) exifSummary.Model = String(cleanedExif.Model);
    if (cleanedExif.LensModel) exifSummary.LensModel = String(cleanedExif.LensModel);
    if (cleanedExif.DateTimeOriginal) {
      exifSummary.DateTimeOriginal = new Date(cleanedExif.DateTimeOriginal as Date).toISOString();
    } else if (cleanedExif.CreateDate) {
      exifSummary.DateTimeOriginal = new Date(cleanedExif.CreateDate as Date).toISOString();
    }
    if (cleanedExif.ExposureTime) {
      exifSummary.ExposureTime = formatExposureTime(cleanedExif.ExposureTime as number);
    }
    if (cleanedExif.FNumber || cleanedExif.ApertureValue) {
      exifSummary.FNumber = formatAperture(
        (cleanedExif.FNumber || cleanedExif.ApertureValue) as number
      );
    }
    if (cleanedExif.ISO) exifSummary.ISO = cleanedExif.ISO as number;
    if (cleanedExif.FocalLength) {
      exifSummary.FocalLength = cleanedExif.FocalLength as number;
    }
    if (cleanedExif.Orientation) {
      exifSummary.Orientation = cleanedExif.Orientation as number;
    }
    if (cleanedExif.Software) exifSummary.Software = String(cleanedExif.Software);
    if (cleanedExif.Artist) exifSummary.Artist = String(cleanedExif.Artist);
    if (cleanedExif.Copyright) exifSummary.Copyright = String(cleanedExif.Copyright);

    return {
      exif: exifSummary,
      privacy: {
        original_contains_gps: originalContainsGPS,
        exif_gps_removed: originalContainsGPS,
      },
      rawExif: cleanedExif,
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
