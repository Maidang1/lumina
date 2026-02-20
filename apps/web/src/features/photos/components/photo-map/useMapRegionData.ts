import { useEffect, useMemo, useRef, useState } from "react";
import { Photo } from "@/features/photos/types";
import {
  RegionAggregate,
  RegionBoundaryResult,
  RegionInfo,
} from "@/features/photos/types/map";
import { getRegionBoundary, reverseGeocodeToRegion } from "@/features/photos/services/geoRegionService";
import { uploadService } from "@/features/photos/services/uploadService";
import {
  GeoPoint,
  buildGeoPoints,
  buildMonthBuckets,
  buildProvinceAggregates,
  getTimeRangeLabel,
} from "@/features/photos/components/photo-map/mapData";

interface UseMapRegionDataResult {
  activeMonth: string;
  setActiveMonth: (month: string) => void;
  points: GeoPoint[];
  monthBuckets: [string, number][];
  visiblePoints: GeoPoint[];
  provinceAggregates: RegionAggregate[];
  timeRangeLabel: string;
  selectedRegionKey: string | null;
  setSelectedRegionKey: (key: string | null) => void;
  boundaryByRegionKey: Record<string, RegionBoundaryResult | null>;
  isResolvingRegions: boolean;
  isLoadingBoundaries: boolean;
}

export const useMapRegionData = (photos: Photo[]): UseMapRegionDataResult => {
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const [isResolvingRegions, setIsResolvingRegions] = useState(false);
  const [isLoadingBoundaries, setIsLoadingBoundaries] = useState(false);
  const [selectedRegionKey, setSelectedRegionKey] = useState<string | null>(null);
  const [regionByPointKey, setRegionByPointKey] = useState<Record<string, RegionInfo>>({});
  const [boundaryByRegionKey, setBoundaryByRegionKey] = useState<Record<string, RegionBoundaryResult | null>>({});
  const backfilledPhotoIdsRef = useRef<Set<string>>(new Set());
  const boundaryRetryCountRef = useRef<Record<string, number>>({});

  const points = useMemo(() => buildGeoPoints(photos), [photos]);
  const monthBuckets = useMemo(() => buildMonthBuckets(points), [points]);

  const visiblePoints = useMemo(
    () => points.filter((point) => activeMonth === "all" || point.monthKey === activeMonth),
    [activeMonth, points]
  );

  const provinceAggregates = useMemo(
    () => buildProvinceAggregates(visiblePoints, regionByPointKey),
    [regionByPointKey, visiblePoints]
  );

  const timeRangeLabel = useMemo(() => getTimeRangeLabel(activeMonth, monthBuckets), [activeMonth, monthBuckets]);

  useEffect(() => {
    let cancelled = false;

    const unresolved = visiblePoints.filter(
      (point) => !point.regionFromMetadata && !regionByPointKey[point.key] && point.coordinates
    );
    if (unresolved.length === 0) return;

    const resolveRegions = async (): Promise<void> => {
      setIsResolvingRegions(true);
      const updates: Record<string, RegionInfo> = {};

      await Promise.all(
        unresolved.map(async (point) => {
          if (!point.coordinates) return;
          const region = await reverseGeocodeToRegion(point.coordinates.lat, point.coordinates.lng);
          updates[point.key] = region;

          const hasUploadToken = uploadService.hasUploadToken();
          const hasMetadataRegion = Boolean(point.photo.metadata?.geo?.region);
          if (!hasUploadToken || hasMetadataRegion || backfilledPhotoIdsRef.current.has(point.photo.id)) {
            return;
          }

          backfilledPhotoIdsRef.current.add(point.photo.id);
          const legacyPrivacy = point.photo.metadata?.privacy;
          await uploadService
            .updateImageMetadata(point.photo.id, {
              geo: {
                region: {
                  country: region.country,
                  province: region.province,
                  city: region.city,
                  display_name: `${region.province}·${region.city}`,
                  cache_key: `CN|${region.province}|${region.city}`,
                  source: "nominatim",
                  resolved_at: new Date().toISOString(),
                },
              },
              ...(legacyPrivacy
                ? {
                    privacy: {
                      ...legacyPrivacy,
                      exif_gps_removed: true,
                    },
                  }
                : {}),
            })
            .catch(() => {
              backfilledPhotoIdsRef.current.delete(point.photo.id);
            });
        })
      );

      if (!cancelled && Object.keys(updates).length > 0) {
        setRegionByPointKey((prev) => ({ ...prev, ...updates }));
      }

      if (!cancelled) {
        setIsResolvingRegions(false);
      }
    };

    void resolveRegions();

    return () => {
      cancelled = true;
    };
  }, [regionByPointKey, visiblePoints]);

  useEffect(() => {
    let cancelled = false;

    const MAX_BOUNDARY_RETRY = 2;
    const unresolved = provinceAggregates.filter(
      (aggregate) =>
        aggregate.region.displayName !== "Unknown Region" &&
        (!(aggregate.key in boundaryByRegionKey) ||
          (boundaryByRegionKey[aggregate.key] === null &&
            (boundaryRetryCountRef.current[aggregate.key] ?? 0) < MAX_BOUNDARY_RETRY))
    );

    if (unresolved.length === 0) return;

    const loadBoundaries = async (): Promise<void> => {
      setIsLoadingBoundaries(true);
      const updates: Record<string, RegionBoundaryResult | null> = {};

      await Promise.all(
        unresolved.map(async (aggregate) => {
          const provinceRegion = { ...aggregate.region, city: "Unknown City", district: "Unknown District" };
          const boundary = await getRegionBoundary(provinceRegion);
          updates[aggregate.key] = boundary;
          if (boundary === null) {
            boundaryRetryCountRef.current[aggregate.key] =
              (boundaryRetryCountRef.current[aggregate.key] ?? 0) + 1;
          } else {
            boundaryRetryCountRef.current[aggregate.key] = 0;
          }
        })
      );

      if (!cancelled && Object.keys(updates).length > 0) {
        setBoundaryByRegionKey((prev) => ({ ...prev, ...updates }));
      }
      if (!cancelled) {
        setIsLoadingBoundaries(false);
      }
    };

    void loadBoundaries();

    return () => {
      cancelled = true;
    };
  }, [boundaryByRegionKey, provinceAggregates]);

  return {
    activeMonth,
    setActiveMonth,
    points,
    monthBuckets,
    visiblePoints,
    provinceAggregates,
    timeRangeLabel,
    selectedRegionKey,
    setSelectedRegionKey,
    boundaryByRegionKey,
    isResolvingRegions,
    isLoadingBoundaries,
  };
};
