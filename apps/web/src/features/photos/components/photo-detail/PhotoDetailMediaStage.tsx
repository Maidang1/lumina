import React from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { DialogTitle } from "@/shared/ui/dialog";
import { Photo } from "@/features/photos/types";
import { PhotoDetailLoadState } from "@/features/photos/components/photo-detail/usePhotoDetailMedia";

interface PhotoDetailMediaStageProps {
  photo: Photo;
  loadState: PhotoDetailLoadState;
  isOriginalLoaded: boolean;
  loadProgress: number;
  thumbnailImageRef: React.RefObject<HTMLImageElement | null>;
  imageContainerRef: React.RefObject<HTMLDivElement | null>;
  onOriginalLoaded: () => void;
  onOriginalError: () => void;
}

const PhotoDetailMediaStage: React.FC<PhotoDetailMediaStageProps> = ({
  photo,
  loadState,
  isOriginalLoaded,
  loadProgress,
  thumbnailImageRef,
  imageContainerRef,
  onOriginalLoaded,
  onOriginalError,
}) => {
  return (
    <div
      ref={imageContainerRef}
      className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-transparent will-change-transform"
    >
      <DialogTitle className="sr-only">{photo.title}</DialogTitle>

      <div className="relative z-10 flex h-full w-full min-w-0 items-center justify-center overflow-hidden">
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <img
              src={photo.thumbnail}
              alt=""
              aria-hidden
              className="h-full w-full scale-110 object-cover blur-lg"
            />
            <div className="absolute inset-0 bg-black/25" />
          </div>

          <img
            ref={thumbnailImageRef}
            src={photo.thumbnail}
            alt={photo.title}
            width={photo.width}
            height={photo.height}
            className={`absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full object-contain transition-opacity duration-300 ${
              isOriginalLoaded ? "opacity-0" : "opacity-100"
            }`}
          />

          <motion.img
            src={photo.url}
            alt={photo.title}
            width={photo.width}
            height={photo.height}
            className="absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full object-contain"
            initial={{ opacity: 0 }}
            animate={{ opacity: isOriginalLoaded ? 1 : 0 }}
            transition={{ duration: 0.22 }}
            onLoad={onOriginalLoaded}
            onError={onOriginalError}
          />
        </div>

        {loadState === "loading" && (
          <div className="absolute right-3 bottom-3 z-30 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/70 px-2.5 py-1.5 backdrop-blur-md">
            <Loader2 className="h-3 w-3 animate-spin text-white/60" />
            <span className="text-[10px] text-white/50">Original {loadProgress}%</span>
            <div className="h-1 w-10 overflow-hidden rounded-full bg-white/[0.1]">
              <div
                className="h-full rounded-full bg-[#c9a962]/60 transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
          </div>
        )}

        {loadState === "error" && (
          <div className="absolute right-3 bottom-3 z-30 rounded-lg border border-amber-300/20 bg-black/80 px-3 py-1.5 text-[10px] text-amber-200 backdrop-blur-md">
            Failed to load original. Showing preview.
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoDetailMediaStage;
