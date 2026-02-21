import React, { useRef } from "react";
import { Loader2, MapPin, Share2 } from "lucide-react";
import { Photo } from "@/features/photos/types";
import { RegionAggregate } from "@/features/photos/types/map";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import MapSidePanel from "@/features/photos/components/photo-map/MapSidePanel";
import { useMapRegionData } from "@/features/photos/components/photo-map/useMapRegionData";
import { useLeafletMapLayer } from "@/features/photos/components/photo-map/useLeafletMapLayer";
import { useMapPosterShare } from "@/features/photos/components/photo-map/useMapPosterShare";

interface PhotoMapViewProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

const PhotoMapView: React.FC<PhotoMapViewProps> = ({ photos, onPhotoClick }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    activeMonth,
    setActiveMonth,
    monthBuckets,
    visiblePoints,
    provinceAggregates,
    timeRangeLabel,
    selectedRegionKey,
    setSelectedRegionKey,
    boundaryByRegionKey,
    isResolvingRegions,
    isLoadingBoundaries,
  } = useMapRegionData(photos);

  const { mapReady, mapError, focusRegion, captureCurrentMapCanvas } = useLeafletMapLayer({
    mapContainerRef,
    activeMonth,
    visiblePoints,
    provinceAggregates,
    boundaryByRegionKey,
    selectedRegionKey,
    setSelectedRegionKey: (key) => setSelectedRegionKey(key),
    onPhotoClick,
  });

  const {
    isSharing,
    isPosterPreviewOpen,
    posterPreviewUrl,
    isPosterActionRunning,
    handleShareMap,
    handleDownloadPoster,
    handleCopyPoster,
    closePosterPreview,
  } = useMapPosterShare({
    visiblePointsCount: visiblePoints.length,
    regionAggregates: provinceAggregates,
    timeRangeLabel,
    captureCurrentMapCanvas,
  });

  const handleRegionClick = (aggregate: RegionAggregate): void => {
    setSelectedRegionKey(aggregate.key);
    focusRegion(aggregate);
    if (aggregate.photos[0]) {
      onPhotoClick(aggregate.photos[0]);
    }
  };

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0a0a0a]">
      <div className="absolute left-4 top-4 z-[400] flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.12] bg-[#141414]/88 px-4 py-2.5 shadow-[0_14px_38px_rgba(0,0,0,0.42)] backdrop-blur-lg transition-colors duration-200 hover:bg-[#161616]/95">
        <div className="flex items-center gap-2 text-gray-200">
          <MapPin size={16} className="text-gray-400" />
          <h2 className="text-sm font-medium">Map Footprint</h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-400">
            {visiblePoints.length} points
          </span>
        </div>
      </div>

      <div className="absolute right-4 top-4 z-[400] flex items-center gap-2">
        <Button
          type="button"
          onClick={() => {
            void handleShareMap();
          }}
          disabled={isSharing}
          variant="outline"
          className="h-9 cursor-pointer rounded-full border-white/[0.12] bg-[#141414]/90 px-4 text-xs font-medium text-gray-200 shadow-[0_10px_30px_rgba(0,0,0,0.32)] backdrop-blur-md transition-colors duration-200 hover:bg-[#181818] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
          <span>Share</span>
        </Button>
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
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">Loading map...</div>
        )}

        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-400">{mapError}</div>
        )}

        <div className="absolute bottom-6 right-4 z-[400] w-64 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#141414]/88 p-3 shadow-[0_14px_36px_rgba(0,0,0,0.42)] backdrop-blur-lg">
          <MapSidePanel
            activeMonth={activeMonth}
            monthBuckets={monthBuckets}
            onMonthChange={setActiveMonth}
            regionAggregates={provinceAggregates}
            selectedRegionKey={selectedRegionKey}
            onRegionClick={handleRegionClick}
            isResolvingRegions={isResolvingRegions}
            isLoadingBoundaries={isLoadingBoundaries}
          />
        </div>
      </div>

      <Dialog
        open={isPosterPreviewOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePosterPreview();
          }
        }}
      >
        <DialogContent className="mx-4 w-full max-w-[1160px] border-white/10 bg-[#141414] p-4 sm:p-5">
          <DialogHeader className="mb-3">
            <DialogTitle className="text-base text-gray-200">Travel Poster Preview</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0A0A0A]">
            {posterPreviewUrl ? (
              <img src={posterPreviewUrl} alt="Travel poster preview" className="h-auto w-full object-contain" />
            ) : (
              <div className="flex h-[360px] items-center justify-center text-sm text-gray-500">Preview unavailable</div>
            )}
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadPoster}
              disabled={!posterPreviewUrl || isPosterActionRunning}
              className="border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
            >
              Download PNG
            </Button>
            <Button
              variant="default"
              onClick={() => {
                void handleCopyPoster();
              }}
              disabled={!posterPreviewUrl || isPosterActionRunning}
            >
              {isPosterActionRunning ? "Copying..." : "Copy to Clipboard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default PhotoMapView;
