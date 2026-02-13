import React, { useCallback, useEffect, useRef, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { Photo } from "@/features/photos/types";
import { Aperture, Calendar, Camera, Gauge, Timer, X } from "lucide-react";
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
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isLivePlaying, setIsLivePlaying] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isConvertingVideo, setIsConvertingVideo] = useState(false);
  const [livePlaybackError, setLivePlaybackError] = useState<string | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveImageRef = useRef<HTMLImageElement | null>(null);
  const [liveFrameSize, setLiveFrameSize] = useState<{ width: number; height: number } | null>(null);

  const hasVideo = photo.videoSource?.type === "live-photo";

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
    const image = liveImageRef.current;
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
  }, [photo.id, isImageLoaded]);

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
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: { tension: 180, friction: 28 },
  });

  const imagePanelSpring = useSpring({
    from: { opacity: 0, scale: 0.98 },
    to: { opacity: 1, scale: 1 },
    config: { tension: 200, friction: 30 },
  });

  const infoPanelSpring = useSpring({
    from: { opacity: 0, x: 32 },
    to: { opacity: 1, x: 0 },
    config: { tension: 200, friction: 32 },
  });

  const imageSpring = useSpring({
    opacity: isImageLoaded ? 1 : 0,
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
      <DialogContent overlayClassName='bg-[#08080a]/[0.98] backdrop-blur-xl' className='h-screen max-w-none rounded-none border-0 bg-transparent p-0'>
        <animated.div className='relative flex h-full w-full flex-col md:flex-row' style={{ opacity: shellSpring.opacity }}>
          <DialogClose className='absolute right-6 top-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-black/50 text-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-300 hover:border-white/[0.12] hover:bg-black/70 hover:text-white'>
            <X size={20} strokeWidth={1.5} />
          </DialogClose>

          <animated.div
            className='relative flex h-[45svh] flex-1 items-center justify-center bg-black p-4 md:h-full md:p-8'
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

            <div className='relative flex max-h-full max-w-full items-center justify-center'>
              <animated.img
                ref={liveImageRef}
                src={photo.url}
                alt={photo.title}
                className='max-h-full max-w-full object-contain shadow-2xl'
                style={{ opacity: imageSpring.opacity }}
                onLoad={() => setIsImageLoaded(true)}
              />

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
                  poster={photo.url}
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
                      <Calendar size={12} className='text-zinc-500' /> 
                      <span>{photo.exif.date}</span>
                    </Badge>
                    {photo.isLive && (
                      <Badge variant='outline' className='gap-2 border-[#c9a962]/20 bg-[#c9a962]/5 px-3 py-1.5 text-xs font-normal text-[#c9a962]'>
                        <span className='h-1.5 w-1.5 rounded-full bg-[#c9a962]/70' />
                        实况照片
                      </Badge>
                    )}
                  </div>
                </div>

                {hasVideo && <p className='text-xs font-light tracking-wide text-zinc-600'>长按图片播放实况</p>}
                {isConvertingVideo && <p className='text-xs text-[#c9a962]/80'>正在转换实况视频...</p>}
                {livePlaybackError && <p className='text-xs text-rose-400/80'>{livePlaybackError}</p>}

                <div>
                  <h3 className='mb-6 text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-600'>拍摄参数</h3>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='rounded-xl border border-white/[0.03] bg-white/[0.01] p-4'>
                      <div className='flex items-center gap-2 text-zinc-600'>
                        <Aperture size={12} className='text-[#c9a962]/70' />
                        <span className='text-[9px] uppercase tracking-[0.2em]'>光圈</span>
                      </div>
                      <span className='mt-2 block font-mono text-base text-white'>{formatExifText(photo.exif.aperture)}</span>
                    </div>
                    <div className='rounded-xl border border-white/[0.03] bg-white/[0.01] p-4'>
                      <div className='flex items-center gap-2 text-zinc-600'>
                        <Timer size={12} className='text-[#c9a962]/70' />
                        <span className='text-[9px] uppercase tracking-[0.2em]'>快门</span>
                      </div>
                      <span className='mt-2 block font-mono text-base text-white'>{formatExifText(photo.exif.shutter)}</span>
                    </div>
                    <div className='rounded-xl border border-white/[0.03] bg-white/[0.01] p-4'>
                      <div className='flex items-center gap-2 text-zinc-600'>
                        <Gauge size={12} className='text-[#c9a962]/70' />
                        <span className='text-[9px] uppercase tracking-[0.2em]'>感光度</span>
                      </div>
                      <span className='mt-2 block font-mono text-base text-white'>{formatExifText(photo.exif.iso)}</span>
                    </div>
                    <div className='rounded-xl border border-white/[0.03] bg-white/[0.01] p-4'>
                      <div className='flex items-center gap-2 text-zinc-600'>
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
                  <h3 className='text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-600'>文件信息</h3>
                  <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-zinc-600'>设备</span>
                      <span className='text-xs text-white'>{photo.exif.camera}</span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-zinc-600'>镜头</span>
                      <span className='text-xs text-white'>{photo.exif.lens}</span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-zinc-600'>分辨率</span>
                      <span className='text-xs text-white'>
                        {photo.width} × {photo.height}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-zinc-600'>大小</span>
                      <span className='text-xs text-white'>
                        {metadata ? formatBytes(metadata.files.original.bytes) : photo.size}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-zinc-600'>格式</span>
                      <span className='text-xs text-white'>{metadata?.files.original.mime || photo.format}</span>
                    </div>
                    {metadata?.files.live_video && (
                      <div className='flex items-center justify-between'>
                        <span className='text-xs text-zinc-600'>实况视频</span>
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
                      <h3 className='text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-600'>智能分析</h3>
                      <div className='space-y-3'>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-zinc-600'>主色调</span>
                          <span className='font-mono text-xs text-white'>{metadata.derived.dominant_color.hex}</span>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-zinc-600'>模糊检测</span>
                          <span className='text-xs text-white'>
                            {metadata.derived.blur.is_blurry ? "模糊" : "清晰"} ({metadata.derived.blur.score.toFixed(1)})
                          </span>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-zinc-600'>文字识别</span>
                          <span className='text-xs text-white'>
                            {metadata.derived.ocr.status === "ok"
                              ? `已识别${metadata.derived.ocr.summary ? `: ${metadata.derived.ocr.summary.slice(0, 20)}...` : ""}`
                              : metadata.derived.ocr.status === "skipped"
                                ? "已跳过"
                                : "失败"}
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
                      <h3 className='text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-600'>元数据</h3>
                      <div className='space-y-3'>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-zinc-600'>创建时间</span>
                          <span className='text-xs text-white'>{formatTime(metadata.timestamps.created_at)}</span>
                        </div>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-zinc-600'>处理时间</span>
                          <span className='text-xs text-white'>
                            {formatTime(metadata.timestamps.client_processed_at)}
                          </span>
                        </div>
                        <div className='flex items-start justify-between gap-4'>
                          <span className='text-xs text-zinc-600'>图片 ID</span>
                          <span className='break-all text-right font-mono text-[10px] text-zinc-500'>{metadata.image_id}</span>
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
