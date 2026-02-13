import { ProcessingStage } from "@/features/photos/types";

export const MAX_LIVE_VIDEO_SIZE = 10 * 1024 * 1024;

export const createInitialStages = (): ProcessingStage[] => [
  { id: "thumbnail", name: "缩略图生成", status: "pending", progress: 0 },
  { id: "exif", name: "EXIF 提取", status: "pending", progress: 0 },
  { id: "ocr", name: "OCR 识别", status: "pending", progress: 0 },
  { id: "color", name: "主色提取", status: "pending", progress: 0 },
  { id: "blur", name: "模糊检测", status: "pending", progress: 0 },
  { id: "phash", name: "感知哈希", status: "pending", progress: 0 },
];
