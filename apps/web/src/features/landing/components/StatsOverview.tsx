import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Camera, MapPin, Calendar, Aperture } from "lucide-react";
import { NumberTicker } from "@/shared/magicui/number-ticker";
import type { Photo } from "@/features/photos/types";

interface StatsOverviewProps {
  photos: Photo[];
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ photos }) => {
  const stats = useMemo(() => {
    const locations = new Set<string>();
    const cameras = new Map<string, number>();
    let minYear = Infinity;
    let maxYear = -Infinity;

    for (const photo of photos) {
      if (photo.location) {
        locations.add(photo.location);
      }
      if (photo.exif?.camera) {
        const count = cameras.get(photo.exif.camera) || 0;
        cameras.set(photo.exif.camera, count + 1);
      }
      const year = photo.metadata?.timestamps?.created_at
        ? new Date(photo.metadata.timestamps.created_at).getFullYear()
        : null;
      if (year) {
        minYear = Math.min(minYear, year);
        maxYear = Math.max(maxYear, year);
      }
    }

    let topCamera = "Unknown";
    let topCount = 0;
    for (const [camera, count] of cameras) {
      if (count > topCount) {
        topCount = count;
        topCamera = camera;
      }
    }

    return {
      photoCount: photos.length,
      locationCount: locations.size,
      yearRange:
        minYear !== Infinity
          ? minYear === maxYear
            ? `${minYear}`
            : `${minYear} - ${maxYear}`
          : "--",
      topCamera: topCamera.split(" ").slice(0, 2).join(" "),
    };
  }, [photos]);

  const statItems = [
    { icon: Camera, label: "Photos", value: stats.photoCount, isNumber: true },
    {
      icon: MapPin,
      label: "Locations",
      value: stats.locationCount,
      isNumber: true,
    },
    { icon: Calendar, label: "Period", value: stats.yearRange, isNumber: false },
    { icon: Aperture, label: "Primary Gear", value: stats.topCamera, isNumber: false },
  ];

  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {statItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="glass-card flex flex-col items-center gap-3 rounded-2xl p-6 text-center"
          >
            <item.icon size={24} className="text-[#c9a962]" />
            <div className="space-y-1">
              {item.isNumber ? (
                <NumberTicker
                  value={item.value as number}
                  className="text-3xl font-semibold text-white"
                />
              ) : (
                <span className="text-lg font-medium text-white">
                  {item.value}
                </span>
              )}
              <p className="text-xs tracking-wider text-white/50 uppercase">
                {item.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default StatsOverview;
