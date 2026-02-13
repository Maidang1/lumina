import { DEFAULT_UPLOAD_CONFIG, ImageMetadata, ProcessingStage, UploadQueueItem } from "@/features/photos/types";
import { computePHash } from "@/features/photos/services/phashService";
import { createThumbnail, computeSHA256, detectBlur, extractDominantColor } from "@/features/photos/services/imageProcessor";
import { extractExif } from "@/features/photos/services/exifExtractor";
import { performOcr } from "@/features/photos/services/ocrService";
import { uploadService } from "@/features/photos/services/uploadService";

interface ProcessUploadItemOptions {
  item: UploadQueueItem;
  requestDescription: (params: {
    originalFilename: string;
    initialDescription?: string;
  }) => Promise<{ description?: string }>;
  updateItem: (updates: Partial<UploadQueueItem>) => void;
  updateStage: (stageId: string, updates: Partial<ProcessingStage>) => void;
  onUploadComplete?: (metadata: ImageMetadata) => void;
}

const resolveImageDimensions = async (imageSrc: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.src = imageSrc;
  });
};

export const processUploadItem = async ({
  item,
  requestDescription,
  updateItem,
  updateStage,
  onUploadComplete,
}: ProcessUploadItemOptions): Promise<void> => {
  const file = item.file;

  const stillHash = await computeSHA256(file);
  const liveVideoHash = item.liveVideoFile ? await computeSHA256(item.liveVideoFile) : null;
  const imageId =
    item.uploadMode === "live_photo" && liveVideoHash
      ? await computeSHA256(new Blob([stillHash, ":", liveVideoHash], { type: "text/plain" }))
      : stillHash;
  updateItem({ metadata: { image_id: imageId } as ImageMetadata });

  updateStage("thumbnail", { status: "processing", progress: 0 });
  const thumbResult = await createThumbnail(file, {
    maxThumbSize: DEFAULT_UPLOAD_CONFIG.maxThumbSize,
    thumbQuality: DEFAULT_UPLOAD_CONFIG.thumbQuality,
  });
  updateStage("thumbnail", { status: "completed", progress: 100 });

  const thumbUrl = URL.createObjectURL(thumbResult.blob);
  updateItem({ thumbnail: thumbUrl });

  updateStage("exif", { status: "processing", progress: 0 });
  const exifResult = await extractExif(file);
  updateStage("exif", { status: "completed", progress: 100 });

  updateStage("ocr", { status: "processing", progress: 0 });
  const ocrResult = await performOcr(
    thumbResult.blob,
    { lang: DEFAULT_UPLOAD_CONFIG.ocrLang },
    (progress) => updateStage("ocr", { progress: progress.progress * 100 })
  );
  updateStage("ocr", {
    status: ocrResult.status === "failed" ? "failed" : "completed",
    progress: 100,
  });

  updateStage("color", { status: "processing", progress: 0 });
  const dominantColor = extractDominantColor(thumbResult.canvas);
  updateStage("color", { status: "completed", progress: 100 });

  updateStage("blur", { status: "processing", progress: 0 });
  const blurInfo = detectBlur(thumbResult.canvas, 128, DEFAULT_UPLOAD_CONFIG.blurThreshold);
  updateStage("blur", { status: "completed", progress: 100 });

  updateStage("phash", { status: "processing", progress: 0 });
  let phashInfo;
  try {
    phashInfo = await computePHash(thumbResult.blob);
  } catch {
    phashInfo = { algo: "blockhash" as const, bits: 16 as const, value: "" };
  }
  updateStage("phash", { status: "completed", progress: 100 });

  const dimensions = await resolveImageDimensions(thumbUrl);

  const metadata: ImageMetadata = {
    schema_version: "1.1",
    image_id: imageId,
    original_filename: file.name,
    timestamps: {
      created_at: new Date().toISOString(),
      client_processed_at: new Date().toISOString(),
    },
    files: {
      original: {
        path: "",
        mime: file.type,
        bytes: file.size,
      },
      thumb: {
        path: "",
        mime: "image/webp",
        bytes: thumbResult.blob.size,
        width: thumbResult.width,
        height: thumbResult.height,
      },
      ...(item.liveVideoFile
        ? {
            live_video: {
              path: "",
              mime: item.liveVideoFile.type || "video/quicktime",
              bytes: item.liveVideoFile.size,
            },
          }
        : {}),
    },
    ...(item.uploadMode === "live_photo" && liveVideoHash
      ? {
          live_photo: {
            enabled: true,
            pair_id: imageId,
            still_hash: stillHash,
            video_hash: liveVideoHash,
          },
        }
      : {}),
    exif: exifResult.exif || undefined,
    privacy: exifResult.privacy,
    derived: {
      dimensions,
      dominant_color: dominantColor,
      blur: blurInfo,
      phash: phashInfo,
      ocr: ocrResult,
    },
  };

  const descriptionResult = await requestDescription({
    originalFilename: file.name,
    initialDescription: metadata.description || "",
  });

  const nextMetadata: ImageMetadata = {
    ...metadata,
    ...(descriptionResult.description !== undefined
      ? { description: descriptionResult.description }
      : {}),
  };

  updateItem({ metadata: nextMetadata });
  updateItem({ status: "uploading", progress: 0 });

  const result = await uploadService.uploadImage(
    file,
    thumbResult.blob,
    nextMetadata,
    item.liveVideoFile,
    item.uploadMode,
    (progress) => updateItem({ progress })
  );

  updateItem({ status: "completed", result });
  onUploadComplete?.(nextMetadata);
};
