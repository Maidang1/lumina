import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Images,
  HardDriveUpload,
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
  const failedCount = queue.filter((i) => i.status === "failed").length;
  const allCompleted = queue.length > 0 && completedCount === queue.length;
  const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);

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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden border border-white/10 bg-[#111111] p-0 shadow-[0_40px_120px_rgba(0,0,0,0.75)]">
        <DialogHeader className="space-y-0 border-b border-white/10 bg-gradient-to-r from-[#151515] via-[#1b1b1b] to-[#151515] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white">
                <HardDriveUpload size={16} />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold tracking-wide text-white">
                  上传图片
                </DialogTitle>
                <p className="text-xs text-gray-400">
                  本地分析后上传到 GitHub 存储
                </p>
              </div>
            </div>
            <DialogClose className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-400 transition-colors hover:text-white">
              <X size={16} />
            </DialogClose>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] flex-1">
          <div className="space-y-4 p-5 md:p-6">
            <Card
              className={cn(
                "relative overflow-hidden border p-0",
                "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)] before:content-['']",
                isDragging
                  ? "border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                  : "border-white/10 bg-[#171717] hover:border-white/20",
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <CardContent className="relative p-8 md:p-10">
                <div className="mx-auto flex max-w-lg flex-col items-center text-center">
                  <div
                    className={cn(
                      "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors",
                      isDragging
                        ? "border-cyan-300/80 bg-cyan-400/20 text-cyan-100"
                        : "border-white/15 bg-white/5 text-gray-300"
                    )}
                  >
                    <Upload size={26} />
                  </div>
                  <p className="text-base font-medium text-white">
                    拖拽照片到这里，立即开始处理
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    自动生成缩略图、提取 EXIF、OCR 与画质分析
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2 rounded-full bg-white text-black hover:bg-gray-200"
                    >
                      <Images size={14} />
                      选择文件
                    </Button>
                    <Badge className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-300">
                      JPG · PNG · WebP · HEIC
                    </Badge>
                    <Badge className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-300">
                      最大 {DEFAULT_UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB
                    </Badge>
                  </div>
                </div>
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
              <div className="rounded-2xl border border-white/10 bg-[#141414] p-3 md:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Sparkles size={14} className="text-cyan-300" />
                    <span>上传队列</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                      {queue.length} 张
                    </Badge>
                    <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                      {(totalBytes / 1024 / 1024).toFixed(1)} MB
                    </Badge>
                    {failedCount > 0 && (
                      <Badge className="rounded-full border border-red-400/40 bg-red-500/10 text-red-300">
                        失败 {failedCount}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {queue.map((item) => (
                    <Card
                      key={item.id}
                      className="border border-white/10 bg-gradient-to-b from-[#1a1a1a] to-[#151515] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="h-20 w-20 rounded-lg object-cover ring-1 ring-white/10"
                            />
                          ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-black/40 ring-1 ring-white/10">
                              <ImageIcon size={22} className="text-gray-500" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">
                                  {item.file.name}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-500">
                                  {(item.file.size / 1024 / 1024).toFixed(2)} MB
                                  {item.metadata?.image_id && (
                                    <span className="ml-2 font-mono text-[11px] text-gray-400">
                                      {item.metadata.image_id.slice(0, 16)}...
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={cn(
                                    "rounded-full border px-2.5 py-0.5 text-[11px]",
                                    item.status === "completed" &&
                                      "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
                                    item.status === "uploading" &&
                                      "border-cyan-400/40 bg-cyan-500/15 text-cyan-200",
                                    item.status === "processing" &&
                                      "border-sky-400/40 bg-sky-500/15 text-sky-200",
                                    item.status === "failed" &&
                                      "border-red-400/40 bg-red-500/15 text-red-300",
                                    item.status === "queued" &&
                                      "border-white/20 bg-white/5 text-gray-300"
                                  )}
                                >
                                  {item.status === "completed" && "已完成"}
                                  {item.status === "uploading" && "上传中"}
                                  {item.status === "processing" && "处理中"}
                                  {item.status === "failed" && "失败"}
                                  {item.status === "queued" && "等待中"}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(item.id)}
                                  className="h-7 w-7 rounded-full text-gray-500 hover:bg-white/10 hover:text-red-300"
                                >
                                  <X size={14} />
                                </Button>
                              </div>
                            </div>

                            {item.status === "processing" && (
                              <ProcessingProgress stages={item.stages} />
                            )}

                            {item.status === "uploading" && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-gray-400">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Loader2 size={12} className="animate-spin" />
                                    正在上传到 GitHub
                                  </span>
                                  <span>{Math.round(item.progress)}%</span>
                                </div>
                                <Progress
                                  value={item.progress}
                                  indicatorClassName="bg-gradient-to-r from-cyan-400 to-emerald-400"
                                />
                              </div>
                            )}

                            {item.status === "completed" && (
                              <div className="flex items-center gap-2 text-sm text-emerald-300">
                                <CheckCircle2 size={16} />
                                <span>上传完成</span>
                              </div>
                            )}

                            {item.status === "failed" && (
                              <div className="flex items-center gap-2 text-sm text-red-300">
                                <AlertCircle size={16} />
                                <span>{item.error || "处理失败"}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {item.metadata?.exif && (
                          <>
                            <Separator className="my-3 bg-white/10" />
                            <div className="flex flex-wrap gap-2 text-xs">
                              {item.metadata.exif.Model && (
                                <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                                  {item.metadata.exif.Model}
                                </Badge>
                              )}
                              {item.metadata.exif.FNumber && (
                                <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                                  f/{item.metadata.exif.FNumber}
                                </Badge>
                              )}
                              {item.metadata.exif.ExposureTime && (
                                <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                                  1/{Math.round(1 / item.metadata.exif.ExposureTime)}s
                                </Badge>
                              )}
                              {item.metadata.exif.ISO && (
                                <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                                  ISO {item.metadata.exif.ISO}
                                </Badge>
                              )}
                              {item.metadata.exif.FocalLength && (
                                <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
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
              </div>
            )}
          </div>
        </ScrollArea>

        {queue.length > 0 && (
          <>
            <Separator className="bg-white/10" />
            <DialogFooter className="items-center justify-between px-5 py-4 md:px-6">
              <div className="text-sm text-gray-400">
                {completedCount} / {queue.length} 完成
              </div>
              <div className="flex items-center gap-2">
                {!allCompleted && (
                  <Badge className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-300">
                    <Loader2 size={12} className="mr-1.5 inline animate-spin" />
                    处理中
                  </Badge>
                )}
                {allCompleted && (
                  <Button
                    onClick={onClose}
                    className="rounded-full bg-emerald-500 px-5 text-white hover:bg-emerald-400"
                  >
                    完成
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;
