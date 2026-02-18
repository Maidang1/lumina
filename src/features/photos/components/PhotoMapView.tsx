import React, { useMemo, useState } from "react";
import { ChevronDown, Loader2, MapPin, Share2 } from "lucide-react";
import { Photo } from "@/features/photos/types";

interface PhotoMapViewProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

interface GeoPoint {
  photo: Photo;
  lat: number;
  lng: number;
  monthKey: string;
}

interface LeafletWindow extends Window {
  L?: {
    map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
    tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayer;
    circleMarker: (latLng: [number, number], options?: Record<string, unknown>) => LeafletCircleMarker;
    layerGroup: () => LeafletLayerGroup;
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
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  on: (event: string, handler: () => void) => LeafletMap;
  remove: () => void;
  addLayer: (layer: unknown) => void;
  removeLayer: (layer: unknown) => void;
  invalidateSize: () => void;
}

interface LeafletLayer {
  addTo: (map: LeafletMap) => LeafletLayer;
  on?: (event: string, handler: () => void) => LeafletLayer;
}

interface LeafletCircleMarker {
  bindTooltip: (text: string) => LeafletCircleMarker;
  on: (event: string, handler: () => void) => LeafletCircleMarker;
}

interface LeafletLayerGroup {
  addTo: (map: LeafletMap) => LeafletLayerGroup;
  clearLayers: () => void;
  addLayer: (layer: LeafletCircleMarker) => void;
}

interface LeafletBounds {}

interface LocationSummary {
  country: string;
  region: string;
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
  pointColor: "#f1d8a3",
};

const roundCoordinate = (value: number): number => Math.round(value * 10) / 10;

const toLocationKey = (lat: number, lng: number): string => `${roundCoordinate(lat)},${roundCoordinate(lng)}`;

interface GroupedLocation {
  lat: number;
  lng: number;
  count: number;
  samples: string[];
}

interface TimelinePanelProps {
  activeMonth: string;
  pointsCount: number;
  monthBuckets: [string, number][];
  groupedLocations: GroupedLocation[];
  onMonthChange: (month: string) => void;
  onLocationClick: (group: GroupedLocation) => void;
  className?: string;
  monthListClassName?: string;
  locationListClassName?: string;
}

const TimelinePanel: React.FC<TimelinePanelProps> = ({
  activeMonth,
  pointsCount,
  monthBuckets,
  groupedLocations,
  onMonthChange,
  onLocationClick,
  className,
  monthListClassName,
  locationListClassName,
}) => {
  return (
    <aside className={className}>
      <p className='mb-2 text-xs text-zinc-400'>时间线</p>
      <button
        type='button'
        onClick={() => onMonthChange("all")}
        className={`mb-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition ${
          activeMonth === "all" ? "bg-white/[0.12] text-white" : "text-zinc-300 hover:bg-white/[0.06]"
        }`}
      >
        <span>全部时间</span>
        <span>{pointsCount}</span>
      </button>
      <div className={monthListClassName}>
        {monthBuckets.map(([month, count]) => (
          <button
            key={month}
            type='button'
            onClick={() => onMonthChange(month)}
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition ${
              activeMonth === month ? "bg-[#c9a962]/20 text-[#e8d19a]" : "text-zinc-300 hover:bg-white/[0.06]"
            }`}
          >
            <span>{month}</span>
            <span>{count}</span>
          </button>
        ))}
      </div>
      <div className='mt-3 border-t border-white/[0.08] pt-3'>
        <p className='mb-2 text-xs text-zinc-400'>位置聚合</p>
        <div className={locationListClassName}>
          {groupedLocations.slice(0, 30).map((group, index) => (
            <button
              key={`loc-group-${group.lat}-${group.lng}`}
              type='button'
              onClick={() => onLocationClick(group)}
              className='flex w-full items-start justify-between rounded-md px-2 py-1.5 text-left text-xs text-zinc-300 transition hover:bg-white/[0.06]'
            >
              <span className='max-w-[62%] truncate'>
                区域 {String(index + 1).padStart(2, "0")} · {group.samples[0]}
              </span>
              <span className='font-mono text-[10px] text-zinc-400'>{group.count} 张</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
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

const parseCoordinate = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const getPhotoCoordinates = (photo: Photo): { lat: number; lng: number } | null => {
  const exif = (photo.metadata?.exif ?? {}) as Record<string, unknown>;
  const lat = parseCoordinate(exif.GPSLatitude);
  const lng = parseCoordinate(exif.GPSLongitude);
  if (lat === null || lng === null) {
    return null;
  }
  return { lat, lng };
};

const PhotoMapView: React.FC<PhotoMapViewProps> = ({ photos, onPhotoClick }) => {
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const markerLayerRef = React.useRef<LeafletLayerGroup | null>(null);
  const baseTileLayerRef = React.useRef<LeafletLayer | null>(null);
  const overlayTileLayerRef = React.useRef<LeafletLayer | null>(null);
  const locationCacheRef = React.useRef<Map<string, LocationSummary>>(new Map());

  const points = useMemo<GeoPoint[]>(() => {
    return photos
      .map((photo) => {
        const coords = getPhotoCoordinates(photo);
        if (!coords) return null;

        const date = new Date(photo.exif.date);
        const monthKey = Number.isNaN(date.getTime())
          ? "未知时间"
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        return {
          photo,
          lat: coords.lat,
          lng: coords.lng,
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

  const visiblePoints = useMemo(() => {
    return points.filter((point) => activeMonth === "all" || point.monthKey === activeMonth);
  }, [activeMonth, points]);

  const groupedLocations = useMemo(() => {
    const groups = new Map<string, GroupedLocation>();
    for (const point of visiblePoints) {
      const lat = roundCoordinate(point.lat);
      const lng = roundCoordinate(point.lng);
      const key = toLocationKey(lat, lng);
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { lat, lng, count: 1, samples: [point.photo.filename] });
        continue;
      }
      existing.count += 1;
      if (existing.samples.length < 3) {
        existing.samples.push(point.photo.filename);
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [visiblePoints]);

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
          });

          const baseTileLayer = L.tileLayer(MAP_THEME_PRESET.baseTileUrl, {
            crossOrigin: true,
            attribution: MAP_THEME_PRESET.baseAttribution,
            noWrap: true,
          }).addTo(map);
          baseTileLayerRef.current = baseTileLayer;

          const overlayTileLayer = L.tileLayer(MAP_THEME_PRESET.overlayTileUrl, {
            crossOrigin: true,
            attribution: MAP_THEME_PRESET.overlayAttribution,
            noWrap: true,
            opacity: 0.72,
          }).addTo(map);
          overlayTileLayerRef.current = overlayTileLayer;

          map.setMaxBounds(asiaBounds);
          map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
          map.on("moveend", () => {
            const center = map.getCenter();
            const zoom = map.getZoom();
            console.log("[Map]", "center:", { lat: center.lat, lng: center.lng }, "zoom:", zoom);
          });
          map.on("zoomend", () => {
            const center = map.getCenter();
            const zoom = map.getZoom();
            console.log("[Map]", "center:", { lat: center.lat, lng: center.lng }, "zoom:", zoom);
          });
          mapRef.current = map;

          markerLayerRef.current = L.layerGroup().addTo(map);
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
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    const windowWithLeaflet = window as LeafletWindow;
    const L = windowWithLeaflet.L;
    if (!map || !markerLayer || !L) return;

    markerLayer.clearLayers();

    const coordinates: [number, number][] = [];
    for (const point of visiblePoints) {
      const lat = roundCoordinate(point.lat);
      const lng = roundCoordinate(point.lng);
      coordinates.push([lat, lng]);

      const marker = L.circleMarker([lat, lng], {
        radius: 4,
        color: MAP_THEME_PRESET.pointColor,
        fillColor: MAP_THEME_PRESET.pointColor,
        fillOpacity: 1,
        weight: 0,
      })
        .bindTooltip(point.photo.filename)
        .on("click", () => onPhotoClick(point.photo));
      markerLayer.addLayer(marker);
    }

    if (coordinates.length === 0) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    }

    window.setTimeout(() => {
      map.invalidateSize();
    }, 50);
  }, [mapReady, onPhotoClick, visiblePoints]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleResize = (): void => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleResize);

    const observer =
      typeof ResizeObserver !== "undefined" && mapContainerRef.current
        ? new ResizeObserver(() => {
            map.invalidateSize();
          })
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
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      baseTileLayerRef.current = null;
      overlayTileLayerRef.current = null;
    };
  }, []);

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

  const reverseGeocode = React.useCallback(async (lat: number, lng: number): Promise<LocationSummary> => {
    const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
    const cached = locationCacheRef.current.get(key);
    if (cached) return cached;

    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("zoom", "6");
      url.searchParams.set("addressdetails", "1");

      const response = await fetch(url.toString(), {
        headers: {
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
      });
      if (!response.ok) throw new Error("reverse geocode failed");

      const data = (await response.json()) as { address?: Record<string, string> };
      const address = data.address ?? {};
      const summary: LocationSummary = {
        country: address.country || "未知国家",
        region:
          address.state ||
          address.province ||
          address.region ||
          address.city ||
          address.county ||
          "未知地区",
      };
      locationCacheRef.current.set(key, summary);
      return summary;
    } catch {
      const summary: LocationSummary = { country: "未知国家", region: "未知地区" };
      locationCacheRef.current.set(key, summary);
      return summary;
    }
  }, []);

  const handleShareMap = React.useCallback(async (): Promise<void> => {
    if (visiblePoints.length === 0) {
      window.alert("当前没有可分享的地图点位");
      return;
    }

    setIsSharing(true);
    try {
      const mapCanvas = await captureCurrentMapCanvas();
      const sampleGroups = groupedLocations.slice(0, 10);
      const summaries = await Promise.all(sampleGroups.map((group) => reverseGeocode(group.lat, group.lng)));
      const countries = Array.from(new Set(summaries.map((item) => item.country))).slice(0, 6);
      const regions = Array.from(new Set(summaries.map((item) => item.region))).slice(0, 8);

      const output = document.createElement("canvas");
      output.width = 1600;
      output.height = 1000;
      const ctx = output.getContext("2d");
      if (!ctx) {
        throw new Error("无法生成分享图片");
      }

      ctx.drawImage(mapCanvas, 0, 0, output.width, output.height);
      const overlay = ctx.createLinearGradient(0, 0, 0, output.height);
      overlay.addColorStop(0, "rgba(5,6,10,0.25)");
      overlay.addColorStop(1, "rgba(5,6,10,0.8)");
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, output.width, output.height);

      ctx.fillStyle = "rgba(10,10,14,0.78)";
      ctx.fillRect(70, 70, 620, 320);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(70, 70, 620, 320);

      ctx.fillStyle = "#f3d79f";
      ctx.font = "600 44px 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText("我去过哪些国家和地区？", 108, 145);

      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.font = "400 28px 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText(`拍摄点位 ${visiblePoints.length} 个`, 108, 198);

      ctx.font = "400 24px 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(`国家：${countries.join("、") || "未知"}`, 108, 248);
      ctx.fillText(`地区：${regions.join("、") || "未知"}`, 108, 292);

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "400 20px 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText("Generated by Lumina Map Share", 108, 350);

      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
      if (!blob) {
        throw new Error("图片导出失败");
      }

      if ("clipboard" in navigator && "write" in navigator.clipboard) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": blob,
            }),
          ]);
          window.alert("地图分享图已复制到剪贴板");
        } catch {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "lumina-map-share.png";
          link.click();
          URL.revokeObjectURL(url);
          window.alert("浏览器不支持直接复制，已下载图片");
        }
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "lumina-map-share.png";
        link.click();
        URL.revokeObjectURL(url);
        window.alert("浏览器不支持直接复制，已下载图片");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成分享图失败";
      window.alert(message);
    } finally {
      setIsSharing(false);
    }
  }, [captureCurrentMapCanvas, groupedLocations, reverseGeocode, visiblePoints.length]);

  const handleGroupedLocationClick = React.useCallback((group: GroupedLocation): void => {
    const target = visiblePoints.find(
      (point) => toLocationKey(point.lat, point.lng) === toLocationKey(group.lat, group.lng)
    );
    if (target) {
      onPhotoClick(target.photo);
    }
  }, [onPhotoClick, visiblePoints]);

  return (
    <section className='flex h-full min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[0_14px_44px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-5'>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2 text-zinc-200'>
          <MapPin size={14} />
          <h2 className='text-sm'>地图视图</h2>
          <span className='rounded-md border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[11px] text-zinc-400'>
            {visiblePoints.length} 个点位
          </span>
        </div>

        <div className='flex items-center gap-2'>
          <span className='inline-flex h-8 items-center rounded-lg border border-[#c9a962]/25 bg-[#c9a962]/10 px-3 text-xs text-[#d8bd80]'>
            轮廓地图
          </span>
          <button
            type='button'
            onClick={() => {
              void handleShareMap();
            }}
            disabled={isSharing}
            className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.12] bg-black/30 px-3 text-xs text-zinc-200 transition hover:border-white/[0.22] disabled:cursor-not-allowed disabled:opacity-60'
          >
            {isSharing ? <Loader2 size={12} className='animate-spin' /> : <Share2 size={12} />}
            分享地图
          </button>
          <button
            type='button'
            className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.12] bg-black/30 px-3 text-xs text-zinc-200 transition hover:border-white/[0.22] lg:hidden'
            onClick={() => setIsMobilePanelOpen((prev) => !prev)}
          >
            时间线
            <ChevronDown size={12} className={`transition-transform ${isMobilePanelOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      <div className='grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]'>
        <div className='relative h-full min-h-[420px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f2031]'>
          <style>{`
            .leaflet-tooltip {
              background: rgba(8, 8, 10, 0.85);
              border: 1px solid rgba(255, 255, 255, 0.08);
              color: rgba(255, 255, 255, 0.9);
            }
            .leaflet-tooltip:before {
              border-top-color: rgba(8, 8, 10, 0.85) !important;
            }
            .leaflet-control-attribution {
              background: rgba(8, 8, 10, 0.7) !important;
              color: rgba(255, 255, 255, 0.58) !important;
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-bottom: 0;
              border-right: 0;
            }
          `}</style>
          <div ref={mapContainerRef} className='h-full w-full' />

          {!mapReady && !mapError && (
            <div className='absolute inset-0 flex items-center justify-center text-xs text-zinc-400'>
              正在加载 OpenStreetMap...
            </div>
          )}

          {mapError && (
            <div className='absolute inset-0 flex items-center justify-center text-xs text-rose-300'>
              {mapError}
            </div>
          )}

          {mapReady && visiblePoints.length === 0 && (
            <div className='pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-300/90'>
              没有可显示的地理坐标（图片无 GPS 信息）
            </div>
          )}
        </div>

        <TimelinePanel
          activeMonth={activeMonth}
          pointsCount={points.length}
          monthBuckets={monthBuckets}
          groupedLocations={groupedLocations}
          onMonthChange={setActiveMonth}
          onLocationClick={handleGroupedLocationClick}
          className='hidden min-h-0 rounded-xl border border-white/[0.08] bg-black/25 p-3 lg:block'
          monthListClassName='max-h-[38svh] space-y-1 overflow-auto pr-1 lg:max-h-[46svh]'
          locationListClassName='max-h-[20svh] space-y-1 overflow-auto pr-1 lg:max-h-[24svh]'
        />
      </div>

      {isMobilePanelOpen && (
        <TimelinePanel
          activeMonth={activeMonth}
          pointsCount={points.length}
          monthBuckets={monthBuckets}
          groupedLocations={groupedLocations}
          onMonthChange={setActiveMonth}
          onLocationClick={handleGroupedLocationClick}
          className='mt-3 rounded-xl border border-white/[0.08] bg-black/25 p-3 lg:hidden'
          monthListClassName='max-h-[24svh] space-y-1 overflow-auto pr-1'
          locationListClassName='max-h-[22svh] space-y-1 overflow-auto pr-1'
        />
      )}
    </section>
  );
};

export default PhotoMapView;
