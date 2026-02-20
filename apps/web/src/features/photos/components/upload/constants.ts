import { ProcessingStage } from "@/features/photos/types";

export const MAX_LIVE_VIDEO_SIZE = 10 * 1024 * 1024;

export const createInitialStages = (): ProcessingStage[] => [
  { id: "hash", name: "Computing Hash", status: "pending", progress: 0 },
  { id: "thumbnail", name: "Generating Thumbnail", status: "pending", progress: 0 },
  { id: "exif", name: "Extracting EXIF", status: "pending", progress: 0 },
  { id: "region", name: "Resolving Location", status: "pending", progress: 0 },
  { id: "privacy", name: "Privacy Scrubbing", status: "pending", progress: 0 },
  { id: "ocr", name: "OCR Scanning", status: "pending", progress: 0 },
  { id: "color", name: "Extracting Colors", status: "pending", progress: 0 },
  { id: "blur", name: "Blur Detection", status: "pending", progress: 0 },
  { id: "phash", name: "Calculating pHash", status: "pending", progress: 0 },
  { id: "finalize", name: "Finalizing Metadata", status: "pending", progress: 0 },
];
