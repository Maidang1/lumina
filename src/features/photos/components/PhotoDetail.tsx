import React, { useCallback, useEffect, useRef, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { Photo } from "@/features/photos/types";
import { Aperture, Calendar, Camera, Gauge, Loader2, Timer, X, FileText } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Badge } from "@/shared/ui/badge";
import { videoLoaderManager } from "@/features/photos/services/videoLoaderManager";
import { useLivePhotoControls } from "./hooks/useLivePhotoControls";

interface PhotoDetailProps {
  photo: Photo;
  onClose: () => void;
  canDelete?: boolean;
  isDeleting?: boolean;
  onDelete?: (photoId: string) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatExifText(value?: string | number): string {
  if (!value) return "--";
  const normalized = typeof value === "string" ? value.trim() : value.toString();
  if (!normalized || normalized === "?" || normalized.toLowerCase() === "unknown") {
    return "--";
  }
  return normalized;
}

function formatNumericWithUnit(value?: string, unit?: string): string {
  const base = formatExifText(value);
  if (base === "--") return "--";
  return unit ? `${base}${unit}` : base;
}

const PhotoDetail: React.FC<PhotoDetailProps> = ({
  photo,
  onClose,
  canDelete = false,
  isDeleting = false,
  onDelete,
}) => {
  const metadata = photo.metadata;
  const [isOriginalLoaded, setIsOriginalLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLivePlaying, setIsLivePlaying] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isConvertingVideo, setIsConvertingVideo] = useState(false);
  const [livePlaybackError, setLivePlaybackError] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const thumbnailImageRef = useRef<HTMLImageElement | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const [liveFrameSize, setLiveFrameSize] = useState<{ width: number; height: number } | null>(null);

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

  // 重置状态当照片改变时
  useEffect(() => {
    setIsOriginalLoaded(false);
    setLoadProgress(0);
  }, [photo.id]);

