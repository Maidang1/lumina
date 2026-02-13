import React, { useCallback, useEffect, useRef, useState } from 'react';
import { animated, to, useSpring } from '@react-spring/web';
import { Photo } from '@/features/photos/types';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { videoLoaderManager } from '@/features/photos/services/videoLoaderManager';
import { useLivePhotoControls } from './hooks/useLivePhotoControls';

interface PhotoCardProps {
  photo: Photo;
  index: number;
  onClick: (photo: Photo) => void;
  canDelete?: boolean;
  isDeleting?: boolean;
  onDelete?: (photoId: string) => Promise<void>;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  index,
  onClick,
  canDelete = false,
  isDeleting = false,
  onDelete,
}) => {
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
      borderGlow: isHovered ? 0.15 : 0,
    },
    config: { tension: 280, friction: 32 },
  });

  const imageSpring = useSpring({
    opacity: isLoaded ? 1 : 0,
    config: { tension: 180, friction: 28 },
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
      setVideoError('实况视频播放失败');
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
          setVideoError('实况视频加载失败');
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

  const handleDeleteClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!onDelete || isDeleting) return;
      const confirmed = window.confirm('确认删除？该操作不可恢复');
      if (!confirmed) return;
      await onDelete(photo.id);
    },
    [isDeleting, onDelete, photo.id],
  );

  return (
    <animated.div
      ref={cardRef}
      className='group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-2xl bg-[#0c0c0e] transition-[box-shadow] duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962]/40 md:mb-5'
      role='button'
      tabIndex={0}
      aria-label={`查看图片 ${photo.title}`}
      onClick={() => onClick(photo)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
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
      style={{ 
        aspectRatio: `${photo.width} / ${photo.height}`,
        boxShadow: hoverSpring.borderGlow.to(
          (glow) => `0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,${0.04 + glow}), inset 0 1px 0 rgba(255,255,255,${0.06 + glow * 0.5})`
        ),
      }}
    >
      <div className='pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.04] opacity-0 transition-opacity duration-300 group-hover:opacity-100' 
           style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(255,255,255,0.01) 100%)' }} 
      />
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

      {!isLoaded && (
        <div className='absolute inset-0 skeleton rounded-2xl' />
      )}

      {canDelete && (
        <div className='pointer-events-none absolute right-3 top-3 z-30 hidden transition-opacity md:block md:opacity-0 md:group-hover:opacity-100 !opacity-0'>
          <Button
            size='icon'
            variant='outline'
            disabled={isDeleting}
            aria-label='删除图片'
            className='pointer-events-auto h-8 w-8 rounded-full border-rose-300/60 bg-black/45 text-rose-100 hover:bg-rose-500/20 hover:text-rose-100'
            onClick={(event) => {
              void handleDeleteClick(event);
            }}
          >
            {isDeleting ? (
              <Loader2 size={14} className='animate-spin' />
            ) : (
              <Trash2 size={14} />
            )}
          </Button>
        </div>
      )}

      <animated.div
        className='absolute inset-0 hidden flex-col justify-end bg-gradient-to-t from-black/[0.92] via-black/50 to-transparent p-5 md:flex lg:p-6'
        style={{
          opacity: hoverSpring.overlayOpacity,
          transform: hoverSpring.overlayY.to(
            (y) => `translate3d(0, ${y}px, 0)`,
          ),
        }}
      >
        <h3 className='font-display truncate text-xl text-white lg:text-2xl'>
          {photo.filename}
        </h3>

        <p className='mt-1.5 text-xs font-light tracking-wide text-white/60'>
          {photo.format} <span className='mx-1.5 opacity-30'>·</span>{' '}
          {photo.width} × {photo.height}{' '}
          <span className='mx-1.5 opacity-30'>·</span> {photo.size}
        </p>
      </animated.div>

      <div className='absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/[0.92] via-black/50 to-transparent px-4 pb-4 pt-12 md:hidden'>
        {photo.isLive && (
          <span className='mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#c9a962]/30 bg-[#c9a962]/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-[#c9a962]'>
            <span className='h-1.5 w-1.5 rounded-full bg-[#c9a962]/80' />
            {isConvertingVideo ? '转换中' : '实况'}
          </span>
        )}
        <div className='flex items-center justify-between gap-2'>
          <p className='truncate text-sm font-medium text-white'>
            {photo.filename ?? '--'}
          </p>
        </div>
      </div>

      {photo.isLive && (
        <span className='absolute left-4 top-4 hidden items-center gap-1.5 rounded-full border border-[#c9a962]/30 bg-[#c9a962]/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-[#c9a962] md:inline-flex'>
          <span className='h-1.5 w-1.5 rounded-full bg-[#c9a962]/80' />
          {isConvertingVideo ? '转换中' : '实况'}
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
