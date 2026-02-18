import React from "react";
import {
  Calendar,
  Camera,
  Aperture,
  Maximize2,
  FileText,
  Loader2,
  Star,
  Trash2,
  Scan,
  Zap,
  Share2,
  Eye,
  Lock,
  Globe,
  Image as ImageIcon,
} from "lucide-react";
import { Photo } from "@/features/photos/types";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
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
    <ScrollArea className='h-full w-full border-l border-white/5 bg-[#050505] shadow-[-24px_0_64px_rgba(0,0,0,0.6)] backdrop-blur-xl'>
      <div className='flex flex-col gap-8 p-8'>
        
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h2 className='font-serif text-3xl font-medium tracking-tight text-white leading-tight'>
              {photo.title}
            </h2>
            <button
              onClick={() => onToggleFavorite?.(photo.id)}
              className={cn(
                "group relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300",
                isFavorite ? "bg-[#D4AF37]/10 text-[#D4AF37]" : "bg-white/5 text-neutral-500 hover:bg-white/10 hover:text-white"
              )}
            >
              <Star size={14} className={cn("transition-transform", isFavorite && "fill-current")} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-widest text-neutral-500 font-medium">
            <span>{photo.exif.date}</span>
            {photo.isLive && (
              <>
                <span className="h-0.5 w-0.5 rounded-full bg-neutral-700" />
                <span className="flex items-center gap-1.5 text-[#D4AF37]">
                  <div className="h-1 w-1 rounded-full bg-current animate-pulse" />
                  Live Photo
                </span>
              </>
            )}
          </div>

          {photo.visualDescription && (
            <p className='text-sm leading-7 text-neutral-400 font-light'>
              {photo.visualDescription}
            </p>
          )}

          {tags.length > 0 && (
            <div className='flex flex-wrap gap-2 pt-2'>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className='rounded-md bg-white/[0.03] px-2 py-1 text-[10px] text-neutral-400 tracking-wide uppercase transition-colors hover:bg-white/[0.06] hover:text-neutral-300'
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Video Status */}
        {(hasVideo || isConvertingVideo || livePlaybackError) && (
          <div className="rounded-lg bg-white/[0.02] p-3 text-xs border border-white/5 space-y-1">
             {hasVideo && <p className='text-neutral-500'>Press and hold to play</p>}
             {isConvertingVideo && <p className='text-[#c9a962] flex items-center gap-2'><Loader2 size={10} className="animate-spin"/> Processing video...</p>}
             {livePlaybackError && <p className='text-rose-400'>{livePlaybackError}</p>}
          </div>
        )}

        {/* Technical Grid - Camera */}
        <div className="space-y-4">
          <SectionLabel icon={<Camera size={12} />} label="Equipment" />
          <div className="grid grid-cols-1 gap-4">
            <div className="group">
              <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1">Camera</p>
              <p className="text-sm text-neutral-200 font-medium">{photo.exif.camera}</p>
            </div>
            <div className="group">
              <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1">Lens</p>
              <p className="text-sm text-neutral-200 font-medium">{photo.exif.lens}</p>
            </div>
          </div>
        </div>

        {/* Technical Grid - Settings */}
        <div className="space-y-4">
          <SectionLabel icon={<Aperture size={12} />} label="Settings" />
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            <StatItem label="Aperture" value={formatExifText(photo.exif.aperture)} />
            <StatItem label="Shutter" value={formatExifText(photo.exif.shutter)} />
            <StatItem label="ISO" value={formatExifText(photo.exif.iso)} />
            <StatItem label="Focal Length" value={formatNumericWithUnit(photo.exif.focalLength, "mm")} />
          </div>
        </div>

        {/* File Info */}
        <div className="space-y-4">
           <SectionLabel icon={<FileText size={12} />} label="File Details" />
           <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <StatItem label="Resolution" value={`${photo.width} × ${photo.height}`} />
              <StatItem label="Size" value={metadata ? formatBytes(metadata.files.original.bytes) : photo.size} />
              <StatItem label="Format" value={metadata?.files.original.mime || photo.format} />
              {metadata?.files.live_video && (
                 <StatItem label="Live Video" value={formatBytes(metadata.files.live_video.bytes)} />
              )}
           </div>
        </div>
        
        {/* Analysis */}
        {metadata && (
          <div className="space-y-4">
            <SectionLabel icon={<Scan size={12} />} label="Analysis" />
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
               <div className="group">
                  <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1">Dominant Color</p>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: metadata.derived.dominant_color.hex }} />
                    <span className="text-sm font-mono text-neutral-400 uppercase">{metadata.derived.dominant_color.hex}</span>
                  </div>
               </div>
               <StatItem 
                  label="Focus Score" 
                  value={
                    <span className={cn(metadata.derived.blur.is_blurry ? "text-rose-400" : "text-emerald-400")}>
                      {metadata.derived.blur.score.toFixed(1)}
                    </span>
                  } 
               />
               <StatItem label="Captured" value={formatTime(metadata.timestamps.created_at)} />
               <StatItem label="Processed" value={formatTime(metadata.timestamps.client_processed_at)} />
            </div>
            
            <div className="pt-2">
               <p className="text-[10px] uppercase tracking-widest text-neutral-700 mb-1">Asset ID</p>
               <p className="text-[10px] font-mono text-neutral-600 break-all select-all">{metadata.image_id}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-4 pt-4 mt-4 border-t border-white/5">
          <SectionLabel icon={<Share2 size={12} />} label="Actions" />
          
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2 rounded-lg bg-white/[0.02] p-1 border border-white/5">
                <button
                  type='button'
                  onClick={() => onChangeShareMode("private")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-wider transition-all",
                    shareMode === "private" ? "bg-white/[0.08] text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"
                  )}
                >
                  <Lock size={10} /> Private
                </button>
                <button
                  type='button'
                  onClick={() => onChangeShareMode("public")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-wider transition-all",
                    shareMode === "public" ? "bg-[#D4AF37]/20 text-[#D4AF37] shadow-sm" : "text-neutral-500 hover:text-neutral-300"
                  )}
                >
                   <Globe size={10} /> Public
                </button>
             </div>

             <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "flex-1 h-9 bg-transparent border-white/10 text-xs text-neutral-400 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all uppercase tracking-wider",
                    watermarkPreviewEnabled && "border-[#D4AF37]/40 text-[#D4AF37] bg-[#D4AF37]/5"
                  )}
                  onClick={() => onToggleWatermarkPreview(!watermarkPreviewEnabled)}
                >
                   <ImageIcon size={12} className="mr-2" /> Watermark
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  className='flex-1 h-9 bg-transparent border-white/10 text-xs text-neutral-400 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all uppercase tracking-wider'
                  onClick={onGenerateShareLink}
                >
                   <Share2 size={12} className="mr-2" /> Share Link
                </Button>
             </div>

             {shareLink && (
               <div className='mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/5'>
                 <p className='break-all font-mono text-[10px] text-neutral-400 select-all'>
                   {shareLink}
                 </p>
               </div>
             )}
          </div>

          {canDelete && metadata && (
            <div className='pt-6'>
              <Button
                size='sm'
                variant='ghost'
                disabled={isDeleting}
                className='w-full h-10 text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 text-xs uppercase tracking-widest transition-all'
                onClick={onDeleteClick}
              >
                {isDeleting ? <Loader2 size={14} className='animate-spin' /> : <Trash2 size={14} className="mr-2" />}
                Delete Asset
              </Button>
            </div>
          )}
        </div>

      </div>
    </ScrollArea>
  );
};

const SectionLabel = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
    <span className="text-neutral-600">{icon}</span>
    <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">{label}</span>
  </div>
);

const StatItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="group">
    <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1 group-hover:text-neutral-500 transition-colors">{label}</p>
    <div className="text-sm font-mono text-neutral-300">{value}</div>
  </div>
);

export default PhotoDetailInfoPanel;
