import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Photo } from "@/features/photos/types";
import {
  RegionAggregate,
  RegionBoundaryResult,
} from "@/features/photos/types/map";
import { getRegionBoundary, clearBoundaryCache } from "@/features/photos/services/geoRegionService";
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
  refreshBoundaries: () => void;
}

export const useMapRegionData = (photos: Photo[]): UseMapRegionDataResult => {
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const isResolvingRegions = false;
  const [isLoadingBoundaries, setIsLoadingBoundaries] = useState(false);
  const [selectedRegionKey, setSelectedRegionKey] = useState<string | null>(null);
  const [boundaryByRegionKey, setBoundaryByRegionKey] = useState<Record<string, RegionBoundaryResult | null>>({});
  const boundaryRetryCountRef = useRef<Record<string, number>>({});

  const points = useMemo(() => buildGeoPoints(photos), [photos]);
  const monthBuckets = useMemo(() => buildMonthBuckets(points), [points]);

  const visiblePoints = useMemo(
    () => points.filter((point) => activeMonth === "all" || point.monthKey === activeMonth),
    [activeMonth, points]
  );

  const provinceAggregates = useMemo(
    () => buildProvinceAggregates(visiblePoints),
    [visiblePoints]
  );

  const timeRangeLabel = useMemo(() => getTimeRangeLabel(activeMonth, monthBuckets), [activeMonth, monthBuckets]);

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

  const refreshBoundaries = useCallback(() => {
    clearBoundaryCache();
    boundaryRetryCountRef.current = {};
    setBoundaryByRegionKey({});
  }, []);

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
    refreshBoundaries,
  };
};
