import React from "react";
import { Camera, Aperture, Zap, Scan, Focus } from "lucide-react";
import type { Photo } from "@/features/photos/types";
import { formatExifText } from "../formatters";

interface ExifTabProps {
  photo: Photo;
}

const ExifTab: React.FC<ExifTabProps> = ({ photo }) => {
  const exif = photo.exif;
  const metadata = photo.metadata;

  const focalLength = formatFocalLength(exif.focalLength);
  const aperture = formatAperture(exif.aperture);
  const shutter = formatExifText(exif.shutter);
  const iso = exif.iso ? `ISO ${exif.iso}` : "--";

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Capture Settings
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <ParameterCard
            icon={<Focus size={16} />}
            label="Focal Length"
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
          <ParameterCard
            icon={<Scan size={16} />}
            label="ISO"
            value={iso}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Device
        </h3>
        <div className="space-y-2">
          <ExifRow
            icon={<Camera size={14} />}
            label="Camera"
            value={exif.camera || "Unknown"}
          />
          <ExifRow
            icon={<Focus size={14} />}
            label="Lens"
            value={exif.lens || "Unknown"}
          />
        </div>
      </div>

      {metadata?.exif?.Software && (
        <div className="space-y-3 pt-2 border-t border-white/10">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Software
          </h3>
          <p className="text-xs text-neutral-400">{metadata.exif.Software}</p>
        </div>
      )}
    </div>
  );
};

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
      <div className="flex items-center gap-2 text-neutral-500 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-medium text-neutral-200">{value}</div>
    </div>
  );
}

interface ExifRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function ExifRow({ icon, label, value }: ExifRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="flex items-center gap-2 text-neutral-500">
        {icon}
        {label}
      </span>
      <span className="text-neutral-300">{value}</span>
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

export default ExifTab;
