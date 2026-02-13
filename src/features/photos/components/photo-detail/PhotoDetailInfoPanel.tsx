import React from "react";
import {
  Aperture,
  Calendar,
  Camera,
  FileText,
  Gauge,
  Loader2,
  Timer,
  Trash2,
} from "lucide-react";
import { Photo } from "@/features/photos/types";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  formatBytes,
  formatExifText,
  formatNumericWithUnit,
  formatTime,
} from "./formatters";

interface PhotoDetailInfoPanelProps {
  photo: Photo;
  hasVideo: boolean;
  isConvertingVideo: boolean;
  livePlaybackError: string | null;
  canDelete: boolean;
  isDeleting: boolean;
  onDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const PhotoDetailInfoPanel: React.FC<PhotoDetailInfoPanelProps> = ({
  photo,
  hasVideo,
  isConvertingVideo,
  livePlaybackError,
  canDelete,
  isDeleting,
  onDeleteClick,
}) => {
  const metadata = photo.metadata;

  return (
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
            {canDelete && (
              <div className='pt-2'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={isDeleting}
                  aria-label='删除图片'
                  className='h-9 border-rose-300/60 bg-black/55 px-3 text-rose-100 hover:bg-rose-500/20 hover:text-rose-100'
                  onClick={onDeleteClick}
                >
                  {isDeleting ? (
                    <Loader2 size={14} className='animate-spin' />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  <span className='ml-2 text-xs'>删除</span>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
};

export default PhotoDetailInfoPanel;
