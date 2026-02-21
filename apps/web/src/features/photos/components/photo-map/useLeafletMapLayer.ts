import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Photo } from "@/features/photos/types";
import {
  GeoTrackPoint,
  GeoPoint,
  getIntensity,
} from "@/features/photos/components/photo-map/mapData";
import {
  ASIA_BOUNDS,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  LeafletLayer,
  LeafletLayerGroup,
  LeafletMap,
  LeafletWindow,
  MAP_THEME_PRESETS,
  ensureLeafletAssets,
  ensureLeafletClusterAsset,
  ensureLeafletHeatAsset,
  ensureLeafletImageAsset,
} from "@/features/photos/components/photo-map/leafletRuntime";
import {
  MapLayerMode,
  MapThemeMode,
  RegionAggregate,
  RegionBoundaryResult,
} from "@/features/photos/types/map";

interface UseLeafletMapLayerParams {
  mapContainerRef: RefObject<HTMLDivElement | null>;
  activeMonth: string;
  visiblePoints: GeoPoint[];
  routePoints: GeoTrackPoint[];
  provinceAggregates: RegionAggregate[];
  boundaryByRegionKey: Record<string, RegionBoundaryResult | null>;
  selectedRegionKey: string | null;
  setSelectedRegionKey: (key: string) => void;
  onPhotoClick: (photo: Photo) => void;
  mapLayerMode: MapLayerMode;
  mapTheme: MapThemeMode;
  showRoute: boolean;
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
  routePoints,
  provinceAggregates,
  boundaryByRegionKey,
  selectedRegionKey,
  setSelectedRegionKey,
  onPhotoClick,
  mapLayerMode,
  mapTheme,
  showRoute,
}: UseLeafletMapLayerParams): UseLeafletMapLayerResult => {
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [modeAssetVersion, setModeAssetVersion] = useState(0);
  const mapRef = useRef<LeafletMap | null>(null);
  const boundaryLayerRef = useRef<LeafletLayerGroup | null>(null);
  const pointsLayerRef = useRef<LeafletLayer | LeafletLayerGroup | null>(null);
  const routeLayerRef = useRef<LeafletLayerGroup | null>(null);
  const baseTileLayerRef = useRef<LeafletLayer | null>(null);
  const overlayTileLayerRef = useRef<LeafletLayer | null>(null);
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

          const themePreset = MAP_THEME_PRESETS[mapTheme];
          baseTileLayerRef.current = L.tileLayer(themePreset.baseTileUrl, {
            crossOrigin: true,
            attribution: themePreset.baseAttribution,
            noWrap: true,
          }).addTo(map);

          overlayTileLayerRef.current = L.tileLayer(
            themePreset.overlayTileUrl,
            {
              crossOrigin: true,
              attribution: themePreset.overlayAttribution,
              noWrap: true,
              opacity: 0.72,
            },
          ).addTo(map);

          map.setMaxBounds(asiaBounds);
          map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
          map.attributionControl?.setPrefix(false);
          map.on("moveend", () => map.invalidateSize());

          mapRef.current = map;
          boundaryLayerRef.current = L.layerGroup().addTo(map);
          routeLayerRef.current = L.layerGroup().addTo(map);
        }

        setMapReady(true);
        setMapError(null);
      } catch (error) {
        setMapError(
          error instanceof Error ? error.message : "Failed to load map",
        );
      }
    };

    void initMap();

    return () => {
      cancelled = true;
    };
  }, [mapContainerRef, mapTheme]);

  useEffect(() => {
    if (!mapReady) return;

    const updateTheme = (): void => {
      const themePreset = MAP_THEME_PRESETS[mapTheme];
      baseTileLayerRef.current?.setUrl?.(themePreset.baseTileUrl);
      overlayTileLayerRef.current?.setUrl?.(themePreset.overlayTileUrl);
    };

    updateTheme();
  }, [mapReady, mapTheme]);

  useEffect(() => {
    let cancelled = false;

    const ensureModeAssets = async (): Promise<void> => {
      try {
        if (mapLayerMode === "cluster") {
          await ensureLeafletClusterAsset();
        }
        if (mapLayerMode === "heat") {
          await ensureLeafletHeatAsset();
        }
        if (!cancelled) {
          setMapError(null);
          setModeAssetVersion((prev) => prev + 1);
        }
      } catch (error) {
        if (!cancelled) {
          setMapError(
            error instanceof Error
              ? error.message
              : "Failed to load map mode assets",
          );
        }
      }
    };

    void ensureModeAssets();

    return () => {
      cancelled = true;
    };
  }, [mapLayerMode]);

  useEffect(() => {
    if (!mapReady) return;

    const map = mapRef.current;
    const boundaryLayer = boundaryLayerRef.current;
    const routeLayer = routeLayerRef.current;
    const windowWithLeaflet = window as LeafletWindow;
    const L = windowWithLeaflet.L;
    if (!map || !boundaryLayer || !routeLayer || !L) return;

    boundaryLayer.clearLayers();
    routeLayer.clearLayers();
    pointsLayerRef.current?.remove?.();
    pointsLayerRef.current = null;

    const coordinates: [number, number][] = [];
    visiblePoints.forEach((point) => {
      if (point.coordinates) {
        coordinates.push([point.coordinates.lat, point.coordinates.lng]);
      }
    });

    if (mapLayerMode === "boundary") {
      const maxCount = Math.max(
        ...provinceAggregates.map((item) => item.count),
        1,
      );
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
          .bindTooltip(
            `${aggregate.region.displayName} · ${aggregate.count} photos`,
          )
          .on("click", () => {
            setSelectedRegionKey(aggregate.key);
            if (aggregate.photos[0]) {
              onPhotoClick(aggregate.photos[0]);
            }
          });

        layer.addTo(boundaryLayer);
      }
    } else if (mapLayerMode === "cluster") {
      if (L.markerClusterGroup) {
        const clusterLayer = L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 48,
        });
        for (const point of visiblePoints) {
          if (!point.coordinates) continue;
          const marker = L.marker([
            point.coordinates.lat,
            point.coordinates.lng,
          ]);
          marker.bindTooltip?.(point.photo.filename);
          marker.on?.("click", () => {
            onPhotoClick(point.photo);
          });
          clusterLayer.addLayer(marker);
        }
        clusterLayer.addTo(map);
        pointsLayerRef.current = clusterLayer;
      } else {
        const markerLayer = L.layerGroup().addTo(map);
        for (const point of visiblePoints) {
          if (!point.coordinates) continue;
          const marker = L.circleMarker(
            [point.coordinates.lat, point.coordinates.lng],
            {
              radius: 5,
              color: "#d4d4d8",
              weight: 1,
              fillColor: "#ffffff",
              fillOpacity: 0.8,
            },
          );
          marker.bindTooltip?.(point.photo.filename);
          marker.on?.("click", () => onPhotoClick(point.photo));
          if (markerLayer.addLayer) {
            markerLayer.addLayer(marker);
          }
        }
        pointsLayerRef.current = markerLayer;
      }
    } else {
      if (L.heatLayer) {
        const heatLayer = L.heatLayer(
          visiblePoints
            .filter(
              (
                point,
              ): point is GeoPoint & {
                coordinates: { lat: number; lng: number };
              } => point.coordinates !== null,
            )
            .map((point) => [
              point.coordinates.lat,
              point.coordinates.lng,
              0.7,
            ]),
          {
            radius: 24,
            blur: 20,
            minOpacity: 0.32,
            maxZoom: 9,
            gradient: {
              0.2: "#4f46e5",
              0.4: "#06b6d4",
              0.7: "#f59e0b",
              1.0: "#ef4444",
            },
          },
        );
        heatLayer.addTo(map);
        pointsLayerRef.current = heatLayer;
      }
    }

    if (showRoute && routePoints.length > 1) {
      const latLngs = routePoints.map(
        (point) => [point.lat, point.lng] as [number, number],
      );
      const routeLine = L.polyline(latLngs, {
        color: "#38bdf8",
        weight: 3,
        opacity: 0.92,
      });
      routeLine.addTo(routeLayer);

      const start = routePoints[0];
      const end = routePoints[routePoints.length - 1];
      const startMarker = L.circleMarker([start.lat, start.lng], {
        radius: 6,
        color: "#34d399",
        weight: 1.5,
        fillColor: "#10b981",
        fillOpacity: 0.9,
      });
      startMarker.bindTooltip?.("Start");
      startMarker.addTo(routeLayer);

      const endMarker = L.circleMarker([end.lat, end.lng], {
        radius: 6,
        color: "#fb7185",
        weight: 1.5,
        fillColor: "#f43f5e",
        fillOpacity: 0.9,
      });
      endMarker.bindTooltip?.("End");
      endMarker.addTo(routeLayer);
    }

    if (coordinates.length === 0) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      return;
    }

    const fitKey = [
      activeMonth,
      mapLayerMode,
      showRoute ? "route-on" : "route-off",
      coordinates.length,
      routePoints.length,
      selectedRegionKey ?? "none",
      Object.keys(boundaryByRegionKey).length,
    ].join(":");

    if (lastAutoFitKeyRef.current !== fitKey) {
      const bounds = L.latLngBounds(coordinates);
      if (mapLayerMode === "boundary") {
        provinceAggregates.forEach((aggregate) => {
          const boundary = boundaryByRegionKey[aggregate.key];
          if (boundary && boundary.geojson) {
            const layer = L.geoJSON(boundary.geojson);
            bounds.extend(layer.getBounds());
          }
        });
      }
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
      lastAutoFitKeyRef.current = fitKey;
    }
  }, [
    activeMonth,
    boundaryByRegionKey,
    mapLayerMode,
    mapReady,
    modeAssetVersion,
    onPhotoClick,
    provinceAggregates,
    routePoints,
    selectedRegionKey,
    setSelectedRegionKey,
    showRoute,
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
      boundaryLayerRef.current = null;
      pointsLayerRef.current = null;
      routeLayerRef.current = null;
      baseTileLayerRef.current = null;
      overlayTileLayerRef.current = null;
    };
  }, []);

  const focusRegion = useCallback((aggregate: RegionAggregate): void => {
    if (aggregate.representative) {
      mapRef.current?.setView(
        [aggregate.representative.lat, aggregate.representative.lng],
        8,
      );
    }
  }, []);

  const captureCurrentMapCanvas =
    useCallback(async (): Promise<HTMLCanvasElement> => {
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
