import React, { useMemo, useState } from "react";
import { X, Camera, Aperture, Zap, Focus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Photo } from "@/features/photos/types";

interface ExifStatsPanelProps {
  photos: Photo[];
  open: boolean;
  onClose: () => void;
}

interface BucketItem {
  label: string;
  count: number;
}

function buildIsoBuckets(photos: Photo[]): BucketItem[] {
  const buckets: Record<string, number> = {
    "≤200": 0,
    "201-800": 0,
    "801-3200": 0,
    "3201-12800": 0,
    ">12800": 0,
  };
  for (const p of photos) {
    const iso = p.exif?.iso;
    if (!iso) continue;
    if (iso <= 200) buckets["≤200"]++;
    else if (iso <= 800) buckets["201-800"]++;
    else if (iso <= 3200) buckets["801-3200"]++;
    else if (iso <= 12800) buckets["3201-12800"]++;
    else buckets[">12800"]++;
  }
  return Object.entries(buckets)
    .map(([label, count]) => ({ label, count }))
    .filter((b) => b.count > 0);
}

function parseAperture(value?: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/^f\/?/i, "").trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function buildApertureBuckets(photos: Photo[]): BucketItem[] {
  const buckets: Record<string, number> = {
    "f/1–f/2": 0,
    "f/2–f/4": 0,
    "f/4–f/8": 0,
    "f/8–f/16": 0,
    "f/16+": 0,
  };
  for (const p of photos) {
    const ap = parseAperture(p.exif?.aperture);
    if (ap === null) continue;
    if (ap < 2) buckets["f/1–f/2"]++;
    else if (ap < 4) buckets["f/2–f/4"]++;
    else if (ap < 8) buckets["f/4–f/8"]++;
    else if (ap < 16) buckets["f/8–f/16"]++;
    else buckets["f/16+"]++;
  }
  return Object.entries(buckets)
    .map(([label, count]) => ({ label, count }))
    .filter((b) => b.count > 0);
}

function parseFocalLength(value?: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/mm$/i, "").trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function buildFocalBuckets(photos: Photo[]): BucketItem[] {
  const buckets: Record<string, number> = {
    "≤24mm": 0,
    "25–50mm": 0,
    "51–100mm": 0,
    "101–200mm": 0,
    ">200mm": 0,
  };
  for (const p of photos) {
    const fl = parseFocalLength(p.exif?.focalLength);
    if (fl === null) continue;
    if (fl <= 24) buckets["≤24mm"]++;
    else if (fl <= 50) buckets["25–50mm"]++;
    else if (fl <= 100) buckets["51–100mm"]++;
    else if (fl <= 200) buckets["101–200mm"]++;
    else buckets[">200mm"]++;
  }
  return Object.entries(buckets)
    .map(([label, count]) => ({ label, count }))
    .filter((b) => b.count > 0);
}

function parseShutterSpeed(value?: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/s$/i, "").trim();
  if (cleaned.includes("/")) {
    const [num, den] = cleaned.split("/").map(Number);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0)
      return num / den;
    return null;
  }
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function buildShutterBuckets(photos: Photo[]): BucketItem[] {
  const buckets: Record<string, number> = {
    "≤1/1000s": 0,
    "1/500–1/125s": 0,
    "1/60–1/15s": 0,
    "1/8–1s": 0,
    ">1s": 0,
  };
  for (const p of photos) {
    const ss = parseShutterSpeed(p.exif?.shutter);
    if (ss === null) continue;
    if (ss <= 1 / 1000) buckets["≤1/1000s"]++;
    else if (ss <= 1 / 125) buckets["1/500–1/125s"]++;
    else if (ss <= 1 / 15) buckets["1/60–1/15s"]++;
    else if (ss <= 1) buckets["1/8–1s"]++;
    else buckets[">1s"]++;
  }
  return Object.entries(buckets)
    .map(([label, count]) => ({ label, count }))
    .filter((b) => b.count > 0);
}

type StatTab = "iso" | "aperture" | "focal" | "shutter";

const ExifStatsPanel: React.FC<ExifStatsPanelProps> = ({
  photos,
  open,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<StatTab>("iso");

  const stats = useMemo(
    () => ({
      iso: buildIsoBuckets(photos),
      aperture: buildApertureBuckets(photos),
      focal: buildFocalBuckets(photos),
      shutter: buildShutterBuckets(photos),
    }),
    [photos],
  );

  const activeBuckets = stats[activeTab];
  const maxCount = Math.max(...activeBuckets.map((b) => b.count), 1);

  const tabs: { key: StatTab; label: string; icon: React.ReactNode }[] = [
    { key: "iso", label: "ISO", icon: <Zap size={13} /> },
    { key: "aperture", label: "Aperture", icon: <Aperture size={13} /> },
    { key: "focal", label: "Focal", icon: <Focus size={13} /> },
    { key: "shutter", label: "Shutter", icon: <Camera size={13} /> },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="relative z-10 w-[420px] max-w-[90vw] rounded-2xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl backdrop-blur-md"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                EXIF Statistics
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mb-5 flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    activeTab === tab.key
                      ? "bg-white/12 text-white"
                      : "text-white/45 hover:text-white/75"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {activeBuckets.length === 0 ? (
              <p className="py-8 text-center text-xs text-white/40">
                No data available
              </p>
            ) : (
              <div className="space-y-3">
                {activeBuckets.map((bucket) => (
                  <div key={bucket.label} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/60">{bucket.label}</span>
                      <span className="tabular-nums text-white/80">
                        {bucket.count}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500/80 to-orange-500/80"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(bucket.count / maxCount) * 100}%`,
                        }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-[10px] text-white/30">
              Based on {photos.length} photos
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExifStatsPanel;
