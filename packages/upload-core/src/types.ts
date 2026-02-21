import type { ImageMetadata } from "@luminafe/contracts";

export interface UploadPipelineInput {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  liveVideo?: {
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
  };
}

export interface UploadPipelineOutput {
  metadata: ImageMetadata;
  thumb: Uint8Array;
}

export interface NodePipelineOptions {
  ocrLang?: string;
  maxThumbSize?: number;
  thumbQuality?: number;
  blurThreshold?: number;
  resolveRegion?: boolean;
}
