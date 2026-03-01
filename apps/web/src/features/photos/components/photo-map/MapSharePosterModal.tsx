import React, { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

interface MapSharePosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapImageUrl: string | null;
  photosCount: number;
  regionsCount: number;
}

const MapSharePosterModal: React.FC<MapSharePosterModalProps> = ({
  isOpen,
  onClose,
  mapImageUrl,
  photosCount,
  regionsCount,
}) => {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!posterRef.current) return;
    try {
      setIsSaving(true);
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        quality: 0.9,
      });

      const link = document.createElement("a");
      link.download = `lumina-footprint-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate poster", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm sm:max-w-md bg-[#0a0a0a] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-gray-200">Share Map Footprint</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-5 py-2">
          {/* Poster Container */}
          <div 
            ref={posterRef}
            className="flex w-full flex-col overflow-hidden rounded-[1.5rem] bg-[#121212] shadow-[0_0_40px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
          >
            {/* Header Content */}
            <div className="flex flex-col gap-6 p-6 sm:p-7 shrink-0">
              {/* Top Area: Logo & Subtitle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1 drop-shadow-md">
                  <h2 className="font-serif text-2xl font-bold italic tracking-wider text-white">
                    Lumina
                  </h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                    My Footprint
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#0a0a0a] text-lg font-black text-white shadow-lg">
                  L
                </div>
              </div>

              {/* Catchphrase & Stats */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/60">
                      Captured
                    </p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-xl font-bold text-white drop-shadow-sm">{photosCount}</p>
                      <p className="text-xs text-white/50">Photos</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/60">
                      Visited
                    </p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-xl font-bold text-white drop-shadow-sm">{regionsCount}</p>
                      <p className="text-xs text-white/50">Regions</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Image Layer */}
            <div className="relative w-full aspect-square bg-[#0a0a0a]">
              {mapImageUrl ? (
                <img 
                  src={mapImageUrl} 
                  alt="Map Background" 
                  className="absolute inset-0 h-full w-full object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[#121212]">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                </div>
              )}
              {/* Fade gradient from top to blend with container */}
              <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#121212] to-transparent pointer-events-none" />
            </div>
          </div>

          <Button 
            className="w-full rounded-xl bg-white text-black hover:bg-gray-200" 
            size="lg" 
            onClick={handleSave} 
            disabled={isSaving || !mapImageUrl}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Download className="mr-2 h-5 w-5" />
            )}
            Save High-Res Poster
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MapSharePosterModal;
