import React, { useRef } from "react";
import { MapPin } from "lucide-react";
import { Photo } from "@/features/photos/types";
import MapSidePanel from "@/features/photos/components/photo-map/MapSidePanel";
import { useMapRegionData } from "@/features/photos/components/photo-map/useMapRegionData";
import { useLeafletMapLayer } from "@/features/photos/components/photo-map/useLeafletMapLayer";

interface PhotoMapViewProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

const PhotoMapView: React.FC<PhotoMapViewProps> = ({
  photos,
  onPhotoClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapTheme = "dark";
  const showRoute = false;

  const {
    activeMonth,
    setActiveMonth,
    monthBuckets,
    visiblePoints,
    provinceAggregates,
    selectedRegionKey,
    setSelectedRegionKey,
    boundaryByRegionKey,
  } = useMapRegionData(photos);

  const { mapReady, mapError } = useLeafletMapLayer({
    mapContainerRef,
    activeMonth,
    visiblePoints,
    routePoints: [],
    provinceAggregates,
    boundaryByRegionKey,
    selectedRegionKey,
    setSelectedRegionKey: (key) => setSelectedRegionKey(key),
    onPhotoClick,
    mapTheme,
    showRoute,
  });

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0a0a0a]">
      <div className="absolute left-3 top-3 z-[400] flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-2 rounded-2xl border border-white/[0.12] bg-[#141414]/88 px-3 py-2 shadow-[0_14px_38px_rgba(0,0,0,0.42)] backdrop-blur-lg transition-colors duration-200 hover:bg-[#161616]/95 sm:left-4 sm:top-4 sm:gap-3 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-2 text-gray-200">
          <MapPin size={16} className="text-gray-400" />
          <h2 className="text-sm font-medium">Map Footprint</h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-400">
            {visiblePoints.length} points
          </span>
        </div>
      </div>

      <div className="relative h-full w-full">
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

        <div ref={mapContainerRef} className="h-full w-full grayscale-[0.2]" />

        {!mapReady && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
            Loading map...
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-400">
            {mapError}
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 z-[400] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#141414]/88 p-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.42)] backdrop-blur-lg sm:bottom-6 sm:left-auto sm:right-4 sm:w-64 sm:max-w-[calc(100vw-32px)] sm:p-3">
          <MapSidePanel
            activeMonth={activeMonth}
            monthBuckets={monthBuckets}
            onMonthChange={setActiveMonth}
            visiblePointsCount={visiblePoints.length}
          />
        </div>
      </div>
    </section>
  );
};

export default PhotoMapView;
