import { Photo } from "@/features/photos/types";
import { RegionAggregate, RegionInfo } from "@/features/photos/types/map";

export interface GeoPoint {
  key: string;
  photo: Photo;
  coordinates: { lat: number; lng: number } | null;
  regionFromMetadata: RegionInfo | null;
  monthKey: string;
}

export const UNKNOWN_REGION: RegionInfo = {
  country: "China",
  province: "Unknown Province",
  city: "Unknown City",
  district: "Unknown District",
  displayName: "Unknown Region",
  cacheKey: "CN|Unknown Province|Unknown City",
};

const parseCoordinate = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getPhotoCoordinates = (photo: Photo): { lat: number; lng: number } | null => {
  const exif = (photo.metadata?.exif ?? {}) as Record<string, unknown>;
  const lat = parseCoordinate(exif.GPSLatitude);
  const lng = parseCoordinate(exif.GPSLongitude);
  if (lat === null || lng === null) return null;
  return { lat, lng };
};

const getPhotoRegionFromMetadata = (photo: Photo): RegionInfo | null => {
  const region = photo.metadata?.geo?.region;
  if (!region) return null;
  return {
    country: region.country || "China",
    province: region.province || "Unknown Province",
    city: region.city || "Unknown City",
    district: "Unknown District",
    displayName: region.display_name || `${region.province}·${region.city}`,
    cacheKey: region.cache_key || `CN|${region.province}|${region.city}`,
  };
};

export const buildGeoPoints = (photos: Photo[]): GeoPoint[] => {
  return photos
    .map((photo) => {
      const coordinates = getPhotoCoordinates(photo);
      const regionFromMetadata = getPhotoRegionFromMetadata(photo);
      if (!coordinates && !regionFromMetadata) return null;

      const date = new Date(photo.exif.date);
      const monthKey = Number.isNaN(date.getTime())
        ? "Unknown Time"
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      return {
        key: photo.id,
        photo,
        coordinates,
        regionFromMetadata,
        monthKey,
      };
    })
    .filter((point): point is GeoPoint => point !== null);
};

export const buildMonthBuckets = (points: GeoPoint[]): [string, number][] => {
  const counts = new Map<string, number>();
  for (const point of points) {
    counts.set(point.monthKey, (counts.get(point.monthKey) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[0].localeCompare(a[0]));
};

export const buildProvinceAggregates = (
  points: GeoPoint[],
  regionByPointKey: Record<string, RegionInfo>
): RegionAggregate[] => {
  const grouped = new Map<string, RegionAggregate>();

  for (const point of points) {
    const region = point.regionFromMetadata ?? regionByPointKey[point.key] ?? UNKNOWN_REGION;
    const provinceKey = `CN|${region.province}`;

    const existing = grouped.get(provinceKey);
    if (!existing) {
      grouped.set(provinceKey, {
        key: provinceKey,
        region: {
          ...region,
          city: "",
          district: "",
          displayName: region.province,
          cacheKey: provinceKey,
        },
        count: 1,
        photos: [point.photo],
        representative: point.coordinates
          ? { lat: point.coordinates.lat, lng: point.coordinates.lng }
          : undefined,
      });
      continue;
    }

    existing.count += 1;
    if (!existing.representative && point.coordinates) {
      existing.representative = { lat: point.coordinates.lat, lng: point.coordinates.lng };
    }
    if (existing.photos.length < 10) {
      existing.photos.push(point.photo);
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
};

export const getIntensity = (count: number, maxCount: number): 1 | 2 | 3 => {
  if (maxCount <= 1) return 2;
  const ratio = count / maxCount;
  if (ratio >= 0.66) return 3;
  if (ratio >= 0.33) return 2;
  return 1;
};

export const getTimeRangeLabel = (activeMonth: string, monthBuckets: [string, number][]): string => {
  if (activeMonth !== "all") return activeMonth;
  if (monthBuckets.length === 0) return "Unknown Time";
  const sorted = [...monthBuckets].sort((a, b) => a[0].localeCompare(b[0]));
  return `${sorted[0][0]} - ${sorted[sorted.length - 1][0]}`;
};
