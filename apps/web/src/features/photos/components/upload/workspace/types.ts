import { UploadQueueItem } from "@/features/photos/types";

export type UploadWorkspaceStatus = UploadQueueItem["status"];

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
