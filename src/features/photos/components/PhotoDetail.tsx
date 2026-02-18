import React, { useCallback, useEffect, useRef, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { Loader2, X } from "lucide-react";
import { Photo } from "@/features/photos/types";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { videoLoaderManager } from "@/features/photos/services/videoLoaderManager";
import { useLivePhotoControls } from "./hooks/useLivePhotoControls";
import PhotoDetailInfoPanel from "./photo-detail/PhotoDetailInfoPanel";

interface PhotoDetailProps {
  photo: Photo;
  onClose: () => void;
  canDelete?: boolean;
  isDeleting?: boolean;
  onDelete?: (photoId: string) => Promise<void>;
  openingTransition?: {
    photoId: string;
    left: number;
    top: number;
    width: number;
    height: number;
    borderRadius: number;
  } | null;
}

const PhotoDetail: React.FC<PhotoDetailProps> = ({
  photo,
  onClose,
  canDelete = false,
  isDeleting = false,
  onDelete,
  openingTransition = null,
}) => {
  const [isOriginalLoaded, setIsOriginalLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLivePlaying, setIsLivePlaying] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isConvertingVideo, setIsConvertingVideo] = useState(false);
  const [livePlaybackError, setLivePlaybackError] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [liveFrameSize, setLiveFrameSize] = useState<{ width: number; height: number } | null>(null);
  const [launchTargetRect, setLaunchTargetRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [isLaunchAnimating, setIsLaunchAnimating] = useState(false);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const thumbnailImageRef = useRef<HTMLImageElement | null>(null);
  const imagePanelRef = useRef<HTMLDivElement | null>(null);

  const hasVideo = photo.videoSource?.type === "live-photo";

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
    setIsOriginalLoaded(false);
    setLoadProgress(0);
  }, [photo.id]);

  useEffect(() => {
    let cancelled = false;

    const loadImageWithProgress = async (): Promise<void> => {
      if (cancelled) return;
      setLoadProgress(0);

      try {
        const response = await fetch(photo.url, { mode: "cors" });
        if (!response.ok || !response.body) {
          throw new Error("Failed to fetch image");
        }

        const reader = response.body.getReader();
        const contentLength = response.headers.get("content-length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let received = 0;

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          received += value.length;
          if (total > 0) {
            setLoadProgress(Math.round((received / total) * 100));
          }
        }

        if (!cancelled) {
          setLoadProgress(100);
        }
      } catch {
        if (!cancelled) {
          setLoadProgress(100);
        }
      }
    };

    void loadImageWithProgress();

    return () => {
      cancelled = true;
    };
  }, [photo.id, photo.url]);

  const stopVideo = useCallback(() => {
    const video = liveVideoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setIsLivePlaying(false);
  }, []);

  const playVideo = useCallback(() => {
    const video = liveVideoRef.current;
    if (!video || !isVideoReady || isConvertingVideo) return;
    setLivePlaybackError(null);
    setIsLivePlaying(true);
    video.currentTime = 0;
    video.play().catch(() => {
      setIsLivePlaying(false);
      setLivePlaybackError("实况视频播放失败。当前浏览器可能不支持该视频编码，请尝试下载后使用系统播放器打开。");
    });
  }, [isConvertingVideo, isVideoReady]);

  const { handleStart: handleLongPressStart, handleEnd: handleLongPressEnd } = useLivePhotoControls({
    mode: "long-press",
    enabled: hasVideo,
    isPlaying: isLivePlaying,
    isVideoReady,
    onPlay: playVideo,
    onStop: stopVideo,
    delayMs: 200,
  });

  useEffect(() => {
    setIsLivePlaying(false);
    setLivePlaybackError(null);
    setIsVideoReady(false);
    setIsConvertingVideo(false);
    setLiveFrameSize(null);
  }, [photo.id]);

  useEffect(() => {
    const image = thumbnailImageRef.current;
    if (!image) return;

    const updateLiveFrameSize = (): void => {
      const rect = image.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setLiveFrameSize({ width: rect.width, height: rect.height });
    };

    updateLiveFrameSize();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateLiveFrameSize();
          })
        : null;
    observer?.observe(image);
    window.addEventListener("resize", updateLiveFrameSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateLiveFrameSize);
    };
  }, [photo.id, isOriginalLoaded]);

  useEffect(() => {
    if (!hasVideo || !liveVideoRef.current || isVideoReady || !photo.videoSource) {
      return;
    }

    let cancelled = false;
    void videoLoaderManager
      .processVideo(photo.videoSource, liveVideoRef.current, {
        onLoadingStateUpdate: (state) => {
          if (!cancelled) {
            setIsConvertingVideo(Boolean(state.isConverting));
          }
        },
      })
      .then(() => {
        if (!cancelled) {
          setIsVideoReady(true);
          setLivePlaybackError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLivePlaybackError("实况视频加载失败。可能是浏览器不支持 MOV/HEVC，或视频源暂时不可用。");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsConvertingVideo(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasVideo, isVideoReady, photo.videoSource]);

  useEffect(() => {
    return () => {
      stopVideo();
    };
  }, [stopVideo]);

  const handleDelete = useCallback(async () => {
    if (!onDelete || isDeleting) return;
    const confirmed = window.confirm("确认删除？该操作不可恢复");
    if (!confirmed) return;
    await onDelete(photo.id);
  }, [isDeleting, onDelete, photo.id]);

  const handleDeleteClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      void handleDelete();
    },
    [handleDelete]
  );

  const shellSpring = useSpring({
    immediate: prefersReducedMotion,
    from: { opacity: prefersReducedMotion ? 1 : 0 },
    to: { opacity: 1 },
    config: { tension: 180, friction: 28 },
  });

  const imagePanelSpring = useSpring({
    immediate: prefersReducedMotion,
    from: { opacity: prefersReducedMotion ? 1 : 0, scale: prefersReducedMotion ? 1 : 0.98 },
    to: { opacity: 1, scale: 1 },
    config: { tension: 200, friction: 30 },
  });

  const infoPanelSpring = useSpring({
    immediate: prefersReducedMotion,
    from: { opacity: prefersReducedMotion ? 1 : 0, x: prefersReducedMotion ? 0 : 32 },
    to: { opacity: 1, x: 0 },
    config: { tension: 200, friction: 32 },
  });

  const imageSpring = useSpring({
    opacity: isOriginalLoaded ? 1 : 0,
    config: { tension: 180, friction: 28 },
  });

  useEffect(() => {
    if (
      prefersReducedMotion ||
      !openingTransition ||
      openingTransition.photoId !== photo.id
    ) {
      setIsLaunchAnimating(false);
      setLaunchTargetRect(null);
      return;
    }

    setIsLaunchAnimating(true);
    const animationFrame = window.requestAnimationFrame(() => {
      const rect = imagePanelRef.current?.getBoundingClientRect();
      if (!rect) {
        setIsLaunchAnimating(false);
        return;
      }

      setLaunchTargetRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    });

    const timeout = window.setTimeout(() => {
      setIsLaunchAnimating(false);
    }, 480);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [openingTransition, photo.id, prefersReducedMotion]);

  const launchSpring = useSpring({
    immediate:
      prefersReducedMotion ||
      !openingTransition ||
      !launchTargetRect ||
      !isLaunchAnimating ||
      openingTransition.photoId !== photo.id,
    from: {
      left: openingTransition?.left ?? window.innerWidth / 2,
      top: openingTransition?.top ?? window.innerHeight / 2,
      width: openingTransition?.width ?? 1,
      height: openingTransition?.height ?? 1,
      radius: openingTransition?.borderRadius ?? 16,
      opacity: 1,
    },
    to:
      isLaunchAnimating &&
      openingTransition &&
      launchTargetRect &&
      openingTransition.photoId === photo.id
        ? {
            left: launchTargetRect.left,
            top: launchTargetRect.top,
            width: launchTargetRect.width,
            height: launchTargetRect.height,
            radius: 0,
            opacity: 0,
          }
        : {
            left: launchTargetRect?.left ?? openingTransition?.left ?? 0,
            top: launchTargetRect?.top ?? openingTransition?.top ?? 0,
            width: launchTargetRect?.width ?? openingTransition?.width ?? 1,
            height: launchTargetRect?.height ?? openingTransition?.height ?? 1,
            radius: 0,
            opacity: 0,
          },
    config: { tension: 240, friction: 28 },
  });

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          stopVideo();
          onClose();
        }
      }}
    >
      <DialogContent
        overlayClassName='bg-[#08080a]/[0.98] backdrop-blur-xl'
        className='h-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0'
      >
        <animated.div className='relative flex h-full w-full flex-col overflow-hidden md:flex-row' style={{ opacity: shellSpring.opacity }}>
          <DialogClose className='absolute right-6 top-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-black/50 text-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-300 hover:border-white/[0.12] hover:bg-black/70 hover:text-white'>
            <X size={20} strokeWidth={1.5} />
          </DialogClose>

          <animated.div
            ref={imagePanelRef}
            className='relative flex h-[45svh] min-w-0 flex-1 items-center justify-center overflow-hidden bg-black p-4 md:h-full md:p-8'
            style={{
              opacity: imagePanelSpring.opacity,
              transform: imagePanelSpring.scale.to((value) => `scale(${value})`),
            }}
            onMouseDown={handleLongPressStart}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
          >
            <div className='pointer-events-none absolute inset-0 overflow-hidden'>
              <img
                src={photo.thumbnail}
                alt=''
                aria-hidden='true'
                className='absolute inset-0 h-full w-full scale-125 object-cover opacity-65 blur-3xl'
              />
              <div className='absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,20,24,0.05)_0%,rgba(8,8,10,0.75)_78%)]' />
              <div className='absolute inset-y-0 right-0 w-[22%] bg-gradient-to-l from-black/60 to-transparent' />
              <div className='absolute inset-y-0 left-0 w-[18%] bg-gradient-to-r from-black/45 to-transparent' />
            </div>

            <DialogTitle className='sr-only'>{photo.title}</DialogTitle>

            <div className='relative z-10 flex h-full w-full min-w-0 items-center justify-center overflow-hidden'>
              <div className='relative flex h-full w-full items-center justify-center overflow-hidden'>
                <animated.img
                  ref={thumbnailImageRef}
                  src={photo.thumbnail}
                  alt={photo.title}
                  className='absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full object-contain shadow-2xl'
                  style={{ opacity: imageSpring.opacity.to((value) => 1 - value) }}
                />

                <animated.img
                  src={photo.url}
                  alt={photo.title}
                  className='absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full object-contain shadow-2xl'
                  style={{ opacity: imageSpring.opacity }}
                  onLoad={() => setIsOriginalLoaded(true)}
                />

                {!isOriginalLoaded && (
                  <div className='absolute bottom-3 right-3 z-30 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/70 px-2.5 py-1.5 backdrop-blur-md'>
                    <Loader2 className='h-3 w-3 animate-spin text-white/60' />
                    <span className='text-[10px] text-white/50'>原图 {loadProgress}%</span>
                    <div className='h-1 w-10 overflow-hidden rounded-full bg-white/[0.1]'>
                      <div
                        className='h-full rounded-full bg-[#c9a962]/60 transition-all duration-300'
                        style={{ width: `${loadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {hasVideo && (
                <video
                  ref={liveVideoRef}
                  className='pointer-events-none absolute left-1/2 top-1/2 object-cover shadow-2xl transition-opacity duration-200'
                  style={{
                    opacity: isLivePlaying ? 1 : 0,
                    width: liveFrameSize?.width,
                    height: liveFrameSize?.height,
                    transform: "translate(-50%, -50%)",
                  }}
                  muted
                  playsInline
                  preload='metadata'
                  poster={photo.thumbnail}
                  onEnded={stopVideo}
                />
              )}

              {hasVideo && (
                <div className='pointer-events-none absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-[#c9a962]/25 bg-black/50 px-3 py-1.5 backdrop-blur-sm'>
                  <span className='h-1.5 w-1.5 rounded-full bg-[#c9a962]/80' />
                  <span className='text-[10px] font-medium uppercase tracking-[0.15em] text-[#c9a962]'>实况</span>
                </div>
              )}
            </div>
          </animated.div>

          <animated.div
            className='h-[55svh] w-full md:h-full md:w-[420px] lg:w-[460px]'
            style={{
              opacity: infoPanelSpring.opacity,
              transform: infoPanelSpring.x.to((value) => `translate3d(${value}px, 0, 0)`),
            }}
          >
            <PhotoDetailInfoPanel
              photo={photo}
              hasVideo={hasVideo}
              isConvertingVideo={isConvertingVideo}
              livePlaybackError={livePlaybackError}
              canDelete={canDelete}
              isDeleting={isDeleting}
              onDeleteClick={handleDeleteClick}
            />
          </animated.div>
        </animated.div>
        {openingTransition &&
          launchTargetRect &&
          openingTransition.photoId === photo.id &&
          isLaunchAnimating && (
            <animated.div
              className='pointer-events-none fixed z-[80] overflow-hidden bg-black shadow-[0_24px_80px_rgba(0,0,0,0.55)]'
              style={{
                left: launchSpring.left,
                top: launchSpring.top,
                width: launchSpring.width,
                height: launchSpring.height,
                borderRadius: launchSpring.radius,
                opacity: launchSpring.opacity,
              }}
            >
              <img
                src={photo.thumbnail}
                alt=''
                aria-hidden='true'
                className='h-full w-full object-cover'
              />
            </animated.div>
          )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoDetail;
