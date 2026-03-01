import React, { useMemo } from "react";
import { motion } from "motion/react";
import type { Photo, PhotoOpenTransition } from "@/features/photos/types";

interface PhotoTimelineViewProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo, transition?: PhotoOpenTransition) => void;
}

interface MonthGroup {
  key: string;
  label: string;
  photos: Photo[];
}

function buildTimeline(photos: Photo[]): MonthGroup[] {
  const grouped = new Map<string, Photo[]>();

  for (const photo of photos) {
    const dateStr = photo.exif?.date;
    if (!dateStr) {
      const bucket = grouped.get("Unknown") ?? [];
      bucket.push(photo);
      grouped.set("Unknown", bucket);
      continue;
    }
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      const bucket = grouped.get("Unknown") ?? [];
      bucket.push(photo);
      grouped.set("Unknown", bucket);
      continue;
    }
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(photo);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, photos]) => {
      let label: string;
      if (key === "Unknown") {
        label = "Unknown Date";
      } else {
        const [year, month] = key.split("-");
        const monthNames = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December",
        ];
        label = `${monthNames[Number.parseInt(month, 10) - 1]} ${year}`;
      }
      return { key, label, photos };
    });
}

const PhotoTimelineView: React.FC<PhotoTimelineViewProps> = ({
  photos,
  onPhotoClick,
}) => {
  const timeline = useMemo(() => buildTimeline(photos), [photos]);

  if (timeline.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/40">
        No photos to display
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-[1720px] pb-12">
      {/* Timeline line */}
      <div className="absolute top-0 bottom-0 left-6 w-px bg-gradient-to-b from-amber-500/40 via-white/10 to-transparent sm:left-10" />

      {timeline.map((group, groupIndex) => (
        <motion.div
          key={group.key}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.4, delay: Math.min(groupIndex * 0.05, 0.3) }}
          className="relative mb-10"
        >
          {/* Timeline dot */}
          <div className="absolute left-[19px] top-1 h-3 w-3 rounded-full border-2 border-amber-500/60 bg-neutral-900 sm:left-[34px]" />

          {/* Month header */}
          <div className="mb-4 pl-14 sm:pl-20">
            <h3 className="text-lg font-medium text-white sm:text-xl">
              {group.label}
            </h3>
            <span className="text-xs text-white/40">
              {group.photos.length} photo{group.photos.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-3 gap-1.5 pl-14 sm:grid-cols-4 sm:gap-2 sm:pl-20 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {group.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onPhotoClick(photo)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-white/[0.03] transition-transform hover:scale-[1.02]"
              >
                <img
                  src={photo.thumbnail}
                  alt={photo.title || photo.filename}
                  className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default PhotoTimelineView;
