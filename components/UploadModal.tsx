import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import ProcessingProgress from "./ProcessingProgress";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  UploadQueueItem,
  ProcessingStage,
  ImageMetadata,
  DEFAULT_UPLOAD_CONFIG,
} from "../types";
import {
  createThumbnail,
  computeSHA256,
  extractDominantColor,
  detectBlur,
} from "../services/imageProcessor";
import { extractExif } from "../services/exifExtractor";
import { performOcr } from "../services/ocrService";
import { computePHash } from "../services/phashService";
import { uploadService } from "../services/uploadService";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (result: ImageMetadata) => void;
}

const createInitialStages = (): ProcessingStage[] => [
  { id: "thumbnail", name: "缩略图生成", status: "pending", progress: 0 },
  { id: "exif", name: "EXIF 提取", status: "pending", progress: 0 },
  { id: "ocr", name: "OCR 识别", status: "pending", progress: 0 },
  { id: "color", name: "主色提取", status: "pending", progress: 0 },
  { id: "blur", name: "模糊检测", status: "pending", progress: 0 },
  { id: "phash", name: "感知哈希", status: "pending", progress: 0 },
];

const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const queueRef = useRef<UploadQueueItem[]>([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const processFile = useCallback(async (item: UploadQueueItem) => {
    const updateItem = (updates: Partial<UploadQueueItem>) => {
      setQueue((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, ...updates } : i))
      );
    };

    const updateStage = (stageId: string, updates: Partial<ProcessingStage>) => {
      setQueue((prev) =>
        prev.map((i) => {
          if (i.id !== item.id) return i;
          return {
            ...i,
            stages: i.stages.map((s) =>
              s.id === stageId ? { ...s, ...updates } : s
            ),
          };
        })
      );
    };

    updateItem({ status: "processing" });

    try {
      const file = item.file;

      const imageId = await computeSHA256(file);
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
        (p) => updateStage("ocr", { progress: p.progress * 100 })
      );
      updateStage("ocr", {
        status: ocrResult.status === "failed" ? "failed" : "completed",
        progress: 100,
      });

      updateStage("color", { status: "processing", progress: 0 });
      const dominantColor = extractDominantColor(thumbResult.canvas);
      updateStage("color", { status: "completed", progress: 100 });

      updateStage("blur", { status: "processing", progress: 0 });
      const blurInfo = detectBlur(
        thumbResult.canvas,
        128,
        DEFAULT_UPLOAD_CONFIG.blurThreshold
      );
      updateStage("blur", { status: "completed", progress: 100 });

      updateStage("phash", { status: "processing", progress: 0 });
      let phashInfo;
      try {
        phashInfo = await computePHash(thumbResult.blob);
      } catch {
        phashInfo = { algo: "blockhash" as const, bits: 16 as const, value: "" };
      }
      updateStage("phash", { status: "completed", progress: 100 });

      const dimensions = await new Promise<{ width: number; height: number }>(
        (resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.src = thumbUrl;
        }
      );

      const metadata: ImageMetadata = {
        schema_version: "1.0",
        image_id: imageId,
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
        },
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

      updateItem({ metadata });

      updateItem({ status: "uploading", progress: 0 });
      const result = await uploadService.uploadImage(
        file,
        thumbResult.blob,
        metadata,
        (progress) => updateItem({ progress })
      );

      updateItem({ status: "completed", result });
      onUploadComplete?.(metadata);
    } catch (error) {
      console.error("Processing failed:", error);
      updateItem({
        status: "failed",
        error: error instanceof Error ? error.message : "处理失败",
      });
    }
  }, [onUploadComplete]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    const pendingItem = queue.find((item) => item.status === "queued");
    if (!pendingItem) return;

    processingRef.current = true;
    try {
      await processFile(pendingItem);
    } finally {
      processingRef.current = false;
    }
  }, [queue, processFile]);

  useEffect(() => {
    if (queue.some((item) => item.status === "queued")) {
      processQueue();
    }
  }, [queue, processQueue]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (file) => file.type.startsWith("image/") && file.size <= DEFAULT_UPLOAD_CONFIG.maxFileSize
    );

    const newItems: UploadQueueItem[] = fileArray.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: "queued",
      progress: 0,
      stages: createInitialStages(),
    }));

    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
      e.target.value = "";
    },
    [handleFiles]
  );

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.thumbnail) {
        URL.revokeObjectURL(item.thumbnail);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const completedCount = queue.filter((i) => i.status === "completed").length;
  const allCompleted = queue.length > 0 && completedCount === queue.length;

  useEffect(() => {
    return () => {
      queueRef.current.forEach((item) => {
        if (item.thumbnail) {
          URL.revokeObjectURL(item.thumbnail);
        }
      });
    };
  }, []);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl border-gray-800 bg-[#1a1a1a] p-0">
        <DialogHeader className="flex-row items-center justify-between space-y-0 p-4">
          <DialogTitle>上传图片</DialogTitle>
          <DialogClose className="rounded-md p-1 text-gray-400 transition-colors hover:text-white">
            <X size={20} />
          </DialogClose>
        </DialogHeader>
        <Separator className="bg-gray-800" />

        <ScrollArea className="max-h-[70vh] flex-1">
          <div className="space-y-4 p-4">
            <Card
              className={cn(
                "border-2 border-dashed p-0 transition-colors",
                isDragging
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-700 bg-transparent hover:border-gray-600",
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <CardContent className="p-8 text-center">
                <Upload
                  size={40}
                  className={cn(
                    "mx-auto mb-4",
                    isDragging ? "text-blue-500" : "text-gray-500",
                  )}
                />
                <p className="mb-2 text-gray-300">拖拽图片到这里上传</p>
                <p className="mb-4 text-sm text-gray-500">或</p>
                <Button onClick={() => fileInputRef.current?.click()}>选择文件</Button>
                <p className="mt-4 text-xs text-gray-600">
                  支持 JPG, PNG, WebP, HEIC · 最大 {DEFAULT_UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </CardContent>
            </Card>

            {queue.length > 0 && (
              <div className="space-y-3">
                {queue.map((item) => (
                  <Card key={item.id} className="border-gray-800 bg-black/40">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt=""
                            className="h-20 w-20 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded bg-gray-800">
                            <ImageIcon size={24} className="text-gray-600" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-start justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm text-white">{item.file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(item.file.size / 1024 / 1024).toFixed(2)} MB
                                {item.metadata?.image_id && (
                                  <span className="ml-2 font-mono">
                                    {item.metadata.image_id.slice(0, 16)}...
                                  </span>
                                )}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.id)}
                              className="h-7 w-7 text-gray-500 hover:text-red-400"
                            >
                              <X size={16} />
                            </Button>
                          </div>

                          {item.status === "processing" && (
                            <ProcessingProgress stages={item.stages} />
                          )}

                          {item.status === "uploading" && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Loader2 size={12} className="animate-spin" />
                                <span>上传中...</span>
                              </div>
                              <Progress
                                value={item.progress}
                                indicatorClassName="bg-green-500"
                              />
                            </div>
                          )}

                          {item.status === "completed" && (
                            <div className="flex items-center gap-2 text-sm text-green-500">
                              <CheckCircle2 size={16} />
                              <span>上传完成</span>
                            </div>
                          )}

                          {item.status === "failed" && (
                            <div className="flex items-center gap-2 text-sm text-red-500">
                              <AlertCircle size={16} />
                              <span>{item.error || "处理失败"}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {item.metadata?.exif && (
                        <>
                          <Separator className="my-3 bg-gray-800" />
                          <div className="flex flex-wrap gap-2 text-xs">
                            {item.metadata.exif.Model && (
                              <Badge variant="outline">{item.metadata.exif.Model}</Badge>
                            )}
                            {item.metadata.exif.FNumber && (
                              <Badge variant="outline">f/{item.metadata.exif.FNumber}</Badge>
                            )}
                            {item.metadata.exif.ExposureTime && (
                              <Badge variant="outline">
                                1/{Math.round(1 / item.metadata.exif.ExposureTime)}s
                              </Badge>
                            )}
                            {item.metadata.exif.ISO && (
                              <Badge variant="outline">ISO {item.metadata.exif.ISO}</Badge>
                            )}
                            {item.metadata.exif.FocalLength && (
                              <Badge variant="outline">
                                {item.metadata.exif.FocalLength}mm
                              </Badge>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {queue.length > 0 && (
          <>
            <Separator className="bg-gray-800" />
            <DialogFooter className="justify-between p-4">
              <span className="text-sm text-gray-500">
                {completedCount} / {queue.length} 完成
              </span>
              {allCompleted && (
                <Button onClick={onClose} className="bg-green-600 text-white hover:bg-green-700">
                  完成
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;
