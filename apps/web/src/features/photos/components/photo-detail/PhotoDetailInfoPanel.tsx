import React from "react";
import {
  Camera,
  Aperture,
  FileText,
  Scan,
  Zap,
} from "lucide-react";
import { Photo } from "@/features/photos/types";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { formatBytes, formatExifText, formatTime } from "./formatters";

interface PhotoDetailInfoPanelProps {
  photo: Photo;
  tags: string[];
}

const PhotoDetailInfoPanel: React.FC<PhotoDetailInfoPanelProps> = ({
  photo,
  tags,
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
            <InfoRow
              label="Category"
              value={photo.category || "--"}
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
            <ParameterBadge icon={<Camera size={14} />} value={focalLength} />
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

        {/* Description */}
        {photo.visualDescription && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Description
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {photo.visualDescription}
            </p>
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
      <span className="min-w-0 break-words text-right text-neutral-300">
        {value}
      </span>
    </div>
  );
}

interface ParameterBadgeProps {
  icon: React.ReactNode;
  value: string;
}

function ParameterBadge({
  icon,
  value,
}: ParameterBadgeProps): React.ReactElement {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-neutral-400">{icon}</span>
      <span className="min-w-0 truncate text-xs font-medium text-neutral-200">
        {value}
      </span>
    </div>
  );
}

function formatFocalLength(value?: string): string {
  const formatted = formatExifText(value);
  if (formatted === "--") return formatted;
  const normalized = formatted.replace(/mm$/i, "").trim();
  const numeric = Number.parseFloat(normalized);
  if (Number.isFinite(numeric)) {
    const rounded = Math.round(numeric * 100) / 100;
    return `${Number.parseFloat(rounded.toFixed(2))}mm`;
  }
  return /mm$/i.test(formatted) ? formatted : `${formatted}mm`;
}

function formatAperture(value?: string): string {
  const formatted = formatExifText(value);
  if (formatted === "--") return formatted;
  return formatted.startsWith("f/") ? formatted : `f/${formatted}`;
}

export default PhotoDetailInfoPanel;
