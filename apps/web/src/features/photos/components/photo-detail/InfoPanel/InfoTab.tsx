import React from "react";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import type { Photo } from "@/features/photos/types";
import { formatBytes, formatTime } from "../formatters";

interface InfoTabProps {
  photo: Photo;
  tags: string[];
}

const InfoTab: React.FC<InfoTabProps> = ({ photo, tags }) => {
  const metadata = photo.metadata;

  return (
    <div className="flex flex-col gap-6">
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
                : photo.exif.date
            }
          />
        </div>
      </div>

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
  );
};

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
}

function InfoRow({ label, value }: InfoRowProps): React.ReactElement {
  return (
    <div className="grid grid-cols-[minmax(96px,120px)_minmax(0,1fr)] items-start gap-3 text-xs">
      <span className="flex min-w-0 items-center gap-2 text-neutral-500">
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-neutral-300">
        {value}
      </span>
    </div>
  );
}

export default InfoTab;
