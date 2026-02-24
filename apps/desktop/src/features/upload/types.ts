import { UploadQueueItem } from "@/types/photo";

export interface UploadQueueStats {
  parsedCount: number;
  parseFailedCount: number;
  parseActiveCount: number;
  uploadActiveCount: number;
  uploadCompletedCount: number;
  uploadFailedCount: number;
  totalBytes: number;
  isParseDone: boolean;
}
