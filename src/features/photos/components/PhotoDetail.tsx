import React, { useCallback, useEffect, useRef, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { Photo } from "@/features/photos/types";
import { Aperture, Calendar, Camera, Gauge, Loader2, Timer, Trash2, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { Button } from "@/shared/ui/button";
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
    config: { tension: 220, friction: 24 },
  });

  const imagePanelSpring = useSpring({
    from: { opacity: 0, x: -24 },
    to: { opacity: 1, x: 0 },
    config: { tension: 230, friction: 26 },
  });

  const infoPanelSpring = useSpring({
    from: { opacity: 0, x: 24 },
    to: { opacity: 1, x: 0 },
    config: { tension: 230, friction: 28 },
  });

  const imageSpring = useSpring({
    opacity: isImageLoaded ? 1 : 0,
    config: { tension: 210, friction: 26 },
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
      <DialogContent overlayClassName='bg-black/95' className='h-screen max-w-none rounded-none border-0 bg-transparent p-0'>
        <animated.div className='relative flex h-full w-full flex-col md:flex-row' style={{ opacity: shellSpring.opacity }}>
          {/* {canDelete && (
            <Button
              variant='outline'
              size='sm'
              disabled={isDeleting}
              className='absolute right-16 top-4 z-50 min-h-[44px] border-rose-300/60 bg-black/70 text-rose-100 hover:bg-rose-500/20'
              onClick={() => {
                void handleDelete();
              }}
            >
              {isDeleting ? <Loader2 size={14} className='animate-spin' /> : <Trash2 size={14} />}
              {isDeleting ? "删除中..." : "删除"}
            </Button>
          )} */}
          <DialogClose className='absolute right-4 top-4 z-50 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/25 bg-black/70 p-2 text-white shadow-lg transition hover:bg-black/85'>
            <X size={22} />
          </DialogClose>

          <animated.div
            className='relative flex h-[45svh] flex-1 items-center justify-center bg-black p-4 md:h-full md:p-8'
            style={{
              opacity: imagePanelSpring.opacity,
              transform: imagePanelSpring.x.to((x) => `translate3d(${x}px, 0, 0)`),
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
                <div className='pointer-events-none absolute left-3 top-3 z-20 rounded-md border border-amber-300/60 bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100 backdrop-blur'>
                  LIVE
                </div>
              )}
            </div>
          </animated.div>

          <animated.div
            className='h-[55svh] w-full md:h-full md:w-[420px] lg:w-[480px]'
            style={{
              opacity: infoPanelSpring.opacity,
              transform: infoPanelSpring.x.to((x) => `translate3d(${x}px, 0, 0)`),
            }}
          >
            <ScrollArea className='h-full w-full border-l border-white/5 bg-pro-gray/90 backdrop-blur-md'>
              <div className='space-y-6 p-5 md:p-8'>
                <div>
                  <h2 className='mb-2 font-serif text-2xl text-white md:text-3xl'>{photo.title}</h2>
                  <div className='flex flex-wrap items-center gap-2 text-sm text-gray-400'>
                    <Badge variant='outline' className='gap-1.5 border-white/10 text-gray-300'>
                      <Calendar size={14} /> {photo.exif.date}
                    </Badge>
                    {photo.isLive && (
                      <Badge variant='outline' className='gap-1.5 border-amber-300/50 bg-amber-500/10 text-amber-200'>
                        LIVE PHOTO
                      </Badge>
                    )}
                  </div>
                </div>

                {hasVideo && <p className='text-sm text-amber-100/90'>长按图片可播放实况，松开后返回静态图。</p>}
                {isConvertingVideo && <p className='text-sm text-amber-200/90'>正在转换实况视频，请稍候...</p>}
                {livePlaybackError && <p className='text-sm text-rose-300/90'>{livePlaybackError}</p>}

                <div>
                  <h3 className='mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500'>拍摄参数</h3>
                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                    <Card className='border-white/5 bg-black/40'>
                      <CardContent className='flex min-h-[50px] flex-col justify-center gap-1 p-2.5'>
                        <div className='flex items-center gap-2 text-gray-400'>
                          <Aperture size={14} />
                          <span className='text-xs uppercase tracking-wider'>Aperture</span>
                        </div>
                        <span className='block font-mono text-lg text-white'>{formatExifText(photo.exif.aperture)}</span>
                      </CardContent>
                    </Card>
                    <Card className='border-white/5 bg-black/40'>
                      <CardContent className='flex min-h-[50px] flex-col justify-center gap-1 p-2.5'>
                        <div className='flex items-center gap-2 text-gray-400'>
                          <Timer size={14} />
                          <span className='text-xs uppercase tracking-wider'>Shutter</span>
                        </div>
                        <span className='block font-mono text-lg text-white'>{formatExifText(photo.exif.shutter)}</span>
                      </CardContent>
                    </Card>
                    <Card className='border-white/5 bg-black/40'>
                      <CardContent className='flex min-h-[50px] flex-col justify-center gap-1 p-2.5'>
                        <div className='flex items-center gap-2 text-gray-400'>
                          <Gauge size={14} />
                          <span className='text-xs uppercase tracking-wider'>ISO</span>
                        </div>
                        <span className='block font-mono text-lg text-white'>{formatExifText(photo.exif.iso)}</span>
                      </CardContent>
                    </Card>
                    <Card className='border-white/5 bg-black/40'>
                      <CardContent className='flex min-h-[50px] flex-col justify-center gap-1 p-2.5'>
                        <div className='flex items-center gap-2 text-gray-400'>
                          <Camera size={14} />
                          <span className='text-xs uppercase tracking-wider'>Focal Len</span>
                        </div>
                        <span className='block font-mono text-lg text-white'>
                          {formatNumericWithUnit(photo.exif.focalLength, "mm")}
                        </span>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />
                <div className='space-y-2'>
                  <h3 className='mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500'>文件信息</h3>
                  <div className='flex items-center justify-between py-1'>
                    <span className='text-sm text-gray-400'>设备</span>
                    <span className='text-sm font-medium text-white'>{photo.exif.camera}</span>
                  </div>
                  <div className='flex items-center justify-between py-1'>
                    <span className='text-sm text-gray-400'>镜头</span>
                    <span className='text-sm font-medium text-white'>{photo.exif.lens}</span>
                  </div>
                  <div className='flex items-center justify-between py-1'>
                    <span className='text-sm text-gray-400'>分辨率</span>
                    <span className='text-sm font-medium text-white'>
                      {photo.width} × {photo.height}
                    </span>
                  </div>
                  <div className='flex items-center justify-between py-1'>
                    <span className='text-sm text-gray-400'>原图大小</span>
                    <span className='text-sm font-medium text-white'>
                      {metadata ? formatBytes(metadata.files.original.bytes) : photo.size}
                    </span>
                  </div>
                  <div className='flex items-center justify-between py-1'>
                    <span className='text-sm text-gray-400'>缩略图</span>
                    <span className='text-sm font-medium text-white'>
                      {metadata ? `${metadata.files.thumb.width} × ${metadata.files.thumb.height} · ${formatBytes(metadata.files.thumb.bytes)}` : "-"}
                    </span>
                  </div>
                  <div className='flex items-center justify-between py-1'>
                    <span className='text-sm text-gray-400'>格式</span>
                    <span className='text-sm font-medium text-white'>{metadata?.files.original.mime || photo.format}</span>
                  </div>
                  {metadata?.files.live_video && (
                    <div className='flex items-center justify-between py-1'>
                      <span className='text-sm text-gray-400'>实况视频</span>
                      <span className='text-sm font-medium text-white'>
                        {metadata.files.live_video.mime} · {formatBytes(metadata.files.live_video.bytes)}
                      </span>
                    </div>
                  )}
                </div>

                {metadata && (
                  <>
                    <Separator />
                    <div className='space-y-2'>
                      <h3 className='mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500'>智能分析</h3>
                      <div className='flex items-center justify-between py-1'>
                        <span className='text-sm text-gray-400'>主色</span>
                        <span className='font-mono text-sm text-white'>{metadata.derived.dominant_color.hex}</span>
                      </div>
                      <div className='flex items-center justify-between py-1'>
                        <span className='text-sm text-gray-400'>模糊检测</span>
                        <span className='text-sm font-medium text-white'>
                          {metadata.derived.blur.is_blurry ? "可能模糊" : "清晰"}（{metadata.derived.blur.score.toFixed(1)}）
                        </span>
                      </div>
                      <div className='flex items-center justify-between py-1'>
                        <span className='text-sm text-gray-400'>OCR</span>
                        <span className='text-sm font-medium text-white'>
                          {metadata.derived.ocr.status === "ok"
                            ? `已识别${metadata.derived.ocr.summary ? `：${metadata.derived.ocr.summary.slice(0, 24)}` : ""}`
                            : metadata.derived.ocr.status === "skipped"
                              ? "已跳过"
                              : "失败"}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {metadata && (
                  <>
                    <Separator />
                    <div className='space-y-2'>
                      <h3 className='mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500'>隐私与处理</h3>
                      <div className='flex items-center justify-between py-1'>
                        <span className='text-sm text-gray-400'>创建时间</span>
                        <span className='text-sm font-medium text-white'>{formatTime(metadata.timestamps.created_at)}</span>
                      </div>
                      <div className='flex items-center justify-between py-1'>
                        <span className='text-sm text-gray-400'>处理时间</span>
                        <span className='text-sm font-medium text-white'>
                          {formatTime(metadata.timestamps.client_processed_at)}
                        </span>
                      </div>
                      <div className='flex items-start justify-between gap-4 py-1'>
                        <span className='text-sm text-gray-400'>图片 ID</span>
                        <span className='break-all text-right font-mono text-xs text-white/80'>{metadata.image_id}</span>
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
