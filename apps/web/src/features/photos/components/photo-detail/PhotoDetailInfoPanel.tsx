import React from "react";
import {
  Camera,
  Aperture,
  FileText,
  Loader2,
  Star,
  Trash2,
  Scan,
  Zap,
  Share2,
  Tag,
} from "lucide-react";
import { Photo } from "@/features/photos/types";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  formatBytes,
  formatExifText,
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
  const focalLength = formatFocalLength(photo.exif.focalLength);
  const aperture = formatAperture(photo.exif.aperture);
  const shutter = formatExifText(photo.exif.shutter);
  const iso = photo.exif.iso ? `ISO ${photo.exif.iso}` : "--";

  return (
    <ScrollArea className="h-full w-full bg-transparent">
      <div className="flex flex-col gap-6 p-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full bg-white/10 text-xs font-medium text-white hover:bg-white/20"
            >
              <FileText size={14} className="mr-2" /> Info
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onToggleFavorite?.(photo.id)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                isFavorite
                  ? "text-[#D4AF37]"
                  : "text-neutral-400 hover:bg-white/10 hover:text-white",
              )}
            >
              <Star size={16} className={cn(isFavorite && "fill-current")} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onGenerateShareLink}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Share2 size={16} />
            </Button>
          </div>
        </div>

        {/* Basic Information */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Basic Information
          </h3>
          <div className="space-y-2">
            <InfoRow label="Filename" value={photo.filename} />
            <InfoRow
              label="Format"
              value={
                metadata?.files.original.mime.split("/")[1].toUpperCase() ||
                photo.format?.toUpperCase()
              }
            />
            <InfoRow
              label="Dimensions"
              value={`${photo.width} × ${photo.height}`}
            />
            <InfoRow
              label="File Size"
              value={
                metadata
                  ? formatBytes(metadata.files.original.bytes)
                  : photo.size
              }
            />
            <InfoRow label="Category" value={photo.category || "--"} icon={<Tag size={14} />} />
            <InfoRow
              label="Description"
              value={photo.visualDescription || "--"}
              icon={<FileText size={14} />}
            />
            <InfoRow
              label="Capture Time"
              value={
                metadata
                  ? formatTime(metadata.timestamps.created_at)
                  : photo.exif.date
              }
            />
          </div>
        </div>

        {/* Capture Parameters */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Capture Parameters
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <ParameterBadge
              icon={<Camera size={14} />}
              value={focalLength}
            />
            <ParameterBadge icon={<Aperture size={14} />} value={aperture} />
            <ParameterBadge icon={<Zap size={14} />} value={shutter} />
            <ParameterBadge icon={<Scan size={14} />} value={iso} />
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-neutral-300"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tone Analysis (Simulated based on available data) */}
        {metadata && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Tone Analysis
            </h3>
            <div className="space-y-2 text-xs">
              <InfoRow label="Tone Type" value="Normal" />
              <InfoRow
                label="Focus Score"
                value={
                  <span
                    className={cn(
                      metadata.derived.blur.is_blurry
                        ? "text-rose-400"
                        : "text-emerald-400",
                    )}
                  >
                    {metadata.derived.blur.score.toFixed(1)}
                  </span>
                }
              />
              <InfoRow
                label="Dominant Color"
                value={
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-white/10"
                      style={{
                        backgroundColor: metadata.derived.dominant_color.hex,
                      }}
                    />
                    <span className="uppercase">
                      {metadata.derived.dominant_color.hex}
                    </span>
                  </span>
                }
              />
            </div>
          </div>
        )}

        {/* Device Information */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Device Information
          </h3>
          <div className="space-y-2">
            <InfoRow
              label="Camera"
              value={photo.exif.camera || "Unknown Camera"}
            />
            <InfoRow label="Lens" value={photo.exif.lens || "Unknown Lens"} />
          </div>
        </div>

        {/* Video Status */}
        {(hasVideo || isConvertingVideo || livePlaybackError) && (
          <div className="rounded-lg bg-white/[0.03] p-3 text-xs border border-white/10">
            {hasVideo && (
              <p className="text-neutral-300 mb-1">Live Photo Available</p>
            )}
            {isConvertingVideo && (
              <p className="flex items-center gap-2 text-[#c9a962]">
                <Loader2 size={10} className="animate-spin" /> Processing
                video...
              </p>
            )}
            {livePlaybackError && (
              <p className="text-rose-400">{livePlaybackError}</p>
            )}
          </div>
        )}

        {/* Delete Action */}
        {canDelete && (
          <div className="pt-4 mt-auto">
            <Button
              size="sm"
              variant="ghost"
              disabled={isDeleting}
              className="w-full justify-start text-xs text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10"
              onClick={onDeleteClick}
            >
              <Trash2 size={14} className="mr-2" />
              Delete Asset
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

function InfoRow({ label, value, icon }: InfoRowProps): React.ReactElement {
  return (
    <div className="grid grid-cols-[minmax(96px,120px)_minmax(0,1fr)] items-start gap-3 text-xs">
      <span className="flex min-w-0 items-center gap-2 text-neutral-500">
        {icon}
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-neutral-300">{value}</span>
    </div>
  );
}

interface ParameterBadgeProps {
  icon: React.ReactNode;
  value: string;
}

function ParameterBadge({ icon, value }: ParameterBadgeProps): React.ReactElement {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-neutral-400">{icon}</span>
      <span className="min-w-0 truncate text-xs font-medium text-neutral-200">{value}</span>
    </div>
  );
}

function formatFocalLength(value?: string): string {
  const formatted = formatExifText(value);
  if (formatted === "--") return formatted;
  if (/mm$/i.test(formatted)) {
    return formatted;
  }
  const numeric = Number.parseFloat(formatted);
  if (Number.isFinite(numeric)) {
    return `${numeric.toFixed(1)}mm`;
  }
  return `${formatted}mm`;
}

function formatAperture(value?: string): string {
  const formatted = formatExifText(value);
  if (formatted === "--") return formatted;
  return formatted.startsWith("f/") ? formatted : `f/${formatted}`;
}

export default PhotoDetailInfoPanel;
