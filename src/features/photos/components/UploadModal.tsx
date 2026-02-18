import React, { useCallback, useEffect, useRef, useState } from "react";
import { HardDriveUpload, Loader2, X } from "lucide-react";
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
import { Badge } from "@/shared/ui/badge";
import {
  DEFAULT_UPLOAD_CONFIG,
  ImageMetadata,
  UploadQueueItem,
} from "@/features/photos/types";
import { uploadService } from "@/features/photos/services/uploadService";
import DescriptionModal from "./upload/DescriptionModal";
import UploadDropzone from "./upload/UploadDropzone";
import UploadQueuePanel from "./upload/UploadQueuePanel";
import UploadTokenCard from "./upload/UploadTokenCard";
import { MAX_LIVE_VIDEO_SIZE, createInitialStages } from "./upload/constants";
import { processUploadItem } from "./upload/processUploadItem";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (result: ImageMetadata) => void;
}

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

  const updateItemById = useCallback((id: string, updates: Partial<UploadQueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const updateStageById = useCallback(
    (id: string, stageId: string, updates: Partial<UploadQueueItem["stages"][number]>) => {
      setQueue((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            stages: item.stages.map((stage) =>
              stage.id === stageId ? { ...stage, ...updates } : stage
            ),
          };
        })
      );
    },
    []
  );

  const requestDescription = useCallback(
    (params: { originalFilename: string; initialDescription?: string }) =>
      new Promise<{ description?: string }>((resolve) => {
        pendingDescriptionResolverRef.current = resolve;
        setPendingDescriptionItem(params);
      }),
    []
  );

  const processFile = useCallback(
    async (item: UploadQueueItem) => {
      const maxRetries = 2;
      let attempt = 0;
      while (attempt <= maxRetries) {
        updateItemById(item.id, { status: "processing", retryCount: attempt, error: undefined });
        try {
          await processUploadItem({
            item,
            requestDescription,
            updateItem: (updates) => updateItemById(item.id, updates),
            updateStage: (stageId, updates) => updateStageById(item.id, stageId, updates),
            onUploadComplete,
          });
          return;
        } catch (error) {
          console.error("Processing failed:", error);
          if (attempt < maxRetries) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 800 * (attempt + 1));
            });
            attempt += 1;
            continue;
          }
          updateItemById(item.id, {
            status: "failed",
            error: error instanceof Error ? error.message : "处理失败",
            retryCount: attempt,
          });
          return;
        }
      }
    },
    [onUploadComplete, requestDescription, updateItemById, updateStageById]
  );

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
  }, [processFile, queue]);

  useEffect(() => {
    if (queue.some((item) => item.status === "queued")) {
      void processQueue();
    }
  }, [processQueue, queue]);

  const makeQueueId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const enqueueStaticFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (file) =>
        file.type.startsWith("image/") && file.size <= DEFAULT_UPLOAD_CONFIG.maxFileSize
    );

    const newItems: UploadQueueItem[] = fileArray.map((file) => ({
      id: makeQueueId(),
      file,
      uploadMode: "static",
      status: "queued",
      progress: 0,
      stages: createInitialStages(),
    }));

    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (!uploadService.getUploadToken()) {
        setTokenError("请先配置 UPLOAD_TOKEN，再选择或拖拽图片。");
        return;
      }
      setTokenError("");
      enqueueStaticFiles(files);
    },
    [enqueueStaticFiles]
  );

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
    setQueue((prev) => [
      ...prev,
      {
        id: makeQueueId(),
        file: stillFile,
        liveVideoFile: liveFile,
        uploadMode: "live_photo",
        status: "queued",
        progress: 0,
        stages: createInitialStages(),
      },
    ]);
    setPendingLiveStill(null);
    setPendingLiveVideo(null);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      if (uploadMode !== "static") {
        setTokenError("实况模式不支持拖拽，请手动选择主图与 MOV 文件。");
        return;
      }
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles, uploadMode]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (uploadMode === "static") {
        setIsDragging(true);
      }
    },
    [uploadMode]
  );

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        handleFiles(event.target.files);
      }
      event.target.value = "";
    },
    [handleFiles]
  );

  const handleLiveStillSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0];
      if (selected) {
        setPendingLiveStill(selected);
        if (pendingLiveVideo) {
          enqueueLivePair(selected, pendingLiveVideo);
        }
      }
      event.target.value = "";
    },
    [enqueueLivePair, pendingLiveVideo]
  );

  const handleLiveVideoSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0];
      if (selected) {
        setPendingLiveVideo(selected);
        if (pendingLiveStill) {
          enqueueLivePair(pendingLiveStill, selected);
        }
      }
      event.target.value = "";
    },
    [enqueueLivePair, pendingLiveStill]
  );

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item?.thumbnail) {
        URL.revokeObjectURL(item.thumbnail);
      }
      return prev.filter((entry) => entry.id !== id);
    });
  }, []);

  const retryItem = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "queued",
              progress: 0,
              error: undefined,
              stages: createInitialStages(),
            }
          : item
      )
    );
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

  const completedCount = queue.filter((item) => item.status === "completed").length;
  const failedCount = queue.filter((item) => item.status === "failed").length;
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
                <p className="text-xs text-gray-400">本地分析后上传到 GitHub 存储</p>
              </div>
            </div>
            <DialogClose className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-400 transition-colors hover:text-white">
              <X size={16} />
            </DialogClose>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] flex-1">
          <div className="space-y-4 p-5 md:p-6">
            <UploadTokenCard
              uploadToken={uploadToken}
              tokenError={tokenError}
              isTokenConfigured={isTokenConfigured}
              onChangeToken={(next) => {
                setUploadToken(next);
                uploadService.setUploadToken(next);
                if (tokenError) {
                  setTokenError("");
                }
              }}
            />

            <UploadDropzone
              isDragging={isDragging}
              uploadMode={uploadMode}
              isTokenConfigured={isTokenConfigured}
              pendingLiveStillName={pendingLiveStill?.name}
              pendingLiveVideoName={pendingLiveVideo?.name}
              fileInputRef={fileInputRef}
              liveStillInputRef={liveStillInputRef}
              liveVideoInputRef={liveVideoInputRef}
              onChangeMode={setUploadMode}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onFileSelect={handleFileSelect}
              onLiveStillSelect={handleLiveStillSelect}
              onLiveVideoSelect={handleLiveVideoSelect}
            />

            <UploadQueuePanel
              queue={queue}
              totalBytes={totalBytes}
              failedCount={failedCount}
              onRemoveItem={removeItem}
              onRetryItem={retryItem}
            />
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
