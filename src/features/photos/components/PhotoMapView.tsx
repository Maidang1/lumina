import React, { useMemo, useState } from "react";
import { ChevronDown, Loader2, MapPin, Share2 } from "lucide-react";
import { Photo } from "@/features/photos/types";
import {
  getRegionBoundary,
  reverseGeocodeToRegion,
} from "@/features/photos/services/geoRegionService";
import { uploadService } from "@/features/photos/services/uploadService";
import { buildMapSharePoster } from "@/features/photos/services/mapSharePoster";
import {
  GeoJsonGeometry,
  RegionAggregate,
  RegionBoundaryResult,
  RegionInfo,
} from "@/features/photos/types/map";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

interface PhotoMapViewProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

interface GeoPoint {
  key: string;
  photo: Photo;
  coordinates: { lat: number; lng: number } | null;
  regionFromMetadata: RegionInfo | null;
  monthKey: string;
}

interface LeafletWindow extends Window {
  L?: {
    map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
    tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayer;
    layerGroup: () => LeafletLayerGroup;
    geoJSON: (
      data: GeoJsonGeometry,
      options?: { style?: () => Record<string, unknown> }
    ) => LeafletGeoJsonLayer;
    latLngBounds: (latLngs: [number, number][]) => LeafletBounds;
  };
  leafletImage?: (
    map: LeafletMap,
    done: (error: unknown, canvas: HTMLCanvasElement) => void
  ) => void;
}

interface LeafletMap {
  setView: (center: [number, number], zoom: number) => void;
  fitBounds: (bounds: LeafletBounds, options?: Record<string, unknown>) => void;
  setMaxBounds: (bounds: LeafletBounds) => void;
  remove: () => void;
  on: (event: string, handler: () => void) => LeafletMap;
  invalidateSize: () => void;
}

interface LeafletLayer {
  addTo: (map: LeafletMap) => LeafletLayer;
}

interface LeafletLayerGroup {
  addTo: (map: LeafletMap) => LeafletLayerGroup;
  clearLayers: () => void;
}

interface LeafletGeoJsonLayer {
  addTo: (layerGroup: LeafletLayerGroup) => LeafletGeoJsonLayer;
  bindTooltip: (text: string) => LeafletGeoJsonLayer;
  on: (event: string, handler: () => void) => LeafletGeoJsonLayer;
  getBounds: () => LeafletBounds;
}

interface LeafletBounds {
    extend: (bounds: LeafletBounds) => void;
}

const ASIA_BOUNDS: [number, number][] = [
  [-10, 25],
  [82, 170],
];

const DEFAULT_MAP_CENTER: [number, number] = [33.669496972795535, 111.95068359375001];
const DEFAULT_MAP_ZOOM = 5;

const LEAFLET_CSS_ID = "leaflet-css-cdn";
const LEAFLET_JS_ID = "leaflet-js-cdn";
const LEAFLET_IMAGE_JS_ID = "leaflet-image-js-cdn";

const MAP_THEME_PRESET = {
  baseTileUrl: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
  overlayTileUrl: "https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png",
  baseAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
  overlayAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; Stadia Maps &copy; Stamen Design',
};

