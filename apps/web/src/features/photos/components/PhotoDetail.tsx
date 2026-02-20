import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animated, useSpring, config } from "@react-spring/web";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { Photo } from "@/features/photos/types";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { videoLoaderManager } from "@/features/photos/services/videoLoaderManager";
import { uploadService } from "@/features/photos/services/uploadService";
import { useLivePhotoControls } from "./hooks/useLivePhotoControls";
import PhotoDetailInfoPanel from "./photo-detail/PhotoDetailInfoPanel";

interface PhotoDetailProps {
  photo: Photo;
  onClose: () => void;
  canDelete?: boolean;
  isDeleting?: boolean;
  onDelete?: (photoId: string) => Promise<void>;
  isFavorite?: boolean;
  onToggleFavorite?: (photoId: string) => void;
  tags?: string[];
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  openingTransition?: {
    photoId: string;
    left: number;
    top: number;
    width: number;
    height: number;
    borderRadius: number;
  } | null;
}

interface ImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// 苹果风格的弹性曲线
const appleSpring = { mass: 0.8, tension: 280, friction: 28 };
const appleSpringGentle = { mass: 1, tension: 200, friction: 26 };

const PhotoDetail: React.FC<PhotoDetailProps> = ({
  photo,
  onClose,
  canDelete = false,
  isDeleting = false,
  onDelete,
  isFavorite = false,
  onToggleFavorite,
  tags = [],
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
  openingTransition = null,
}) => {
  const [isOriginalLoaded, setIsOriginalLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLivePlaying, setIsLivePlaying] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isConvertingVideo, setIsConvertingVideo] = useState(false);
  const [livePlaybackError, setLivePlaybackError] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState<"private" | "public">("private");
  const [watermarkPreviewEnabled, setWatermarkPreviewEnabled] = useState(false);
  const [shareLink, setShareLink] = useState<string>("");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [liveFrameSize, setLiveFrameSize] = useState<{ width: number; height: number } | null>(null);

  // 窗口尺寸状态 - 用于响应窗口 resize 事件
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // 动画状态
  const [transitionState, setTransitionState] = useState<"idle" | "opening" | "closing">("idle");
  const [closingToRect, setClosingToRect] = useState<ImageRect | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const thumbnailImageRef = useRef<HTMLImageElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  const hasVideo = photo.videoSource?.type === "live-photo";

  // 检测用户是否偏好减少动画
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };
    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMotionChange);
    return () => mediaQuery.removeEventListener("change", handleMotionChange);
  }, []);

  // 监听窗口 resize 事件 - 更新 windowSize 以触发 targetRect 重新计算
  useEffect(() => {
    const handleResize = (): void => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // 重置状态
  useEffect(() => {
    setIsOriginalLoaded(false);
    setLoadProgress(0);
  }, [photo.id]);

  // 加载原图进度
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

  // 视频控制
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

  // 键盘导航
  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "ArrowLeft" && canPrev) {
        event.preventDefault();
        onPrev?.();
      }
      if (event.key === "ArrowRight" && canNext) {
        event.preventDefault();
        onNext?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [canNext, canPrev, onNext, onPrev]);

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

  const generateShareLink = useCallback(async () => {
    try {
      const shareType = photo.isLive && shareMode === "public" ? "live" : "original";
      const result = await uploadService.createSignedShareUrl(photo.id, shareType, 24 * 60 * 60);
      const link = result.url;
      setShareLink(link);
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // ignore clipboard failures
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成签名分享链接失败";
      window.alert(message);
    }
  }, [photo.id, photo.isLive, shareMode]);

  // 计算图片在屏幕中央的目标位置和尺寸
  const calculateTargetRect = useCallback((): ImageRect => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 在大屏幕上，图片区域占左边的剩余空间
    // 在小屏幕上，图片区域占上半部分
    const isDesktop = vw >= 768;
    const isLargeDesktop = vw >= 1024;
    const infoPanelWidth = isLargeDesktop ? 360 : 320; 
    const availableWidth = isDesktop ? vw - infoPanelWidth : vw;
    const availableHeight = isDesktop ? vh : vh * 0.45;

    // 计算图片在可用区域内的最佳尺寸（保持宽高比）
    const imageAspect = photo.width / photo.height;
    const containerAspect = availableWidth / availableHeight;

    let targetWidth: number;
    let targetHeight: number;

    if (imageAspect > containerAspect) {
      // 图片更宽，以宽度为准
      targetWidth = availableWidth - 48; // padding (reduced)
      targetHeight = targetWidth / imageAspect;
    } else {
      // 图片更高，以高度为准
      targetHeight = availableHeight - 48;
      targetWidth = targetHeight * imageAspect;
    }

    const left = (availableWidth - targetWidth) / 2 + (isDesktop ? 0 : 0);
    const top = (availableHeight - targetHeight) / 2 + (isDesktop ? 0 : 0);

    return { left, top, width: targetWidth, height: targetHeight };
  }, [photo.width, photo.height]);

  // 使用 useMemo 在 render 时计算 targetRect，避免在 useEffect 中计算导致首帧为 null
  const targetRect = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return calculateTargetRect();
  }, [calculateTargetRect, windowSize]);

  // 初始化动画状态
  useEffect(() => {
    if (prefersReducedMotion || !openingTransition || openingTransition.photoId !== photo.id) {
      setTransitionState("idle");
      return;
    }

    setTransitionState("opening");

    // 动画结束后清除状态
    const timeout = window.setTimeout(() => {
      setTransitionState("idle");
    }, 450); // 稍短于动画时长以匹配弹簧配置

    return () => {
      window.clearTimeout(timeout);
    };
  }, [openingTransition, photo.id, prefersReducedMotion]);

  // 合并的弹簧动画：处理打开和关闭动画
  const spring = useSpring({
    immediate: prefersReducedMotion || !openingTransition || openingTransition.photoId !== photo.id || !targetRect,
    from: openingTransition
      ? {
          x: openingTransition.left,
          y: openingTransition.top,
          width: openingTransition.width,
          height: openingTransition.height,
          borderRadius: openingTransition.borderRadius,
        }
      : { x: 0, y: 0, width: 100, height: 100, borderRadius: 0 },
    to:
      transitionState === "closing" && closingToRect
        ? {
            x: closingToRect.left,
            y: closingToRect.top,
            width: closingToRect.width,
            height: closingToRect.height,
            borderRadius: openingTransition?.borderRadius || 0,
          }
        : targetRect
          ? {
              x: targetRect.left,
              y: targetRect.top,
              width: targetRect.width,
              height: targetRect.height,
              borderRadius: 0,
            }
          : { x: 0, y: 0, width: 100, height: 100, borderRadius: 0 },
    config: transitionState === "closing" ? appleSpringGentle : appleSpring,
    onRest: () => {
      // 动画完全结束时的回调
      if (transitionState === "closing") {
        onClose();
      }
    },
  });

  // 背景遮罩动画 - 独立于主弹簧
  const overlaySpring = useSpring({
    opacity: transitionState === "closing" ? 0 : 1,
    config: { tension: 300, friction: 30 },
  });

  // 图片透明度（用于原图加载淡入）
  const imageSpring = useSpring({
    opacity: isOriginalLoaded ? 1 : 0,
    config: { tension: 180, friction: 28 },
  });

  // 控制按钮动画（关闭按钮和导航按钮）
  const controlsSpring = useSpring({
    opacity: transitionState === "closing" ? 0 : 1,
    transform: transitionState === "closing" 
      ? "translateY(-10px)" 
      : "translateY(0px)",
    delay: prefersReducedMotion ? 0 : (transitionState === "opening" ? 100 : 0),
    config: prefersReducedMotion ? { duration: 0 } : appleSpringGentle,
  });

  // 信息面板动画
  const infoPanelSpring = useSpring({
    opacity: transitionState === "closing" ? 0 : 1,
    transform: transitionState === "closing" 
      ? "translateX(20px)" 
      : "translateX(0px)",
    config: prefersReducedMotion ? { duration: 0 } : appleSpringGentle,
  });

  // 处理关闭
  const handleRequestClose = useCallback(() => {
    if (transitionState === "closing") return;
    stopVideo();

    if (prefersReducedMotion || !openingTransition || openingTransition.photoId !== photo.id) {
      onClose();
      return;
    }

    // 获取当前图片位置
    const container = imageContainerRef.current;
    if (!container) {
      onClose();
      return;
    }

    // 设置关闭目标为原始缩略图位置
    setClosingToRect({
      left: openingTransition.left,
      top: openingTransition.top,
      width: openingTransition.width,
      height: openingTransition.height,
    });
    setTransitionState("closing");
  }, [transitionState, onClose, openingTransition, photo.id, prefersReducedMotion, stopVideo]);

  // 是否使用动画
  const useAnimation = openingTransition && openingTransition.photoId === photo.id && (transitionState !== "idle");
  const isClosing = transitionState === "closing";

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          handleRequestClose();
        }
      }}
    >
      <DialogContent
        overlayClassName="bg-transparent"
        className="h-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0"
      >
        {/* 背景遮罩 - 使用模糊的缩略图作为背景 */}
        <animated.div
          className="fixed inset-0 z-0 bg-black/95"
          style={{
            opacity: overlaySpring.opacity,
          }}
        >
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 blur-3xl saturate-150"
            style={{ 
              backgroundImage: `url(${photo.thumbnail})`,
              transform: 'scale(1.2)',
            }} 
          />
          <div className="absolute inset-0 bg-black/20" />
        </animated.div>

        {/* 关闭按钮 */}
        <animated.div style={{ 
          opacity: overlaySpring.opacity,
          transform: controlsSpring.transform,
        }}>
          <DialogClose className="fixed right-6 top-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-black/20 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-black/40 hover:text-white">
            <X size={18} strokeWidth={1.5} />
          </DialogClose>
        </animated.div>

        {/* 导航按钮 */}
        {canPrev && (
          <animated.button
            type="button"
            className="fixed left-6 top-1/2 z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-black/40 text-white/70 backdrop-blur-xl transition hover:border-white/[0.15] hover:text-white"
            style={{ 
              opacity: overlaySpring.opacity,
              transform: controlsSpring.transform,
            }}
            onClick={onPrev}
            aria-label="上一张"
          >
            <ChevronLeft size={22} />
          </animated.button>
        )}
        {canNext && (
          <animated.button
            type="button"
            className="fixed right-[calc(460px+24px)] top-1/2 z-40 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-black/40 text-white/70 backdrop-blur-xl transition hover:border-white/[0.15] hover:text-white lg:flex"
            style={{ 
              opacity: overlaySpring.opacity,
              transform: controlsSpring.transform,
            }}
            onClick={onNext}
            aria-label="下一张"
          >
            <ChevronRight size={22} />
          </animated.button>
        )}

        {/* 主内容区域 */}
        <animated.div
          className="relative flex h-full w-full flex-col overflow-hidden md:flex-row"
          style={{ opacity: overlaySpring.opacity }}
        >
          {/* 图片区域 */}
          <div
            ref={imageContainerRef}
            className="relative flex h-[45svh] min-w-0 flex-1 items-center justify-center overflow-hidden bg-transparent p-4 md:h-full md:p-6"
            onMouseDown={handleLongPressStart}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
          >
            <DialogTitle className="sr-only">{photo.title}</DialogTitle>

            {/* 动画图片层 - 打开和关闭都使用同一个弹簧 */}
            {useAnimation && (
              <animated.div
                className="pointer-events-none fixed z-[60] overflow-hidden shadow-2xl"
                style={{
                  left: spring.x,
                  top: spring.y,
                  width: spring.width,
                  height: spring.height,
                  borderRadius: spring.borderRadius,
                }}
              >
                <img
                  src={photo.thumbnail}
                  alt={photo.title}
                  className="h-full w-full object-contain"
                />
              </animated.div>
            )}

            {/* 静态图片（动画结束后显示） */}
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
                  style={{ opacity: imageSpring.opacity.to((value) => 1 - value) }}
                />

                <animated.img
                  src={photo.url}
                  alt={photo.title}
                  className="absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full object-contain"
                  style={{ opacity: imageSpring.opacity }}
                  onLoad={() => setIsOriginalLoaded(true)}
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
                  onEnded={stopVideo}
                />
              )}

              {hasVideo && (
                <div className="pointer-events-none absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-[#c9a962]/25 bg-black/50 px-3 py-1.5 backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#c9a962]/80" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#c9a962]">实况</span>
                </div>
              )}

              {!isOriginalLoaded && (
                <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/70 px-2.5 py-1.5 backdrop-blur-md">
                  <Loader2 className="h-3 w-3 animate-spin text-white/60" />
                  <span className="text-[10px] text-white/50">原图 {loadProgress}%</span>
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

          {/* 信息面板 */}
          <animated.div
            className="h-[55svh] w-full border-l border-white/10 bg-black/40 backdrop-blur-xl md:h-full md:w-[320px] lg:w-[360px]"
            style={{
              opacity: overlaySpring.opacity,
              transform: infoPanelSpring.transform,
            }}
          >
            <PhotoDetailInfoPanel
              photo={photo}
              isFavorite={isFavorite}
              tags={tags}
              hasVideo={hasVideo}
              isConvertingVideo={isConvertingVideo}
              livePlaybackError={livePlaybackError}
              canDelete={canDelete}
              isDeleting={isDeleting}
              onDeleteClick={handleDeleteClick}
              onToggleFavorite={onToggleFavorite}
              shareMode={shareMode}
              onChangeShareMode={setShareMode}
              watermarkPreviewEnabled={watermarkPreviewEnabled}
              onToggleWatermarkPreview={setWatermarkPreviewEnabled}
              onGenerateShareLink={() => {
                void generateShareLink();
              }}
              shareLink={shareLink}
            />
          </animated.div>
        </animated.div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoDetail;
