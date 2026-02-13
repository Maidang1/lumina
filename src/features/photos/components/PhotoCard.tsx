import React, { useCallback, useEffect, useRef, useState } from "react";
import { animated, to, useSpring } from "@react-spring/web";
import { Photo } from "@/features/photos/types";
import { Aperture, Disc, Timer } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { videoLoaderManager } from "@/features/photos/services/videoLoaderManager";
import { useLivePhotoControls } from "./hooks/useLivePhotoControls";

interface PhotoCardProps {
  photo: Photo;
  index: number;
  onClick: (photo: Photo) => void;
}

function formatExifValue(value?: string | number): string {
  if (!value) return "未知";
  const normalized = typeof value === "string" ? value.trim() : value.toString();
  if (!normalized) return "未知";
  if (normalized === "?" || normalized === "0") return "未知";
  const lower = normalized.toLowerCase();
  if (lower === "unknown" || lower.includes("?")) return "未知";
  return normalized;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, index, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isConvertingVideo, setIsConvertingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const hasVideo = photo.videoSource?.type === "live-photo";

  const enterSpring = useSpring({
    from: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 20,
      scale: prefersReducedMotion ? 1 : 0.985,
    },
    to: {
      opacity: isVisible ? 1 : 0,
      y: isVisible ? 0 : prefersReducedMotion ? 0 : 8,
      scale: isVisible ? 1 : prefersReducedMotion ? 1 : 0.985,
    },
    delay: prefersReducedMotion ? 0 : Math.min(index, 24) * 35,
    config: { tension: 240, friction: prefersReducedMotion ? 35 : 24 },
  });

  const hoverSpring = useSpring({
    to: {
      scale: isHovered && !prefersReducedMotion ? 1.012 : 1,
      overlayOpacity: isHovered ? 1 : 0,
      overlayY: isHovered && !prefersReducedMotion ? 0 : 10,
    },
    config: { tension: 320, friction: prefersReducedMotion ? 35 : 26 },
  });

  const imageSpring = useSpring({
    opacity: isLoaded ? 1 : 0,
    config: { tension: 210, friction: prefersReducedMotion ? 35 : 24 },
  });

  const stopVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setIsVideoPlaying(false);
  }, []);

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isVideoReady || isConvertingVideo || isVideoPlaying) return;
    setVideoError(null);
    setIsVideoPlaying(true);
    video.currentTime = 0;
    video.play().catch(() => {
      setIsVideoPlaying(false);
      setVideoError("实况视频播放失败");
    });
  }, [isConvertingVideo, isVideoPlaying, isVideoReady]);

  const { handleStart: handleHoverStart, handleEnd: handleHoverEnd } = useLivePhotoControls({
    mode: "hover",
    enabled: hasVideo,
    isPlaying: isVideoPlaying,
    isVideoReady,
    onPlay: playVideo,
    onStop: stopVideo,
    delayMs: 200,
    disableHover: prefersReducedMotion,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };
    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMotionChange);
    return () => mediaQuery.removeEventListener("change", handleMotionChange);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "200px",
      },
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasVideo || !isLoaded || !isVisible || isVideoReady || !videoRef.current || !photo.videoSource) {
      return;
    }
    let cancelled = false;
    setIsConvertingVideo(false);
    setVideoError(null);
    void videoLoaderManager
      .processVideo(photo.videoSource, videoRef.current, {
        onLoadingStateUpdate: (state) => {
          if (cancelled) return;
          setIsConvertingVideo(Boolean(state.isConverting));
        },
      })
      .then(() => {
        if (!cancelled) {
          setIsVideoReady(true);
          setVideoError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVideoError("实况视频加载失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasVideo, isLoaded, isVideoReady, isVisible, photo.videoSource]);

  useEffect(() => {
    return () => {
      stopVideo();
    };
  }, [stopVideo]);

  return (
    <animated.div
      ref={cardRef}
      className='group relative mb-2 break-inside-avoid cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[#17171c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:mb-3'
      role='button'
      tabIndex={0}
      aria-label={`查看图片 ${photo.title}`}
      onClick={() => onClick(photo)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(photo);
        }
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        handleHoverStart();
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        handleHoverEnd();
      }}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      <animated.div
        className='h-full w-full'
        style={{
          opacity: enterSpring.opacity,
          transform: to(
            [enterSpring.y, hoverSpring.scale],
            (y, scale) => `translate3d(0, ${y}px, 0) scale(${scale})`,
          ),
        }}
      >
        {isVisible && (
          <animated.img
            src={photo.thumbnail}
            alt={photo.title}
            className='h-full w-full object-cover'
            style={{ opacity: imageSpring.opacity }}
            onLoad={() => setIsLoaded(true)}
          />
        )}
      </animated.div>

      {hasVideo && (
        <video
          ref={videoRef}
          className='pointer-events-none absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-200'
          style={{ opacity: isVideoPlaying ? 1 : 0 }}
          muted
          playsInline
          preload='metadata'
          onEnded={stopVideo}
        />
      )}

      {!isLoaded && <div className='absolute inset-0 animate-pulse bg-[#1a1a1a]' />}

      <animated.div
        className='absolute inset-0 hidden flex-col justify-end bg-gradient-to-t from-black/90 via-black/45 to-transparent p-5 md:flex lg:p-6'
        style={{
          opacity: hoverSpring.overlayOpacity,
          transform: hoverSpring.overlayY.to((y) => `translate3d(0, ${y}px, 0)`),
        }}
      >
        <h3 className='mb-1 font-sans text-2xl font-bold tracking-tight text-white'>{photo.filename}</h3>

        <p className='mb-3 text-sm font-medium text-gray-300 opacity-90'>
          {photo.format} <span className='mx-1'>•</span> {photo.width} × {photo.height} <span className='mx-1'>•</span>{" "}
          {photo.size}
        </p>

        <div className='grid grid-cols-2 gap-2'>
          <Card className='border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm'>
            <CardContent className='flex h-12 items-center gap-3 px-3 py-0'>
              <div className='flex h-6 w-6 items-center justify-center text-white'>
                <Disc size={18} />
              </div>
              <span className='flex items-center text-sm font-medium leading-none text-white'>
                {formatExifValue(photo.exif.focalLength)}
              </span>
            </CardContent>
          </Card>

          <Card className='border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm'>
            <CardContent className='flex h-12 items-center gap-3 px-3 py-0'>
              <div className='flex h-6 w-6 items-center justify-center text-white'>
                <Aperture size={18} />
              </div>
              <span className='flex items-center text-sm font-medium leading-none text-white'>
                {formatExifValue(photo.exif.aperture)}
              </span>
            </CardContent>
          </Card>

          <Card className='border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm'>
            <CardContent className='flex h-12 items-center gap-3 px-3 py-0'>
              <div className='flex h-6 w-6 items-center justify-center text-white'>
                <Timer size={18} />
              </div>
              <span className='flex items-center text-sm font-medium leading-none text-white'>
                {formatExifValue(photo.exif.shutter)}
              </span>
            </CardContent>
          </Card>

          <Card className='border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm'>
            <CardContent className='flex h-12 items-center gap-3 px-3 py-0'>
              <div className='flex h-6 w-6 items-center justify-center rounded-[4px] border border-white text-[10px] font-bold leading-none text-white'>
                ISO
              </div>
              <span className='flex items-center text-sm font-medium leading-none text-white'>
                {formatExifValue(photo.exif.iso)}
              </span>
            </CardContent>
          </Card>
        </div>
      </animated.div>

      <div className='absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-8 md:hidden'>
        {photo.isLive && (
          <span className='mb-2 inline-flex rounded-full border border-amber-300/60 bg-amber-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-100'>
            {isConvertingVideo ? "CONVERTING" : "LIVE"}
          </span>
        )}
        <div className='flex items-center justify-between gap-2'>
          <p className='truncate text-sm font-semibold text-white'>{photo.filename ?? "--"}</p>
        </div>
        <p className='mt-1 truncate text-[11px] text-gray-300'>
          {formatExifValue(photo.exif.aperture)} • {formatExifValue(photo.exif.shutter)} • ISO{" "}
          {formatExifValue(photo.exif.iso)}
        </p>
      </div>

      {photo.isLive && (
        <span className='absolute left-3 top-3 hidden rounded-full border border-amber-300/60 bg-amber-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-100 md:inline-flex'>
          {isConvertingVideo ? "CONVERTING" : "LIVE"}
        </span>
      )}

      {videoError && (
        <span className='absolute bottom-2 right-2 z-20 rounded bg-black/50 px-2 py-1 text-[10px] text-rose-200'>
          {videoError}
        </span>
      )}
    </animated.div>
  );
};

export default PhotoCard;