const UNKNOWN_REGION: RegionInfo = {
  country: "中国",
  province: "未知省份",
  city: "未知城市",
  district: "未知区县",
  displayName: "未知地区",
  cacheKey: "CN|未知省份|未知城市",
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

const toPointKey = (photo: Photo): string => photo.id;

const getPhotoRegionFromMetadata = (photo: Photo): RegionInfo | null => {
  const region = photo.metadata?.geo?.region;
  if (!region) return null;
  return {
    country: region.country || "中国",
    province: region.province || "未知省份",
    city: region.city || "未知城市",
    district: "未知区县",
    displayName: region.display_name || `${region.province}·${region.city}`,
    cacheKey: region.cache_key || `CN|${region.province}|${region.city}`,
  };
};

const ensureLeafletAssets = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const windowWithLeaflet = window as LeafletWindow;
  if (windowWithLeaflet.L) return;

  if (!document.getElementById(LEAFLET_CSS_ID)) {
    const link = document.createElement("link");
    link.id = LEAFLET_CSS_ID;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  if (document.getElementById(LEAFLET_JS_ID)) {
    await new Promise<void>((resolve) => {
      const check = (): void => {
        if ((window as LeafletWindow).L) {
          resolve();
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = LEAFLET_JS_ID;
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Leaflet"));
    document.body.appendChild(script);
  });
};

const ensureLeafletImageAsset = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const windowWithLeaflet = window as LeafletWindow;
  if (windowWithLeaflet.leafletImage) return;

  if (document.getElementById(LEAFLET_IMAGE_JS_ID)) {
    await new Promise<void>((resolve) => {
      const check = (): void => {
        if ((window as LeafletWindow).leafletImage) {
          resolve();
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = LEAFLET_IMAGE_JS_ID;
    script.src = "https://unpkg.com/leaflet-image@0.4.0/leaflet-image.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load leaflet-image"));
    document.body.appendChild(script);
  });
};

interface SidePanelProps {
  activeMonth: string;
  monthBuckets: [string, number][];
  onMonthChange: (month: string) => void;
  regionAggregates: RegionAggregate[];
  selectedRegionKey: string | null;
  onRegionClick: (aggregate: RegionAggregate) => void;
  boundaryByRegionKey: Record<string, RegionBoundaryResult | null>;
  isResolvingRegions: boolean;
  isLoadingBoundaries: boolean;
  className?: string;
  monthListClassName?: string;
  regionListClassName?: string;
}

const SidePanel: React.FC<SidePanelProps> = ({
  activeMonth,
  monthBuckets,
  onMonthChange,
  regionAggregates,
  selectedRegionKey,
  onRegionClick,
  boundaryByRegionKey,
  isResolvingRegions,
  isLoadingBoundaries,
  className,
  monthListClassName,
  regionListClassName,
}) => {
  return (
    <aside className={className}>
      <div className='mb-2 flex items-center justify-between'>
        <p className='text-xs font-medium text-gray-400'>时间线</p>
        <span className='text-[10px] text-gray-500'>
          {regionAggregates.reduce((sum, item) => sum + item.count, 0)} 点
        </span>
      </div>
      
      <div className={monthListClassName}>
        <button
          type='button'
          onClick={() => onMonthChange("all")}
          className={`shrink-0 rounded-lg px-2 py-1 text-xs transition ${
            activeMonth === "all" 
              ? "bg-white/10 text-white" 
              : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
          }`}
        >
          全部
        </button>
        {monthBuckets.map(([month, count]) => (
          <button
            key={month}
            type='button'
            onClick={() => onMonthChange(month)}
            className={`shrink-0 rounded-lg px-2 py-1 text-xs transition ${
              activeMonth === month 
                ? "bg-white/10 text-white" 
                : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
            }`}
          >
            {month} <span className='opacity-50'>{count}</span>
          </button>
        ))}
      </div>

      <div className='mt-2 border-t border-white/5 pt-2'>
        <div className='mb-2 flex items-center justify-between'>
          <p className='text-xs font-medium text-gray-400'>区域</p>
          {(isResolvingRegions || isLoadingBoundaries) && <Loader2 size={12} className='animate-spin text-gray-500' />}
        </div>
        <div className={regionListClassName}>
          {regionAggregates.slice(0, 40).map((aggregate) => {
            const isSelected = selectedRegionKey === aggregate.key;
            return (
              <button
                key={aggregate.key}
                type='button'
                onClick={() => onRegionClick(aggregate)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition ${
                  isSelected 
                    ? "bg-white/10 text-white" 
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <div className='flex items-center justify-between gap-2'>
                  <span className='line-clamp-1'>{aggregate.region.displayName}</span>
                  <span className='font-mono text-[10px] text-gray-500'>{aggregate.count}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

const getIntensity = (count: number, maxCount: number): 1 | 2 | 3 => {
  if (maxCount <= 1) return 2;
  const ratio = count / maxCount;
  if (ratio >= 0.66) return 3;
  if (ratio >= 0.33) return 2;
  return 1;
};

const getTimeRangeLabel = (activeMonth: string, monthBuckets: [string, number][]): string => {
  if (activeMonth !== "all") return activeMonth;
  if (monthBuckets.length === 0) return "未知时间";
  const sorted = [...monthBuckets].sort((a, b) => a[0].localeCompare(b[0]));
  return `${sorted[0][0]} - ${sorted[sorted.length - 1][0]}`;
};

const PhotoMapView: React.FC<PhotoMapViewProps> = ({ photos, onPhotoClick }) => {
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [isResolvingRegions, setIsResolvingRegions] = useState(false);
  const [isLoadingBoundaries, setIsLoadingBoundaries] = useState(false);
  const [selectedRegionKey, setSelectedRegionKey] = useState<string | null>(null);
  const [regionByPointKey, setRegionByPointKey] = useState<Record<string, RegionInfo>>({});
  const [boundaryByRegionKey, setBoundaryByRegionKey] = useState<Record<string, RegionBoundaryResult | null>>({});
  const [isPosterPreviewOpen, setIsPosterPreviewOpen] = useState(false);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const [posterFileName, setPosterFileName] = useState<string>("lumina-footprint.png");
  const [isPosterActionRunning, setIsPosterActionRunning] = useState(false);

  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const regionLayerRef = React.useRef<LeafletLayerGroup | null>(null);
  const lastAutoFitKeyRef = React.useRef<string>("");
  const posterBlobRef = React.useRef<Blob | null>(null);
  const backfilledPhotoIdsRef = React.useRef<Set<string>>(new Set());
  const boundaryRetryCountRef = React.useRef<Record<string, number>>({});

  const points = useMemo<GeoPoint[]>(() => {
    return photos
      .map((photo) => {
        const coords = getPhotoCoordinates(photo);
        const regionFromMetadata = getPhotoRegionFromMetadata(photo);
        if (!coords && !regionFromMetadata) return null;

        const date = new Date(photo.exif.date);
        const monthKey = Number.isNaN(date.getTime())
          ? "未知时间"
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        return {
          key: toPointKey(photo),
          photo,
          coordinates: coords,
          regionFromMetadata,
          monthKey,
        };
      })
      .filter((point): point is GeoPoint => point !== null);
  }, [photos]);

  const monthBuckets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const point of points) {
      counts.set(point.monthKey, (counts.get(point.monthKey) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [points]);

  const visiblePoints = useMemo(
    () => points.filter((point) => activeMonth === "all" || point.monthKey === activeMonth),
    [activeMonth, points]
  );

  const provinceAggregates = useMemo<RegionAggregate[]>(() => {
    const grouped = new Map<string, RegionAggregate>();

    for (const point of visiblePoints) {
      const region = point.regionFromMetadata ?? regionByPointKey[point.key] ?? UNKNOWN_REGION;
      // Use province as the key for aggregation
      const provinceKey = `CN|${region.province}`;
      
      const existing = grouped.get(provinceKey);
      if (!existing) {
        grouped.set(provinceKey, {
          key: provinceKey,
          region: {
            ...region,
            city: "", // Clear city/district for province level
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
      // Update representative point to be the average or just the first one?
      // For now, keep the first one or update if not set
      if (!existing.representative && point.coordinates) {
        existing.representative = { lat: point.coordinates.lat, lng: point.coordinates.lng };
      }
      if (existing.photos.length < 10) {
        existing.photos.push(point.photo);
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [regionByPointKey, visiblePoints]);

  const timeRangeLabel = useMemo(() => getTimeRangeLabel(activeMonth, monthBuckets), [activeMonth, monthBuckets]);

  React.useEffect(() => {
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
            // leaflet-image 对 Canvas 渲染层兼容更稳定，确保区域高亮能导出
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
        setMapError(error instanceof Error ? error.message : "地图加载失败");
      }
    };

    void initMap();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
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

  React.useEffect(() => {
    let cancelled = false;

    const MAX_BOUNDARY_RETRY = 2;
    const unresolved = provinceAggregates.filter(
      (aggregate) =>
        aggregate.region.displayName !== "未知地区" &&
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
          // Force province level boundary search
          const provinceRegion = { ...aggregate.region, city: "未知城市", district: "未知区县" };
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

  React.useEffect(() => {
    if (!mapReady) return;

    const map = mapRef.current;
    const regionLayer = regionLayerRef.current;
    const windowWithLeaflet = window as LeafletWindow;
    const L = windowWithLeaflet.L;
    if (!map || !regionLayer || !L) return;

    regionLayer.clearLayers();

    const maxCount = Math.max(...provinceAggregates.map((item) => item.count), 1);
    const coordinates: [number, number][] = [];

    // Collect all points for bounds calculation
    visiblePoints.forEach(p => {
        if (p.coordinates) {
            coordinates.push([p.coordinates.lat, p.coordinates.lng]);
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
          color: isSelected ? "#ffffff" : "#a1a1aa", // white : zinc-400
          weight: strokeWidth,
          opacity: isSelected ? 1 : 0.8,
          fillColor: isSelected ? "#ffffff" : "#d4d4d8", // white : zinc-300
          fillOpacity: isSelected ? 0.3 : 0.15,
        }),
      })
        .bindTooltip(`${aggregate.region.displayName} · ${aggregate.count} 张`)
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
      // Add padding to bounds
      const bounds = L.latLngBounds(coordinates);
      // Extend bounds to include boundaries if available
      provinceAggregates.forEach(agg => {
          const boundary = boundaryByRegionKey[agg.key];
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
    visiblePoints
  ]);

  React.useEffect(() => {
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
  }, [mapReady]);

  React.useEffect(() => {
    return () => {
      if (posterPreviewUrl) {
        URL.revokeObjectURL(posterPreviewUrl);
      }
      mapRef.current?.remove();
      mapRef.current = null;
      regionLayerRef.current = null;
    };
  }, [posterPreviewUrl]);

  const captureCurrentMapCanvas = React.useCallback(async (): Promise<HTMLCanvasElement> => {
    await ensureLeafletImageAsset();
    const map = mapRef.current;
    if (!map) {
      throw new Error("地图尚未初始化完成");
    }

    const windowWithLeaflet = window as LeafletWindow;
    const leafletImage = windowWithLeaflet.leafletImage;
    if (!leafletImage) {
      throw new Error("地图截图组件加载失败");
    }

    // 等待一帧，确保最新的 GeoJSON 高亮样式已经完成绘制
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    return await new Promise<HTMLCanvasElement>((resolve, reject) => {
      leafletImage(map, (error, canvas) => {
        if (error || !canvas) {
          reject(new Error("当前地图无法导出截图"));
          return;
        }
        resolve(canvas);
      });
    });
  }, []);

  const handleShareMap = React.useCallback(async (): Promise<void> => {
    if (visiblePoints.length === 0) {
      window.alert("当前没有可分享的地图点位");
      return;
    }

    setIsSharing(true);
    try {
      const mapCanvas = await captureCurrentMapCanvas();
      const { blob, filename } = await buildMapSharePoster({
        mapCanvas,
        regionAggregates: provinceAggregates,
        visiblePointsCount: visiblePoints.length,
        timeRangeLabel,
      });
      if (posterPreviewUrl) {
        URL.revokeObjectURL(posterPreviewUrl);
      }
      const previewUrl = URL.createObjectURL(blob);
      posterBlobRef.current = blob;
      setPosterFileName(filename);
      setPosterPreviewUrl(previewUrl);
      setIsPosterPreviewOpen(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "生成分享图失败");
    } finally {
      setIsSharing(false);
    }
  }, [captureCurrentMapCanvas, posterPreviewUrl, provinceAggregates, timeRangeLabel, visiblePoints.length]);

  const handleDownloadPoster = React.useCallback((): void => {
    const blob = posterBlobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = posterFileName;
    link.click();
    URL.revokeObjectURL(url);
  }, [posterFileName]);

  const handleCopyPoster = React.useCallback(async (): Promise<void> => {
    const blob = posterBlobRef.current;
    if (!blob) return;
    if (!("clipboard" in navigator) || !("write" in navigator.clipboard)) {
      window.alert("当前浏览器不支持复制图片，请使用下载");
      return;
    }

    setIsPosterActionRunning(true);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
      window.alert("海报已复制到剪贴板");
    } catch {
      window.alert("复制失败，请使用下载");
    } finally {
      setIsPosterActionRunning(false);
    }
  }, []);

  const handleRegionClick = React.useCallback(
    (aggregate: RegionAggregate): void => {
      setSelectedRegionKey(aggregate.key);
      if (aggregate.representative) {
        mapRef.current?.setView([aggregate.representative.lat, aggregate.representative.lng], 8);
      }
      if (aggregate.photos[0]) {
        onPhotoClick(aggregate.photos[0]);
      }
    },
    [onPhotoClick]
  );

  return (
    <section className='relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0a0a0a]'>
      <div className='absolute left-4 top-4 z-[400] flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.12] bg-[#141414]/88 px-4 py-2.5 shadow-[0_14px_38px_rgba(0,0,0,0.42)] backdrop-blur-lg transition-colors duration-200 hover:bg-[#161616]/95'>
        <div className='flex items-center gap-2 text-gray-200'>
          <MapPin size={16} className="text-gray-400" />
          <h2 className='text-sm font-medium'>地图足迹</h2>
          <span className='rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-400'>
            {visiblePoints.length} 点位
          </span>
        </div>
      </div>

      <div className='absolute right-4 top-4 z-[400] flex items-center gap-2'>
        <button
          type='button'
          onClick={() => {
            void handleShareMap();
          }}
          disabled={isSharing}
          className='inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-white/[0.12] bg-[#141414]/90 px-4 text-xs font-medium text-gray-200 shadow-[0_10px_30px_rgba(0,0,0,0.32)] backdrop-blur-md transition-colors duration-200 hover:bg-[#181818] disabled:cursor-not-allowed disabled:opacity-60'
        >
          {isSharing ? <Loader2 size={14} className='animate-spin' /> : <Share2 size={14} />}
          <span>分享</span>
        </button>
      </div>

      <div className='relative h-full w-full'>
        <style>{`
            .leaflet-tooltip {
              background: rgba(16, 16, 16, 0.92);
              border: none;
              color: rgba(255, 255, 255, 0.9);
              border-radius: 8px;
              padding: 4px 10px;
              box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
              font-size: 11px;
              font-weight: 500;
              backdrop-filter: blur(10px);
            }
            .leaflet-tooltip:before {
              border-top-color: rgba(16, 16, 16, 0.92) !important;
            }
            .leaflet-control-attribution {
              background: rgba(10, 10, 10, 0.68) !important;
              color: rgba(255, 255, 255, 0.45) !important;
              backdrop-filter: blur(4px);
              border: none;
              padding: 0 8px;
              border-top-left-radius: 6px;
            }
            .leaflet-container {
               background: #0a0a0a !important;
            }
          `}</style>
        <div ref={mapContainerRef} className='h-full w-full grayscale-[0.2]' />

        {!mapReady && !mapError && (
          <div className='absolute inset-0 flex items-center justify-center text-xs text-gray-500'>
            正在加载地图...
          </div>
        )}

        {mapError && (
          <div className='absolute inset-0 flex items-center justify-center text-xs text-red-400'>
            {mapError}
          </div>
        )}

        <div className='absolute bottom-6 right-4 z-[400] w-64 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#141414]/88 p-3 shadow-[0_14px_36px_rgba(0,0,0,0.42)] backdrop-blur-lg'>
          <SidePanel
            activeMonth={activeMonth}
            monthBuckets={monthBuckets}
            onMonthChange={setActiveMonth}
            regionAggregates={provinceAggregates}
            selectedRegionKey={selectedRegionKey}
            onRegionClick={handleRegionClick}
            boundaryByRegionKey={boundaryByRegionKey}
            isResolvingRegions={isResolvingRegions}
            isLoadingBoundaries={isLoadingBoundaries}
            className=''
            monthListClassName='flex gap-1 overflow-x-auto pb-2 custom-scrollbar'
            regionListClassName='max-h-[240px] space-y-0.5 overflow-y-auto pr-1 custom-scrollbar'
          />
        </div>
      </div>

      <Dialog
        open={isPosterPreviewOpen}
        onOpenChange={(open) => {
          setIsPosterPreviewOpen(open);
          if (!open) {
            posterBlobRef.current = null;
            if (posterPreviewUrl) {
              URL.revokeObjectURL(posterPreviewUrl);
              setPosterPreviewUrl(null);
            }
          }
        }}
      >
        <DialogContent className='mx-4 w-full max-w-[1160px] border-white/10 bg-[#141414] p-4 sm:p-5'>
          <DialogHeader className='mb-3'>
            <DialogTitle className='text-base text-gray-200'>旅行海报预览</DialogTitle>
          </DialogHeader>
          <div className='overflow-hidden rounded-lg border border-white/10 bg-[#0A0A0A]'>
            {posterPreviewUrl ? (
              <img src={posterPreviewUrl} alt='旅行海报预览' className='h-auto w-full object-contain' />
            ) : (
              <div className='flex h-[360px] items-center justify-center text-sm text-gray-500'>预览不可用</div>
            )}
          </div>
          <DialogFooter className='mt-4 gap-2'>
            <Button variant='outline' onClick={handleDownloadPoster} disabled={!posterPreviewUrl || isPosterActionRunning} className="border-white/10 bg-white/5 text-gray-300 hover:bg-white/10">
              下载 PNG
            </Button>
            <Button variant='default' onClick={() => void handleCopyPoster()} disabled={!posterPreviewUrl || isPosterActionRunning}>
              {isPosterActionRunning ? "复制中..." : "复制到剪贴板"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default PhotoMapView;
