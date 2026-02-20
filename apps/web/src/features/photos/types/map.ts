import { Photo } from "@/features/photos/types";

export type RegionBoundaryLevel = "district" | "city" | "province";

export interface RegionInfo {
  country: string;
  province: string;
  city: string;
  district: string;
  displayName: string;
  cacheKey: string;
}

export interface RegionBoundaryResult {
  level: RegionBoundaryLevel;
  geojson: GeoJsonGeometry;
}

export interface RegionAggregate {
  key: string;
  region: RegionInfo;
  count: number;
  photos: Photo[];
  representative?: {
    lat: number;
    lng: number;
  };
}

export interface SharePosterInput {
  mapCanvas: HTMLCanvasElement;
  regionAggregates: RegionAggregate[];
  visiblePointsCount: number;
  timeRangeLabel: string;
}

export interface GeoJsonGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
}