  // 使用 fetch 跟踪图片加载进度
  useEffect(() => {
    let cancelled = false;

    const loadImageWithProgress = async () => {
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
        // 如果 fetch 失败，回退到 img onload
        if (!cancelled) {
          setLoadProgress(100);
        }
      }
    };

    loadImageWithProgress();

    return () => {
      cancelled = true;
    };
  }, [photo.url, photo.id]);

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
          if (cancelled) return;
          setIsConvertingVideo(Boolean(state.isConverting));
        },
      })
      .then(() => {
        if (cancelled) return;
        setIsVideoReady(true);
        setLivePlaybackError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setLivePlaybackError("实况视频加载失败。可能是浏览器不支持 MOV/HEVC，或视频源暂时不可用。");
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
            className='relative flex h-[45svh] min-w-0 flex-1 items-center justify-center overflow-hidden bg-black p-4 md:h-full md:p-8'
            style={{
              opacity: imagePanelSpring.opacity,
              transform: imagePanelSpring.scale.to((s) => `scale(${s})`),
            }}
            onMouseDown={handleLongPressStart}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
          >
            <DialogTitle className='sr-only'>{photo.title}</DialogTitle>

            <div className='relative flex h-full w-full min-w-0 items-center justify-center overflow-hidden'>
              {/* 图片容器 - 保持在视口内，防止宽高比极端时溢出 */}
              <div className='relative flex h-full w-full items-center justify-center overflow-hidden'>
                {/* 缩略图 - 始终渲染，通过 opacity 控制显示 */}
                <animated.img
                  ref={thumbnailImageRef}
                  src={photo.thumbnail}
                  alt={photo.title}
                  className='absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full object-contain shadow-2xl'
                  style={{ opacity: imageSpring.opacity.to((v) => 1 - v) }}
                />

                {/* 原始图片 - 始终渲染，加载完成后通过 opacity 显示 */}
                <animated.img
                  ref={originalImageRef}
                  src={photo.url}
                  alt={photo.title}
                  className='absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full object-contain shadow-2xl'
                  style={{ opacity: imageSpring.opacity }}
                  onLoad={() => setIsOriginalLoaded(true)}
                />

                {/* 加载指示器 - 右下角轻提示 */}
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
            className='h-[55svh] w-full md:h-full md:w-[400px] lg:w-[440px]'
            style={{
              opacity: infoPanelSpring.opacity,
              transform: infoPanelSpring.x.to((x) => `translate3d(${x}px, 0, 0)`),
            }}
          >
            <ScrollArea className='h-full w-full border-l border-white/[0.03] bg-[#0a0a0c]/[0.98] backdrop-blur-2xl'>
              <div className='space-y-10 p-7 md:p-9'>
                <div>
                  <h2 className='font-display text-2xl tracking-wide text-white md:text-3xl'>{photo.title}</h2>
                  <div className='mt-4 flex flex-wrap items-center gap-3'>
                    <Badge variant='outline' className='gap-2 border-white/[0.04] bg-white/[0.02] px-3 py-1.5 text-xs font-normal text-zinc-400'>
                      <Calendar size={12} className='text-zinc-400' />
                      <span>{photo.exif.date}</span>
                    </Badge>
                    {photo.isLive && (
                      <Badge variant='outline' className='gap-2 border-[#c9a962]/20 bg-[#c9a962]/5 px-3 py-1.5 text-xs font-normal text-[#c9a962]'>
                        <span className='h-1.5 w-1.5 rounded-full bg-[#c9a962]/70' />
                        实况照片
                      </Badge>
                    )}
                  </div>
                  {photo.visualDescription && (
                    <div className='mt-4 flex items-start gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3'>
                      <FileText size={14} className='mt-0.5 text-zinc-400' />
                      <p className='text-sm leading-relaxed text-zinc-300'>
                        {photo.visualDescription}
                      </p>
                    </div>
                  )}
                </div>

                {hasVideo && <p className='text-xs font-light tracking-wide text-zinc-400'>长按图片播放实况</p>}
                {isConvertingVideo && <p className='text-xs text-[#c9a962]/80'>正在转换实况视频...</p>}
                {livePlaybackError && <p className='text-xs text-rose-400/80'>{livePlaybackError}</p>}

                <div>
                  <h3 className='mb-6 text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-400'>拍摄参数</h3>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='rounded-xl border border-white/[0.03] bg-white/[0.01] p-4'>
                      <div className='flex items-center gap-2 text-zinc-400'>
                        <Aperture size={12} className='text-[#c9a962]/70' />
                        <span className='text-[9px] uppercase tracking-[0.2em]'>光圈</span>
                      </div>
                      <span className='mt-2 block font-mono text-base text-white'>{formatExifText(photo.exif.aperture)}</span>
                    </div>
                    <div className='rounded-xl border border-white/[0.03] bg-white/[0.01] p-4'>
                      <div className='flex items-center gap-2 text-zinc-400'>
                        <Timer size={12} className='text-[#c9a962]/70' />
                        <span className='text-[9px] uppercase tracking-[0.2em]'>快门</span>
                      </div>
                      <span className='mt-2 block font-mono text-base text-white'>{formatExifText(photo.exif.shutter)}</span>
                    </div>
                    <div className='rounded-xl border border-white/[0.03] bg-white/[0.01] p-4'>
                      <div className='flex items-center gap-2 text-zinc-400'>
                        <Gauge size={12} className='text-[#c9a962]/70' />
                        <span className='text-[9px] uppercase tracking-[0.2em]'>感光度</span>
                      </div>
                      <span className='mt-2 block font-mono text-base text-white'>{formatExifText(photo.exif.iso)}</span>
                    </div>
                    <div className='rounded-xl border border-white/[0.03] bg-white/[0.01] p-4'>
                      <div className='flex items-center gap-2 text-zinc-400'>
                        <Camera size={12} className='text-[#c9a962]/70' />
                        <span className='text-[9px] uppercase tracking-[0.2em]'>焦距</span>
                      </div>
                      <span className='mt-2 block font-mono text-base text-white'>
                        {formatNumericWithUnit(photo.exif.focalLength, "mm")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className='border-t border-white/[0.03]' />
                <div className='space-y-4'>
                  <h3 className='text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-400'>文件信息</h3>
                  <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-zinc-400'>设备</span>
                      <span className='text-xs text-white'>{photo.exif.camera}</span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-zinc-400'>镜头</span>
                      <span className='text-xs text-white'>{photo.exif.lens}</span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-zinc-400'>分辨率</span>
                      <span className='text-xs text-white'>
                        {photo.width} × {photo.height}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-zinc-400'>大小</span>
                      <span className='text-xs text-white'>
                        {metadata ? formatBytes(metadata.files.original.bytes) : photo.size}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-zinc-400'>格式</span>
                      <span className='text-xs text-white'>{metadata?.files.original.mime || photo.format}</span>
                    </div>
                    {metadata?.files.live_video && (
                      <div className='flex items-center justify-between'>
                        <span className='text-xs text-zinc-400'>实况视频</span>
                        <span className='text-xs text-white'>
                          {metadata.files.live_video.mime} · {formatBytes(metadata.files.live_video.bytes)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {metadata && (
                  <>
                    <div className='border-t border-white/[0.03]' />
                    <div className='space-y-4'>
                      <h3 className='text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-400'>智能分析</h3>
                      <div className='space-y-3'>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-zinc-400'>主色调</span>
                          <span className='font-mono text-xs text-white'>{metadata.derived.dominant_color.hex}</span>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-zinc-400'>模糊检测</span>
                          <span className='text-xs text-white'>
                            {metadata.derived.blur.is_blurry ? "模糊" : "清晰"} ({metadata.derived.blur.score.toFixed(1)})
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {metadata && (
                  <>
                    <div className='border-t border-white/[0.03]' />
                    <div className='space-y-4'>
                      <h3 className='text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-400'>元数据</h3>
                      <div className='space-y-3'>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-zinc-400'>创建时间</span>
                          <span className='text-xs text-white'>{formatTime(metadata.timestamps.created_at)}</span>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-zinc-400'>处理时间</span>
                          <span className='text-xs text-white'>
                            {formatTime(metadata.timestamps.client_processed_at)}
                          </span>
                        </div>
                        <div className='flex items-start justify-between gap-4'>
                          <span className='text-xs text-zinc-400'>图片 ID</span>
                          <span className='break-all text-right font-mono text-[10px] text-zinc-400'>{metadata.image_id}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              </div>
            </ScrollArea>
          </animated.div>
        </animated.div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoDetail;
