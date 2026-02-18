import React from "react";
import {
  Calendar,
  FileText,
  Loader2,
  Star,
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
  isFavorite: boolean;
  tags: string[];
  hasVideo: boolean;
  isConvertingVideo: boolean;
  livePlaybackError: string | null;
  canDelete: boolean;
  isDeleting: boolean;
  onDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onToggleFavorite?: (photoId: string) => void;
  shareMode: "private" | "public";
  onChangeShareMode: (next: "private" | "public") => void;
  watermarkPreviewEnabled: boolean;
  onToggleWatermarkPreview: (next: boolean) => void;
  onGenerateShareLink: () => void;
  shareLink: string;
}

const PhotoDetailInfoPanel: React.FC<PhotoDetailInfoPanelProps> = ({
  photo,
  isFavorite,
  tags,
  hasVideo,
  isConvertingVideo,
  livePlaybackError,
  canDelete,
  isDeleting,
  onDeleteClick,
  onToggleFavorite,
  shareMode,
  onChangeShareMode,
  watermarkPreviewEnabled,
  onToggleWatermarkPreview,
  onGenerateShareLink,
  shareLink,
}) => {
  const metadata = photo.metadata;

  return (
    <ScrollArea className='h-full w-full border-l border-white/[0.05] bg-[linear-gradient(180deg,rgba(14,16,18,0.95)_0%,rgba(10,11,13,0.98)_100%)] shadow-[-24px_0_64px_rgba(0,0,0,0.45)] backdrop-blur-2xl'>
      <div className='space-y-4 p-6 md:p-7'>
        <div>
          <h2 className='font-display text-2xl tracking-wide text-white md:text-3xl'>{photo.title}</h2>
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            <button
              type='button'
              className='inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-white/[0.14] hover:text-white'
              onClick={() => {
                onToggleFavorite?.(photo.id);
              }}
            >
              <Star
                size={12}
                className={isFavorite ? "fill-[#c9a962] text-[#c9a962]" : "text-zinc-400"}
              />
              {isFavorite ? "已收藏" : "收藏"}
            </button>
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
            <div className='mt-3 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-2.5'>
              <FileText size={14} className='mt-0.5 text-zinc-400' />
              <p className='text-sm leading-relaxed text-zinc-300'>
                {photo.visualDescription}
              </p>
            </div>
          )}
          {tags.length > 0 && (
            <div className='mt-3 flex flex-wrap gap-2'>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className='rounded-full border border-white/[0.1] bg-black/25 px-2.5 py-1 text-[11px] text-zinc-300'
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {hasVideo && <p className='text-xs font-light tracking-wide text-zinc-400'>长按图片播放实况</p>}
        {isConvertingVideo && <p className='text-xs text-[#c9a962]/80'>正在转换实况视频...</p>}
        {livePlaybackError && <p className='text-xs text-rose-400/80'>{livePlaybackError}</p>}

        <div className='space-y-1.5 border-t border-white/[0.06] pt-3'>
          <div className='flex items-start justify-between gap-4 py-1.5'>
            <span className='text-xs text-zinc-400'>光圈</span>
            <span className='font-mono text-sm text-white'>{formatExifText(photo.exif.aperture)}</span>
          </div>
          <div className='flex items-start justify-between gap-4 py-1.5'>
            <span className='text-xs text-zinc-400'>快门</span>
            <span className='font-mono text-sm text-white'>{formatExifText(photo.exif.shutter)}</span>
          </div>
          <div className='flex items-start justify-between gap-4 py-1.5'>
            <span className='text-xs text-zinc-400'>感光度</span>
            <span className='font-mono text-sm text-white'>{formatExifText(photo.exif.iso)}</span>
          </div>
          <div className='flex items-start justify-between gap-4 py-1.5'>
            <span className='text-xs text-zinc-400'>焦距</span>
            <span className='font-mono text-sm text-white'>{formatNumericWithUnit(photo.exif.focalLength, "mm")}</span>
          </div>
          <div className='flex items-start justify-between gap-4 py-1.5'>
            <span className='text-xs text-zinc-400'>设备</span>
            <span className='text-right text-sm text-white'>{photo.exif.camera}</span>
          </div>
          <div className='flex items-start justify-between gap-4 py-1.5'>
            <span className='text-xs text-zinc-400'>镜头</span>
            <span className='text-right text-sm text-white'>{photo.exif.lens}</span>
          </div>
          <div className='flex items-start justify-between gap-4 py-1.5'>
            <span className='text-xs text-zinc-400'>分辨率</span>
            <span className='text-sm text-white'>{photo.width} × {photo.height}</span>
          </div>
          <div className='flex items-start justify-between gap-4 py-1.5'>
            <span className='text-xs text-zinc-400'>大小</span>
            <span className='text-sm text-white'>{metadata ? formatBytes(metadata.files.original.bytes) : photo.size}</span>
          </div>
          <div className='flex items-start justify-between gap-4 py-1.5'>
            <span className='text-xs text-zinc-400'>格式</span>
            <span className='text-sm text-white'>{metadata?.files.original.mime || photo.format}</span>
          </div>
          {metadata?.files.live_video && (
            <div className='flex items-start justify-between gap-4 py-1.5'>
              <span className='text-xs text-zinc-400'>实况视频</span>
              <span className='text-right text-sm text-white'>
                {metadata.files.live_video.mime} · {formatBytes(metadata.files.live_video.bytes)}
              </span>
            </div>
          )}
          {metadata && (
            <>
              <div className='my-1 border-t border-white/[0.06]' />
              <div className='flex items-start justify-between gap-4 py-1.5'>
                <span className='text-xs text-zinc-400'>主色调</span>
                <span className='font-mono text-sm text-white'>{metadata.derived.dominant_color.hex}</span>
              </div>
              <div className='flex items-start justify-between gap-4 py-1.5'>
                <span className='text-xs text-zinc-400'>模糊检测</span>
                <span className='text-sm text-white'>
                  {metadata.derived.blur.is_blurry ? "模糊" : "清晰"} ({metadata.derived.blur.score.toFixed(1)})
                </span>
              </div>
              <div className='flex items-start justify-between gap-4 py-1.5'>
                <span className='text-xs text-zinc-400'>创建时间</span>
                <span className='text-right text-sm text-white'>{formatTime(metadata.timestamps.created_at)}</span>
              </div>
              <div className='flex items-start justify-between gap-4 py-1.5'>
                <span className='text-xs text-zinc-400'>处理时间</span>
                <span className='text-right text-sm text-white'>{formatTime(metadata.timestamps.client_processed_at)}</span>
              </div>
              <div className='flex items-start justify-between gap-4 py-1.5'>
                <span className='text-xs text-zinc-400'>图片 ID</span>
                <span className='max-w-[62%] break-all text-right font-mono text-[10px] text-zinc-400'>{metadata.image_id}</span>
              </div>
            </>
          )}
        </div>

        <div className='space-y-2 border-t border-white/[0.06] pt-3'>
          <p className='text-xs text-zinc-400'>分享设置</p>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              className={`rounded-md border px-2 py-1 text-xs ${
                shareMode === "private"
                  ? "border-[#c9a962]/40 bg-[#c9a962]/15 text-[#e8d19a]"
                  : "border-white/[0.1] text-zinc-300"
              }`}
              onClick={() => onChangeShareMode("private")}
            >
              私密
            </button>
            <button
              type='button'
              className={`rounded-md border px-2 py-1 text-xs ${
                shareMode === "public"
                  ? "border-[#c9a962]/40 bg-[#c9a962]/15 text-[#e8d19a]"
                  : "border-white/[0.1] text-zinc-300"
              }`}
              onClick={() => onChangeShareMode("public")}
            >
              公开
            </button>
            <button
              type='button'
              className={`rounded-md border px-2 py-1 text-xs ${
                watermarkPreviewEnabled
                  ? "border-[#c9a962]/40 bg-[#c9a962]/15 text-[#e8d19a]"
                  : "border-white/[0.1] text-zinc-300"
              }`}
              onClick={() => onToggleWatermarkPreview(!watermarkPreviewEnabled)}
            >
              水印预览
            </button>
          </div>
          <Button
            size='sm'
            variant='outline'
            className='h-8 border-white/[0.12] bg-black/30 px-3 text-xs text-zinc-200'
            onClick={onGenerateShareLink}
          >
            生成 24h 分享链接
          </Button>
          {shareLink && (
            <p className='break-all rounded-md border border-white/[0.08] bg-black/25 px-2 py-1 text-[11px] text-zinc-300'>
              {shareLink}
            </p>
          )}
        </div>

        {canDelete && metadata && (
          <div className='pt-1'>
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
      </div>
    </ScrollArea>
  );
};

export default PhotoDetailInfoPanel;
