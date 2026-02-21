import React, { useCallback, useEffect, useRef, useState } from 'react';
import { animated, to, useSpring } from '@react-spring/web';
import { Star } from 'lucide-react';
import { Photo, PhotoOpenTransition } from '@/features/photos/types';
import { videoLoaderManager } from '@/features/photos/services/videoLoaderManager';
import { useLivePhotoControls } from './hooks/useLivePhotoControls';
import { Button } from '@/shared/ui/button';

interface PhotoCardProps {
  photo: Photo;
  index: number;
  onClick?: (photo: Photo, transitionSource: PhotoOpenTransition) => void;
  isFavorite: boolean;
  onToggleFavorite: (photoId: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (photoId: string) => void;
  interactionMode?: 'detail' | 'selectionOnly' | 'none';
  compact?: boolean;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  index,
  onClick,
  isFavorite,
  onToggleFavorite,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  interactionMode = 'detail',
  compact = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isConvertingVideo, setIsConvertingVideo] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const hasVideo = photo.videoSource?.type === 'live-photo';

  const enterSpring = useSpring({
    from: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 24,
      scale: prefersReducedMotion ? 1 : 0.97,
    },
    to: {
      opacity: isVisible ? 1 : 0,
      y: isVisible ? 0 : prefersReducedMotion ? 0 : 12,
      scale: isVisible ? 1 : prefersReducedMotion ? 1 : 0.97,
    },
    delay: prefersReducedMotion ? 0 : Math.min(index, 20) * 50,
    config: { tension: 200, friction: 28 },
  });

  const hoverSpring = useSpring({
    to: {
      scale: isHovered && !prefersReducedMotion ? 1.008 : 1,
      overlayOpacity: isHovered ? 1 : 0,
      overlayY: isHovered && !prefersReducedMotion ? 0 : 16,
    },
    config: { tension: 280, friction: 32 },
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
    setIsVideoPlaying(true);
    video.currentTime = 0;
    video.play().catch(() => {
      setIsVideoPlaying(false);
    });
  }, [isConvertingVideo, isVideoPlaying, isVideoReady]);

  const { handleStart: handleHoverStart, handleEnd: handleHoverEnd } =
    useLivePhotoControls({
      mode: 'hover',
      enabled: hasVideo,
      isPlaying: isVideoPlaying,
      isVideoReady,
      onPlay: playVideo,
      onStop: stopVideo,
      delayMs: 200,
      disableHover: prefersReducedMotion,
    });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };
    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleMotionChange);
    return () => mediaQuery.removeEventListener('change', handleMotionChange);
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
        rootMargin: '200px',
      },
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      !hasVideo ||
      !isLoaded ||
      !isVisible ||
      isVideoReady ||
      !videoRef.current ||
      !photo.videoSource
    ) {
      return;
    }
    let cancelled = false;
    setIsConvertingVideo(false);
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
        }
      })
      .catch(() => {
        // Video loading failed silently
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

  const getTransitionSource = useCallback((): PhotoOpenTransition => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) {
      return {
        photoId: photo.id,
        left: window.innerWidth / 2,
        top: window.innerHeight / 2,
        width: 1,
        height: 1,
        borderRadius: 16,
        sourceScale: window.visualViewport?.scale ?? 1,
        capturedAt: Date.now(),
      };
    }

    const computed = cardRef.current ? window.getComputedStyle(cardRef.current) : null;
    const parsedRadius = computed ? Number.parseFloat(computed.borderTopLeftRadius || "16") : 16;
    const borderRadius = Number.isFinite(parsedRadius) ? parsedRadius : 16;

    return {
      photoId: photo.id,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      borderRadius,
      sourceScale: window.visualViewport?.scale ?? 1,
      capturedAt: Date.now(),
    };
  }, [photo.id]);

  const canSelect = selectionMode && interactionMode !== 'none' && Boolean(onToggleSelect);
  const canOpenDetail = interactionMode === 'detail' && Boolean(onClick);
  const canActivate = canSelect || canOpenDetail;
  const cardAspectRatio = compact ? '4 / 3' : `${photo.width} / ${photo.height}`;

  const handleActivate = useCallback(() => {
    if (canSelect) {
      onToggleSelect?.(photo.id);
      return;
    }
    if (canOpenDetail && onClick) {
      onClick(photo, getTransitionSource());
    }
  }, [canOpenDetail, canSelect, getTransitionSource, onClick, onToggleSelect, photo]);

  return (
    <animated.div
      ref={cardRef}
      className={`group relative mb-0 break-inside-avoid overflow-hidden bg-[#060606] transition-colors duration-200 ${canActivate ? 'cursor-pointer' : 'cursor-default'}`}
      role={canActivate ? 'button' : undefined}
      tabIndex={canActivate ? 0 : -1}
      aria-label={canOpenDetail ? `View photo ${photo.title}` : canSelect ? `Select photo ${photo.title}` : undefined}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (!canActivate) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
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
      style={{ 
        aspectRatio: cardAspectRatio,
      }}
    >
      {!compact && (
        <div className='absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-black/70 opacity-80 transition-opacity duration-300 group-hover:opacity-100' />
      )}

      {!compact && (
        <Button
          type='button'
          size='icon'
          variant='ghost'
          aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
          className={`absolute right-3 top-3 z-20 h-8 w-8 rounded-full border border-white/20 bg-black/35 p-1.5 transition-all duration-200 ${
            isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavorite(photo.id);
          }}
        >
          <Star
            size={16}
            className={isFavorite ? 'fill-white text-white' : 'text-white/75 hover:text-white'}
            strokeWidth={1.5}
          />
        </Button>
      )}

      {selectionMode && (
        <span
          className={`absolute left-3 top-3 z-20 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
            isSelected
              ? "border-white bg-white text-black"
              : "border-white/50 bg-black/45"
          }`}
        >
          {isSelected && <span className="block h-2 w-2 bg-black rounded-full" />}
        </span>
      )}

      <animated.div
        className='h-full w-full will-change-transform'
        style={{
          opacity: enterSpring.opacity,
          transform: to(
            [enterSpring.y, hoverSpring.scale],
            (y, scale) => `translate3d(0, ${y}px, 0) scale(${scale})`,
          ),
        }}
      >
        {isVisible && (
          <img
            src={photo.thumbnail}
            alt={photo.title}
            className={`h-full w-full object-cover transition-transform duration-500 ease-out ${compact ? '' : 'group-hover:scale-[1.03]'}`}
            onLoad={() => setIsLoaded(true)}
          />
        )}
      </animated.div>

      {hasVideo && (
        <video
          ref={videoRef}
          className={`pointer-events-none absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-500 ${
            isVideoPlaying ? 'opacity-100' : 'opacity-0'
          }`}
          muted
          playsInline
          preload='metadata'
          onEnded={stopVideo}
        />
      )}

      {!compact && (
        <div
          className='absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end p-4 sm:p-5'
        >
          <h3 className='font-serif text-lg text-white tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]'>
            {photo.filename}
          </h3>

          <div className='mt-1.5 flex items-center gap-3 text-[10px] font-medium tracking-[0.22em] text-white/65 uppercase'>
            <span>{photo.width} × {photo.height}</span>
            {photo.format && (
              <>
                <span className='h-0.5 w-0.5 rounded-full bg-white/40' />
                <span>{photo.format}</span>
              </>
            )}
          </div>
        </div>
      )}

      {!compact && (photo.category || photo.isLive) && (
        <div className='absolute left-3 top-3 z-20 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
          {photo.category && (
            <div className='flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1 backdrop-blur-sm'>
              <span className="text-xs font-medium text-white">{photo.category}</span>
            </div>
          )}
          {photo.isLive && (
            <div className='flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2 py-1 backdrop-blur-sm'>
              <div className={`h-1.5 w-1.5 rounded-full ${isConvertingVideo ? 'bg-white/60 animate-pulse motion-reduce:animate-none' : 'bg-white'}`} />
              <span className="text-[10px] font-medium tracking-widest text-white uppercase">Live</span>
            </div>
          )}
        </div>
      )}
    </animated.div>
  );
};

export default PhotoCard;
