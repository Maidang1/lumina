import React, { useRef, useState } from "react";
import { MapPin, RefreshCw, Share2, Loader2 } from "lucide-react";
import { Photo } from "@/features/photos/types";
import { MagicCard } from "@/shared/magicui/magic-card";
import MapSidePanel from "@/features/photos/components/photo-map/MapSidePanel";
import { useMapRegionData } from "@/features/photos/components/photo-map/useMapRegionData";
import { useLeafletMapLayer } from "@/features/photos/components/photo-map/useLeafletMapLayer";
import MapSharePosterModal from "@/features/photos/components/photo-map/MapSharePosterModal";

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
    isLoadingBoundaries,
    refreshBoundaries,
  } = useMapRegionData(photos);

  const { mapReady, mapError, captureCurrentMapCanvas } = useLeafletMapLayer({
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

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [mapSnapshotUrl, setMapSnapshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleShareClick = async () => {
    // Open modal immediately to give instant feedback
    setIsShareModalOpen(true);
    setMapSnapshotUrl(null);

    try {
      setIsCapturing(true);
      // Small delay to allow modal entrance animation to play before blocking thread with canvas generation
      await new Promise((resolve) => setTimeout(resolve, 200));

      const canvas = await captureCurrentMapCanvas();
      // Use jpeg encoding instead of png for much faster serialization
      setMapSnapshotUrl(canvas.toDataURL("image/jpeg", 0.85));
    } catch (error) {
      console.error("Failed to capture map:", error);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <>
      <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a]">
      <MagicCard className="absolute top-3 left-3 z-[400] max-w-[calc(100vw-24px)] rounded-2xl sm:top-4 sm:left-4">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
          <div className="flex items-center gap-2 text-gray-200">
            <MapPin size={16} className="text-gray-400" />
            <h2 className="text-sm font-medium">Map Footprint</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-400">
              {visiblePoints.length} points
            </span>
          </div>
          <button
            type="button"
            onClick={refreshBoundaries}
            disabled={isLoadingBoundaries || isCapturing}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            title="Refresh map boundaries"
          >
            <RefreshCw size={14} className={isLoadingBoundaries ? "animate-spin" : ""} />
          </button>
          
          <div className="h-4 w-px bg-white/10" />

          <button
            type="button"
            onClick={handleShareClick}
            disabled={isCapturing || isLoadingBoundaries}
            className="flex h-7 px-2 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            title="Create Share Poster"
          >
            {isCapturing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Share2 size={14} />
            )}
            <span>Share</span>
          </button>
        </div>
      </MagicCard>

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

        <MagicCard className="absolute right-3 bottom-3 left-3 z-[400] overflow-hidden rounded-2xl sm:right-4 sm:bottom-6 sm:left-auto sm:w-64 sm:max-w-[calc(100vw-32px)]">
          <div className="p-2.5 sm:p-3">
            <MapSidePanel
              activeMonth={activeMonth}
              monthBuckets={monthBuckets}
              onMonthChange={setActiveMonth}
              visiblePointsCount={visiblePoints.length}
            />
          </div>
        </MagicCard>
      </div>
    </section>

      <MapSharePosterModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        mapImageUrl={mapSnapshotUrl}
        photosCount={visiblePoints.length}
        regionsCount={provinceAggregates.filter((agg) => agg.count > 0).length}
      />
    </>
  );
};

export default PhotoMapView;
