import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Photo } from "@/features/photos/types";
import { RegionAggregate, RegionBoundaryResult } from "@/features/photos/types/map";
import { GeoPoint, getIntensity } from "@/features/photos/components/photo-map/mapData";
import {
  ASIA_BOUNDS,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  LeafletLayerGroup,
  LeafletMap,
  LeafletWindow,
  MAP_THEME_PRESET,
  ensureLeafletAssets,
  ensureLeafletImageAsset,
} from "@/features/photos/components/photo-map/leafletRuntime";

interface UseLeafletMapLayerParams {
  mapContainerRef: RefObject<HTMLDivElement | null>;
  activeMonth: string;
  visiblePoints: GeoPoint[];
  provinceAggregates: RegionAggregate[];
  boundaryByRegionKey: Record<string, RegionBoundaryResult | null>;
  selectedRegionKey: string | null;
  setSelectedRegionKey: (key: string) => void;
  onPhotoClick: (photo: Photo) => void;
}

interface UseLeafletMapLayerResult {
  mapReady: boolean;
  mapError: string | null;
  focusRegion: (aggregate: RegionAggregate) => void;
  captureCurrentMapCanvas: () => Promise<HTMLCanvasElement>;
}

export const useLeafletMapLayer = ({
  mapContainerRef,
  activeMonth,
  visiblePoints,
  provinceAggregates,
  boundaryByRegionKey,
  selectedRegionKey,
  setSelectedRegionKey,
  onPhotoClick,
}: UseLeafletMapLayerParams): UseLeafletMapLayerResult => {
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const regionLayerRef = useRef<LeafletLayerGroup | null>(null);
  const lastAutoFitKeyRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;

    const initMap = async (): Promise<void> => {
      try {
        await ensureLeafletAssets();
        if (cancelled) return;

        const windowWithLeaflet = window as LeafletWindow;
        const L = windowWithLeaflet.L;
        const container = mapContainerRef.current;
        if (!L || !container) return;

        if (!mapRef.current) {
          const asiaBounds = L.latLngBounds(ASIA_BOUNDS);
          const map = L.map(container, {
            worldCopyJump: true,
            minZoom: 3,
            maxZoom: 18,
            zoomControl: false,
            maxBoundsViscosity: 1.0,
            preferCanvas: true,
          });

          L.tileLayer(MAP_THEME_PRESET.baseTileUrl, {
            crossOrigin: true,
            attribution: MAP_THEME_PRESET.baseAttribution,
            noWrap: true,
          }).addTo(map);

          L.tileLayer(MAP_THEME_PRESET.overlayTileUrl, {
            crossOrigin: true,
            attribution: MAP_THEME_PRESET.overlayAttribution,
            noWrap: true,
            opacity: 0.72,
          }).addTo(map);

          map.setMaxBounds(asiaBounds);
          map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
          map.on("moveend", () => map.invalidateSize());

          mapRef.current = map;
          regionLayerRef.current = L.layerGroup().addTo(map);
        }

        setMapReady(true);
        setMapError(null);
      } catch (error) {
        setMapError(error instanceof Error ? error.message : "Failed to load map");
      }
    };

    void initMap();

    return () => {
      cancelled = true;
    };
  }, [mapContainerRef]);

  useEffect(() => {
    if (!mapReady) return;

    const map = mapRef.current;
    const regionLayer = regionLayerRef.current;
    const windowWithLeaflet = window as LeafletWindow;
    const L = windowWithLeaflet.L;
    if (!map || !regionLayer || !L) return;

    regionLayer.clearLayers();

    const maxCount = Math.max(...provinceAggregates.map((item) => item.count), 1);
    const coordinates: [number, number][] = [];

    visiblePoints.forEach((point) => {
      if (point.coordinates) {
        coordinates.push([point.coordinates.lat, point.coordinates.lng]);
      }
    });

    for (const aggregate of provinceAggregates) {
      const boundary = boundaryByRegionKey[aggregate.key];
      if (!boundary) continue;

      const intensity = getIntensity(aggregate.count, maxCount);
      const isSelected = selectedRegionKey === aggregate.key;
      const strokeWidth = isSelected ? 2 : 1;

      const layer = L.geoJSON(boundary.geojson, {
        style: () => ({
          color: isSelected ? "#ffffff" : "#a1a1aa",
          weight: strokeWidth,
          opacity: isSelected ? 1 : 0.8,
          fillColor: isSelected ? "#ffffff" : "#d4d4d8",
          fillOpacity: isSelected ? 0.3 : 0.15 + 0.03 * intensity,
        }),
      })
        .bindTooltip(`${aggregate.region.displayName} · ${aggregate.count} photos`)
        .on("click", () => {
          setSelectedRegionKey(aggregate.key);
          if (aggregate.photos[0]) {
            onPhotoClick(aggregate.photos[0]);
          }
        });

      layer.addTo(regionLayer);
    }

    if (coordinates.length === 0) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      return;
    }

    const fitKey = `${activeMonth}:${coordinates.length}:${Object.keys(boundaryByRegionKey).length}`;
    if (lastAutoFitKeyRef.current !== fitKey) {
      const bounds = L.latLngBounds(coordinates);
      provinceAggregates.forEach((aggregate) => {
        const boundary = boundaryByRegionKey[aggregate.key];
        if (boundary && boundary.geojson) {
          const layer = L.geoJSON(boundary.geojson);
          bounds.extend(layer.getBounds());
        }
      });

      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
      lastAutoFitKeyRef.current = fitKey;
    }
  }, [
    activeMonth,
    boundaryByRegionKey,
    mapReady,
    onPhotoClick,
    provinceAggregates,
    selectedRegionKey,
    setSelectedRegionKey,
    visiblePoints,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleResize = (): void => map.invalidateSize();
    window.addEventListener("resize", handleResize);

    const observer =
      typeof ResizeObserver !== "undefined" && mapContainerRef.current
        ? new ResizeObserver(() => map.invalidateSize())
        : null;

    if (observer && mapContainerRef.current) {
      observer.observe(mapContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, [mapContainerRef, mapReady]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      regionLayerRef.current = null;
    };
  }, []);

  const focusRegion = useCallback((aggregate: RegionAggregate): void => {
    if (aggregate.representative) {
      mapRef.current?.setView([aggregate.representative.lat, aggregate.representative.lng], 8);
    }
  }, []);

  const captureCurrentMapCanvas = useCallback(async (): Promise<HTMLCanvasElement> => {
    await ensureLeafletImageAsset();
    const map = mapRef.current;
    if (!map) {
      throw new Error("Map is not initialized yet");
    }

    const windowWithLeaflet = window as LeafletWindow;
    const leafletImage = windowWithLeaflet.leafletImage;
    if (!leafletImage) {
      throw new Error("Failed to load map screenshot component");
    }

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    return await new Promise<HTMLCanvasElement>((resolve, reject) => {
      leafletImage(map, (error, canvas) => {
        if (error || !canvas) {
          reject(new Error("Failed to export current map screenshot"));
          return;
        }
        resolve(canvas);
      });
    });
  }, []);

  return {
    mapReady,
    mapError,
    focusRegion,
    captureCurrentMapCanvas,
  };
};
