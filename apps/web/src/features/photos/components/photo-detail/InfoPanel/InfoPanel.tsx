import React from "react";
import {
  Camera,
  Aperture,
  Zap,
  Scan,
  Focus,
  MapPin,
  Navigation,
  Globe,
} from "lucide-react";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import type { Photo } from "@/features/photos/types";
import { formatBytes, formatExifText, formatTime } from "../formatters";

interface InfoPanelProps {
  photo: Photo;
  tags: string[];
}

const InfoPanel: React.FC<InfoPanelProps> = ({ photo, tags }) => {
  const metadata = photo.metadata;
  const exif = photo.exif;
  const exifGps = metadata?.exif;
  const hasCoordinates =
    exifGps?.GPSLatitude !== undefined && exifGps?.GPSLongitude !== undefined;
  const geoRegion = metadata?.geo?.region;

  const focalLength = formatFocalLength(exif.focalLength);
  const aperture = formatAperture(exif.aperture);
  const shutter = formatExifText(exif.shutter);
  const iso = exif.iso ? `ISO ${exif.iso}` : "--";

  return (
    <ScrollArea className="h-full w-full bg-transparent">
      <div className="flex flex-col gap-6 p-6">
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
            <InfoRow label="Category" value={photo.category || "--"} />
            <InfoRow
              label="Capture Time"
              value={
                metadata
                  ? formatTime(metadata.timestamps.created_at)
                  : exif.date
              }
            />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Capture Settings
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <ParameterCard
              icon={<Focus size={16} />}
              label="Focal"
              value={focalLength}
            />
            <ParameterCard
              icon={<Aperture size={16} />}
              label="Aperture"
              value={aperture}
            />
            <ParameterCard
              icon={<Zap size={16} />}
              label="Shutter"
              value={shutter}
            />
            <ParameterCard icon={<Scan size={16} />} label="ISO" value={iso} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Device
          </h3>
          <div className="space-y-2">
            <InfoRow
              label="Camera"
              value={exif.camera || "Unknown"}
              icon={<Camera size={14} />}
            />
            <InfoRow
              label="Lens"
              value={exif.lens || "Unknown"}
              icon={<Focus size={14} />}
            />
          </div>
        </div>

        {(photo.location || geoRegion || hasCoordinates) && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Location
            </h3>
            <div className="space-y-2">
              {photo.location && (
                <InfoRow
                  label="Place"
                  value={photo.location}
                  icon={<MapPin size={14} />}
                />
              )}
              {geoRegion?.country && (
                <InfoRow
                  label="Country"
                  value={geoRegion.country}
                  icon={<Globe size={14} />}
                />
              )}
              {geoRegion?.province && (
                <InfoRow
                  label="Province"
                  value={geoRegion.province}
                  icon={<Navigation size={14} />}
                />
              )}
              {geoRegion?.city && (
                <InfoRow
                  label="City"
                  value={geoRegion.city}
                  icon={<MapPin size={14} />}
                />
              )}
              {hasCoordinates && (
                <InfoRow
                  label="Coordinates"
                  value={`${exifGps!.GPSLatitude!.toFixed(6)}, ${exifGps!.GPSLongitude!.toFixed(6)}`}
                  icon={<Navigation size={14} />}
                />
              )}
            </div>
          </div>
        )}

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

        {metadata && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Analysis
            </h3>
            <div className="space-y-2 text-xs">
              <InfoRow
                label="Focus Score"
                value={
                  <span
                    className={cn(
                      metadata.derived.blur.is_blurry
                        ? "text-rose-400"
                        : "text-emerald-400"
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

interface ParameterCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function ParameterCard({
  icon,
  label,
  value,
}: ParameterCardProps): React.ReactElement {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 text-neutral-500 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-medium text-neutral-200">{value}</div>
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

export default InfoPanel;
