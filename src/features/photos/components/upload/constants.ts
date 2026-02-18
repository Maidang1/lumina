import { ProcessingStage } from "@/features/photos/types";

export const MAX_LIVE_VIDEO_SIZE = 10 * 1024 * 1024;

export const createInitialStages = (): ProcessingStage[] => [
  { id: "hash", name: "哈希计算", status: "pending", progress: 0 },
  { id: "thumbnail", name: "缩略图生成", status: "pending", progress: 0 },
  { id: "exif", name: "EXIF 提取", status: "pending", progress: 0 },
  { id: "region", name: "区域解析", status: "pending", progress: 0 },
  { id: "privacy", name: "隐私脱敏", status: "pending", progress: 0 },
  { id: "ocr", name: "OCR 识别", status: "pending", progress: 0 },
  { id: "color", name: "主色提取", status: "pending", progress: 0 },
  { id: "blur", name: "模糊检测", status: "pending", progress: 0 },
  { id: "phash", name: "感知哈希", status: "pending", progress: 0 },
  { id: "finalize", name: "元数据组装", status: "pending", progress: 0 },
];
