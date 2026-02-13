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
  Edit3,
  Save,
} from "lucide-react";
import ProcessingProgress from "./ProcessingProgress";
import { cn } from "@/shared/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Separator } from "@/shared/ui/separator";
import { Button } from "@/shared/ui/button";
import { Progress } from "@/shared/ui/progress";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
  UploadQueueItem,
  ProcessingStage,
  ImageMetadata,
  DEFAULT_UPLOAD_CONFIG,
} from "@/features/photos/types";
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

interface DescriptionModalProps {
  originalFilename: string;
  initialDescription?: string;
  onSave: (description: string) => void | Promise<void>;
  onSkip: () => void;
}

const DescriptionModal: React.FC<DescriptionModalProps> = ({
  originalFilename,
  initialDescription = "",
  onSave,
  onSkip,
}) => {
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(description);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onSkip()}>
      <DialogContent className="w-[min(92vw,44rem)] max-w-none overflow-hidden border border-white/10 bg-[#111111] p-0 shadow-[0_40px_120px_rgba(0,0,0,0.75)]">
        <DialogHeader className="space-y-0 border-b border-white/10 px-5 py-4 md:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#c9a962]/40 bg-[#c9a962]/10 text-[#c9a962]">
              <Edit3 size={16} />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-wide text-white">
                添加描述
              </DialogTitle>
              <p className="truncate text-sm text-gray-400">
                为 "{originalFilename}" 添加描述
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4 md:px-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">描述（可选）</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入图片描述..."
              className="min-h-[140px] max-h-[40vh] resize-y border-white/15 bg-black/30 text-sm leading-relaxed text-white placeholder:text-gray-500 focus:border-[#c9a962]/60"
            />
            <div className="text-right text-xs text-gray-500">{description.length} 字</div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 border-t border-white/10 bg-[#141414] px-5 py-4 sm:flex-row sm:justify-end md:px-6">
          <Button variant="outline" onClick={onSkip} className="h-11 w-full border-white/20 bg-transparent text-gray-300 hover:bg-white/10 sm:w-auto">
            跳过
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="h-11 w-full bg-[#c9a962] text-black hover:bg-[#d4b97f] sm:w-auto">
            {isSaving ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin motion-reduce:animate-none" />
                保存中...
              </>
            ) : (
              <>
                <Save size={14} className="mr-2" />
                保存
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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

const MAX_LIVE_VIDEO_SIZE = 10 * 1024 * 1024;

const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [uploadMode, setUploadMode] = useState<"static" | "live_photo">("static");
  const [pendingLiveStill, setPendingLiveStill] = useState<File | null>(null);
  const [pendingLiveVideo, setPendingLiveVideo] = useState<File | null>(null);
  const [uploadToken, setUploadToken] = useState<string>("");
  const [tokenError, setTokenError] = useState<string>("");
  const [pendingDescriptionItem, setPendingDescriptionItem] = useState<{
    originalFilename: string;
    initialDescription?: string;
  } | null>(null);
  const pendingDescriptionResolverRef = useRef<
    ((value: { description?: string }) => void) | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveStillInputRef = useRef<HTMLInputElement>(null);
  const liveVideoInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const queueRef = useRef<UploadQueueItem[]>([]);

  useEffect(() => {
    setUploadToken(uploadService.getUploadToken());
  }, []);

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
        schema_version: "1.1",
        image_id: imageId,
        original_filename: item.file.name,
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

      const descriptionResult = await new Promise<{ description?: string }>((resolve) => {
        pendingDescriptionResolverRef.current = resolve;
        setPendingDescriptionItem({
          originalFilename: file.name,
          initialDescription: metadata.description || "",
        });
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
    if (!uploadService.getUploadToken()) {
      setTokenError("请先配置 UPLOAD_TOKEN，再选择或拖拽图片。");
      return;
    }

    setTokenError("");
    const fileArray = Array.from(files).filter(
      (file) => file.type.startsWith("image/") && file.size <= DEFAULT_UPLOAD_CONFIG.maxFileSize
    );

    const newItems: UploadQueueItem[] = fileArray.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      uploadMode: "static",
      status: "queued",
      progress: 0,
      stages: createInitialStages(),
    }));

    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const enqueueLivePair = useCallback((stillFile: File, liveFile: File) => {
    if (!uploadService.getUploadToken()) {
      setTokenError("请先配置 UPLOAD_TOKEN，再选择实况图片。");
      return;
    }

    if (!stillFile.type.startsWith("image/")) {
      setTokenError("实况主图必须是图片文件。");
      return;
    }

    const isMovType =
      liveFile.type === "video/quicktime" || liveFile.name.toLowerCase().endsWith(".mov");
    if (!isMovType) {
      setTokenError("实况视频必须是 MOV 文件。");
      return;
    }
    if (liveFile.size > MAX_LIVE_VIDEO_SIZE) {
      setTokenError("实况视频超过 10MB 限制。");
      return;
    }

    setTokenError("");
    const liveItem: UploadQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: stillFile,
      liveVideoFile: liveFile,
      uploadMode: "live_photo",
      status: "queued",
      progress: 0,
      stages: createInitialStages(),
    };
    setQueue((prev) => [...prev, liveItem]);
    setPendingLiveStill(null);
    setPendingLiveVideo(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (uploadMode !== "static") {
        setTokenError("实况模式不支持拖拽，请手动选择主图与 MOV 文件。");
        return;
      }
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles, uploadMode]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (uploadMode !== "static") return;
    setIsDragging(true);
  }, [uploadMode]);

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

  const handleLiveStillSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setPendingLiveStill(selected);
      if (pendingLiveVideo) {
        enqueueLivePair(selected, pendingLiveVideo);
      }
    }
    e.target.value = "";
  }, [enqueueLivePair, pendingLiveVideo]);

  const handleLiveVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setPendingLiveVideo(selected);
      if (pendingLiveStill) {
        enqueueLivePair(pendingLiveStill, selected);
      }
    }
    e.target.value = "";
  }, [enqueueLivePair, pendingLiveStill]);

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.thumbnail) {
        URL.revokeObjectURL(item.thumbnail);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleSaveDescription = useCallback((description: string) => {
    const resolver = pendingDescriptionResolverRef.current;
    pendingDescriptionResolverRef.current = null;
    resolver?.({ description: description.trim() });
    setPendingDescriptionItem(null);
  }, []);

  const handleSkipDescription = useCallback(() => {
    const resolver = pendingDescriptionResolverRef.current;
    pendingDescriptionResolverRef.current = null;
    resolver?.({});
    setPendingDescriptionItem(null);
  }, []);

  const completedCount = queue.filter((i) => i.status === "completed").length;
  const failedCount = queue.filter((i) => i.status === "failed").length;
  const allCompleted = queue.length > 0 && completedCount === queue.length;
  const totalBytes = queue.reduce((sum, item) => {
    return sum + item.file.size + (item.liveVideoFile?.size || 0);
  }, 0);
  const isTokenConfigured = uploadToken.trim().length > 0;

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
            <Card className="border border-white/10 bg-[#171717]">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="upload-token" className="text-sm font-medium text-gray-200">
                    UPLOAD_TOKEN
                  </label>
                  {!isTokenConfigured && (
                    <Badge className="rounded-full border border-[#c9a962]/40 bg-[#c9a962]/10 text-[#d4b97f]">
                      未配置
                    </Badge>
                  )}
                </div>
                <input
                  id="upload-token"
                  type="password"
                  value={uploadToken}
                  onChange={(e) => {
                    const next = e.target.value;
                    setUploadToken(next);
                    uploadService.setUploadToken(next);
                    if (tokenError) setTokenError("");
                  }}
                  placeholder="输入上传令牌（保存在当前浏览器本地）"
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#c9a962]/60"
                />
                <p className="text-xs text-gray-400">
                  仅保存在当前浏览器 localStorage，用于上传接口校验。
                </p>
                {tokenError && (
                  <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {tokenError}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card
              className={cn(
                "relative overflow-hidden border p-0",
                "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)] before:content-['']",
                isDragging
                  ? "border-[#c9a962]/60 bg-[#c9a962]/10 shadow-[0_0_0_1px_rgba(201,169,98,0.25)]"
                  : "border-white/10 bg-[#171717] hover:border-white/20",
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <CardContent className="relative p-8 md:p-10">
                <div className="mx-auto flex max-w-lg flex-col items-center text-center">
                  <div className="mb-5 flex w-full items-center justify-center gap-2">
                    <Button
                      onClick={() => setUploadMode("static")}
                      variant={uploadMode === "static" ? "default" : "outline"}
                      className={cn(
                        "rounded-full px-4 py-2 text-xs",
                        uploadMode === "static"
                          ? "bg-white text-black hover:bg-gray-200"
                          : "border-white/20 bg-transparent text-gray-300 hover:bg-white/10"
                      )}
                    >
                      静态图片
                    </Button>
                    <Button
                      onClick={() => setUploadMode("live_photo")}
                      variant={uploadMode === "live_photo" ? "default" : "outline"}
                      className={cn(
                        "rounded-full px-4 py-2 text-xs",
                        uploadMode === "live_photo"
                          ? "bg-[#c9a962] text-black hover:bg-[#d4b97f]"
                          : "border-[#c9a962]/40 bg-transparent text-[#d4b97f] hover:bg-[#c9a962]/15"
                      )}
                    >
                      实况图片
                    </Button>
                  </div>
                  <div
                    className={cn(
                      "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors",
                      isDragging
                        ? "border-[#c9a962]/80 bg-[#c9a962]/20 text-[#f1e2bf]"
                        : "border-white/15 bg-white/5 text-gray-300"
                    )}
                  >
                    <Upload size={26} />
                  </div>
                  {uploadMode === "static" ? (
                    <>
                      <p className="text-base font-medium text-white">
                        拖拽照片到这里，立即开始处理
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        自动生成缩略图、提取 EXIF、OCR 与画质分析
                      </p>
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!isTokenConfigured}
                          className="gap-2 rounded-full bg-white text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-500 disabled:text-gray-200"
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
                    </>
                  ) : (
                    <>
                      <p className="text-base font-medium text-white">
                        手动配对上传实况：主图 + MOV
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        需同时选择一张主图和一个 MOV 文件，缺一不可
                      </p>
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          onClick={() => liveStillInputRef.current?.click()}
                          disabled={!isTokenConfigured}
                          className="gap-2 rounded-full bg-white text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-500 disabled:text-gray-200"
                        >
                          <Images size={14} />
                          选择主图
                        </Button>
                        <Button
                          onClick={() => liveVideoInputRef.current?.click()}
                          disabled={!isTokenConfigured}
                          variant="outline"
                          className="gap-2 rounded-full border-[#c9a962]/50 bg-[#c9a962]/10 text-[#d4b97f] hover:bg-[#c9a962]/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Upload size={14} />
                          选择 MOV
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400">
                        <Badge className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-300">
                          主图: {pendingLiveStill?.name || "未选择"}
                        </Badge>
                        <Badge className="rounded-full border border-[#c9a962]/40 bg-[#c9a962]/10 px-3 py-1 text-xs text-[#d4b97f]">
                          MOV: {pendingLiveVideo?.name || "未选择"}
                        </Badge>
                        <Badge className="rounded-full border border-[#c9a962]/40 bg-[#c9a962]/10 px-3 py-1 text-xs text-[#d4b97f]">
                          MOV 最大 10MB
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  ref={liveStillInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLiveStillSelect}
                />
                <input
                  ref={liveVideoInputRef}
                  type="file"
                  accept=".mov,video/quicktime"
                  className="hidden"
                  onChange={handleLiveVideoSelect}
                />
              </CardContent>
            </Card>

            {queue.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-[#141414] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Sparkles size={14} className="text-[#c9a962]" />
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
                      className="rounded-xl border border-white/10 bg-gradient-to-b from-[#1a1a1a] to-[#151515] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
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
                                  {item.liveVideoFile && (
                                    <span className="ml-2 text-[#d4b97f]">
                                      + MOV {(item.liveVideoFile.size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                  )}
                                  {item.metadata?.image_id && (
                                    <span className="ml-2 font-mono text-[11px] text-gray-400">
                                      {item.metadata.image_id.slice(0, 16)}...
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.uploadMode === "live_photo" && (
                                  <Badge className="rounded-full border border-[#c9a962]/50 bg-[#c9a962]/10 text-[#d4b97f]">
                                    LIVE
                                  </Badge>
                                )}
                                <Badge
                                  className={cn(
                                    "rounded-full border px-2.5 py-0.5 text-[11px]",
                                    item.status === "completed" &&
                                      "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
                                    item.status === "uploading" &&
                                      "border-[#c9a962]/40 bg-[#c9a962]/15 text-[#e7d3a4]",
                                    item.status === "processing" &&
                                      "border-[#c9a962]/30 bg-[#c9a962]/10 text-[#e7d3a4]",
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
                                    <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
                                    正在上传到 GitHub
                                  </span>
                                  <span>{Math.round(item.progress)}%</span>
                                </div>
                                <Progress
                                  value={item.progress}
                                  indicatorClassName="bg-gradient-to-r from-[#c9a962] to-[#e7d3a4]"
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
                    <Loader2 size={12} className="mr-1.5 inline animate-spin motion-reduce:animate-none" />
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

      {pendingDescriptionItem ? (
        <DescriptionModal
          originalFilename={pendingDescriptionItem.originalFilename}
          initialDescription={pendingDescriptionItem.initialDescription}
          onSave={handleSaveDescription}
          onSkip={handleSkipDescription}
        />
      ) : null}
    </Dialog>
  );
};

export default UploadModal;
