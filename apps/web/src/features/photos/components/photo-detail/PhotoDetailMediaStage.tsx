import React from "react";
import { animated, SpringValue } from "@react-spring/web";
import { Loader2 } from "lucide-react";
import { DialogTitle } from "@/shared/ui/dialog";
import { Photo } from "@/features/photos/types";

interface PhotoDetailMediaStageProps {
  photo: Photo;
  hasVideo: boolean;
  isOriginalLoaded: boolean;
  loadProgress: number;
  isLivePlaying: boolean;
  liveFrameSize: { width: number; height: number } | null;
  liveVideoRef: React.RefObject<HTMLVideoElement | null>;
  thumbnailImageRef: React.RefObject<HTMLImageElement | null>;
  imageContainerRef: React.RefObject<HTMLDivElement | null>;
  onOriginalLoaded: () => void;
  onStopVideo: () => void;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
  useAnimation: boolean;
  animationSpring: {
    x: SpringValue<number>;
    y: SpringValue<number>;
    width: SpringValue<number>;
    height: SpringValue<number>;
    borderRadius: SpringValue<number>;
  };
  imageOpacity: SpringValue<number>;
}

const PhotoDetailMediaStage: React.FC<PhotoDetailMediaStageProps> = ({
  photo,
  hasVideo,
  isOriginalLoaded,
  loadProgress,
  isLivePlaying,
  liveFrameSize,
  liveVideoRef,
  thumbnailImageRef,
  imageContainerRef,
  onOriginalLoaded,
  onStopVideo,
  onLongPressStart,
  onLongPressEnd,
  useAnimation,
  animationSpring,
  imageOpacity,
}) => {
  return (
    <div
      ref={imageContainerRef}
      className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-transparent p-4 md:p-6"
      onMouseDown={onLongPressStart}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
      onTouchStart={onLongPressStart}
      onTouchEnd={onLongPressEnd}
    >
      <DialogTitle className="sr-only">{photo.title}</DialogTitle>

      {useAnimation && (
        <animated.div
          className="pointer-events-none fixed z-[60] overflow-hidden shadow-2xl will-change-transform"
          style={{
            left: animationSpring.x,
            top: animationSpring.y,
            width: animationSpring.width,
            height: animationSpring.height,
            borderRadius: animationSpring.borderRadius,
          }}
        >
          <img src={photo.thumbnail} alt={photo.title} className="h-full w-full object-contain" />
        </animated.div>
      )}

      <div
        className={`relative z-10 flex h-full w-full min-w-0 items-center justify-center overflow-hidden transition-opacity duration-200 ${
          useAnimation ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
          <animated.img
            ref={thumbnailImageRef}
            src={photo.thumbnail}
            alt={photo.title}
            className="absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full object-contain"
            style={{ opacity: imageOpacity.to((value) => 1 - value) }}
          />

          <animated.img
            src={photo.url}
            alt={photo.title}
            className="absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full object-contain"
            style={{ opacity: imageOpacity }}
            onLoad={onOriginalLoaded}
          />
        </div>

        {hasVideo && (
          <video
            ref={liveVideoRef}
            className="pointer-events-none absolute left-1/2 top-1/2 object-cover shadow-2xl transition-opacity duration-200"
            style={{
              opacity: isLivePlaying ? 1 : 0,
              width: liveFrameSize?.width,
              height: liveFrameSize?.height,
              transform: "translate(-50%, -50%)",
            }}
            muted
            playsInline
            preload="metadata"
            poster={photo.thumbnail}
            onEnded={onStopVideo}
          />
        )}

        {hasVideo && (
          <div className="pointer-events-none absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-[#c9a962]/25 bg-black/50 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c9a962]/80" />
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#c9a962]">Live</span>
          </div>
        )}

        {!isOriginalLoaded && (
          <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/70 px-2.5 py-1.5 backdrop-blur-md">
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
      </div>
    </div>
  );
};

export default PhotoDetailMediaStage;
