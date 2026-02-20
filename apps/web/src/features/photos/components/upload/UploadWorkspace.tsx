import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HardDriveUpload, Loader2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Separator } from "@/shared/ui/separator";
import { DEFAULT_UPLOAD_CONFIG, UploadQueueItem } from "@/features/photos/types";
import { uploadService } from "@/features/photos/services/uploadService";
import UploadDropzone from "@/features/photos/components/upload/UploadDropzone";
import UploadQueuePanel from "@/features/photos/components/upload/UploadQueuePanel";
import UploadSettingsPopover from "@/features/photos/components/upload/UploadSettingsPopover";
import { MAX_LIVE_VIDEO_SIZE, createInitialStages } from "@/features/photos/components/upload/constants";
import { parseUploadItem, submitUploadItem } from "@/features/photos/components/upload/processUploadItem";

const SUBMIT_WORKERS = 3;

const makeQueueId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface UploadWorkspaceProps {
  onUploadCompleted?: (successCount: number) => void;
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
}

const UploadWorkspace: React.FC<UploadWorkspaceProps> = ({ 
  onUploadCompleted,
  initialFiles,
  onInitialFilesConsumed,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  // uploadMode is now always "static" since live photo support is removed
  const uploadMode = "static";
  const [uploadToken, setUploadToken] = useState<string>("");
  const [tokenError, setTokenError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inFlightParseRef = useRef<Set<string>>(new Set());
  const thumbBlobRef = useRef<Map<string, Blob>>(new Map());
  const queueRef = useRef<UploadQueueItem[]>([]);


  const parseWorkerCount = useMemo(() => {
    const hardware =
      typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;
    return Math.min(4, Math.max(2, Math.floor(hardware / 2)));
  }, []);

  const [isTokenConfigured, setIsTokenConfigured] = useState(false);

  useEffect(() => {
    const token = uploadService.getUploadToken();
    setUploadToken(token);
    setIsTokenConfigured(token.trim().length > 0);
  }, []);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    return () => {
      queueRef.current.forEach((item) => {
        if (item.thumbnail) {
          URL.revokeObjectURL(item.thumbnail);
        }
      });
      thumbBlobRef.current.clear();
    };
  }, []);

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

  const parseFile = useCallback(
    async (item: UploadQueueItem, workerSlot: number) => {
      if (inFlightParseRef.current.has(item.id)) {
        return;
      }
      inFlightParseRef.current.add(item.id);

      updateItemById(item.id, {
        status: "parsing",
        progress: 0,
        parseError: undefined,
        error: undefined,
        workerSlot,
      });

      try {
        const parsed = await parseUploadItem({
          item,
          updateItem: (updates) => updateItemById(item.id, updates),
          updateStage: (stageId, updates) => updateStageById(item.id, stageId, updates),
        });
        thumbBlobRef.current.set(item.id, parsed.thumbBlob);
        updateItemById(item.id, {
          status: "parsed",
          progress: 100,
          parseError: undefined,
        });
      } catch (error) {
        updateItemById(item.id, {
          status: "parse_failed",
          parseError: error instanceof Error ? error.message : "解析失败",
          error: error instanceof Error ? error.message : "解析失败",
        });
      } finally {
        inFlightParseRef.current.delete(item.id);
      }
    },
    [updateItemById, updateStageById]
  );

  useEffect(() => {
    if (!isTokenConfigured) {
      return;
    }
    const activeCount = queue.filter((item) => item.status === "parsing").length;
    const availableSlots = Math.max(0, parseWorkerCount - activeCount);
    if (availableSlots <= 0) return;

    const pendingItems = queue
      .filter((item) => item.status === "queued_parse")
      .slice(0, availableSlots);

    pendingItems.forEach((item, index) => {
      const slot = activeCount + index + 1;
      void parseFile(item, slot);
    });
  }, [isTokenConfigured, parseFile, parseWorkerCount, queue]);

  const enqueueStaticFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (file) => file.type.startsWith("image/") && file.size <= DEFAULT_UPLOAD_CONFIG.maxFileSize
    );

    const newItems: UploadQueueItem[] = fileArray.map((file) => ({
      id: makeQueueId(),
      file,
      uploadMode: "static",
      status: "queued_parse",
      progress: 0,
      stages: createInitialStages(),
    }));

    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (!uploadService.getUploadToken()) {
        setTokenError("请先配置 UPLOAD_TOKEN，再选择图片。");
        return;
      }
      setTokenError("");
      enqueueStaticFiles(files);
    },
    [enqueueStaticFiles]
  );

  useEffect(() => {
    if (!initialFiles || initialFiles.length === 0) {
      return;
    }
    handleFiles(initialFiles);
    onInitialFilesConsumed?.();
  }, [handleFiles, initialFiles, onInitialFilesConsumed]);


  const removeItem = useCallback((id: string) => {
    inFlightParseRef.current.delete(id);
    setQueue((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item?.thumbnail) {
        URL.revokeObjectURL(item.thumbnail);
      }
      thumbBlobRef.current.delete(id);
      return prev.filter((entry) => entry.id !== id);
    });
  }, []);

  const retryItem = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (item.status === "upload_failed") {
          return {
            ...item,
            status: "ready_to_upload",
            progress: 0,
            uploadError: undefined,
            error: undefined,
          };
        }

        return {
          ...item,
          status: "queued_parse",
          progress: 0,
          error: undefined,
          parseError: undefined,
          uploadError: undefined,
          metadata: undefined,
          result: undefined,
          processingSummary: undefined,
          taskMetrics: undefined,
          workerSlot: undefined,
          stages: createInitialStages(),
        };
      })
    );
    thumbBlobRef.current.delete(id);
  }, []);

  const parsedCount = queue.filter((item) => item.status === "parsed" || item.status === "ready_to_upload").length;
  const parseFailedCount = queue.filter((item) => item.status === "parse_failed").length;
  const parseActiveCount = queue.filter((item) => item.status === "parsing").length;
  const uploadActiveCount = queue.filter((item) => item.status === "uploading").length;
  const isParseDone =
    queue.length > 0 &&
    queue.every(
      (item) => item.status !== "queued_parse" && item.status !== "parsing"
    );

  const uploadCompletedCount = queue.filter((item) => item.status === "upload_completed").length;
  const uploadFailedCount = queue.filter((item) => item.status === "upload_failed").length;
  const totalBytes = queue.reduce((sum, item) => {
    return sum + item.file.size + (item.liveVideoFile?.size || 0);
  }, 0);

  const handleDraftChange = useCallback(
    (id: string, field: "description" | "original_filename", value: string) => {
      setQueue((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            editDraft: {
              description: item.editDraft?.description ?? item.metadata?.description ?? "",
              original_filename:
                item.editDraft?.original_filename ?? item.metadata?.original_filename ?? item.file.name,
              [field]: value,
            },
          };
        })
      );
    },
    []
  );

  const doSubmitItem = useCallback(async (item: UploadQueueItem): Promise<boolean> => {
    const thumbBlob = thumbBlobRef.current.get(item.id);
    if (!item.metadata || !thumbBlob) {
      updateItemById(item.id, {
        status: "upload_failed",
        uploadError: "缺少解析结果，无法上传",
      });
      return false;
    }

    const draft = item.editDraft;
    const description = draft?.description?.trim();
    const filenameDraft = draft?.original_filename?.trim();

    const finalMetadata = {
      ...item.metadata,
      ...(description !== undefined ? { description } : {}),
      ...(filenameDraft ? { original_filename: filenameDraft } : {}),
    };

    updateItemById(item.id, {
      metadata: finalMetadata,
      status: "uploading",
      progress: 0,
      uploadError: undefined,
      error: undefined,
    });

    try {
      const result = await submitUploadItem({
        item,
        metadata: finalMetadata,
        thumbBlob,
        onProgress: (progress) => updateItemById(item.id, { progress }),
      });

      updateItemById(item.id, {
        status: "upload_completed",
        progress: 100,
        result,
      });
      return true;
    } catch (error) {
      updateItemById(item.id, {
        status: "upload_failed",
        uploadError: error instanceof Error ? error.message : "上传失败",
        error: error instanceof Error ? error.message : "上传失败",
      });
      return false;
    }
  }, [updateItemById]);

  const handleSubmitAll = useCallback(async () => {
    if (!uploadService.getUploadToken()) {
      setTokenError("请先配置 UPLOAD_TOKEN，再执行上传。");
      return;
    }

    const candidates = queue.filter(
      (item) => item.status === "parsed" || item.status === "ready_to_upload" || item.status === "upload_failed"
    );
    if (candidates.length === 0) {
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;

    let nextIndex = 0;
    const workerTotal = Math.min(SUBMIT_WORKERS, candidates.length);
    const workers = Array.from({ length: workerTotal }, async () => {
      while (nextIndex < candidates.length) {
        const current = candidates[nextIndex];
        nextIndex += 1;
        if (!current) {
          return;
        }
        const success = await doSubmitItem(current);
        if (success) {
          successCount += 1;
        }
      }
    });

    await Promise.all(workers);
    setIsSubmitting(false);

    if (successCount > 0) {
      onUploadCompleted?.(successCount);
    }
  }, [doSubmitItem, onUploadCompleted, queue]);

  const canSubmit = isParseDone && parsedCount > 0 && !isSubmitting;

  return (
    <div className="space-y-6">
      <UploadSettingsPopover
        uploadToken={uploadToken}
        tokenError={tokenError}
        isTokenConfigured={isTokenConfigured}
        panelTitle="配置"
        iconSize={16}
        buttonClassName="hidden" // Hidden but kept for logic? No, just hide it. The parent should handle config maybe?
        // Actually the user wants a VERY simple modal. "Confirm upload these files?"
        // The token config should probably be elsewhere or just implied.
        // But for now let's keep the logic but hide the UI element if token is set?
        // Wait, if token is NOT set, we need it.
        onChangeToken={(next) => {
          setUploadToken(next);
          uploadService.setUploadToken(next);
          setIsTokenConfigured(next.trim().length > 0);
          if (tokenError) {
            setTokenError("");
          }
        }}
      />
      
      {!isTokenConfigured && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200/80">
          请先配置上传令牌 (UPLOAD_TOKEN)
          <Input 
             className="mt-2 border-white/10 bg-black/20"
             placeholder="输入 Token..."
             value={uploadToken}
             onChange={(e) => {
                const next = e.target.value;
                setUploadToken(next);
                uploadService.setUploadToken(next);
                setIsTokenConfigured(next.trim().length > 0);
             }}
          />
        </div>
      )}

      {queue.length > 0 && (
        <div className="space-y-4">
           <div className="flex items-center justify-between">
              <div>
                 <h2 className="text-lg font-medium text-white">确认上传这些文件?</h2>
                 <p className="text-sm text-zinc-400">共选择 {queue.length} 项，预计占用 {(totalBytes / 1024 / 1024).toFixed(1)} MB。</p>
              </div>
              <Button
                onClick={() => {
                  void handleSubmitAll();
                }}
                disabled={!canSubmit}
                className="h-9 rounded-md bg-sky-500 px-6 text-sm font-medium text-white hover:bg-sky-400 disabled:bg-sky-500/40"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin motion-reduce:animate-none" />
                    上传中...
                  </>
                ) : (
                  "开始上传"
                )}
              </Button>
           </div>
           
           {/* Progress bar if needed, or just the list */}
           {/* We can reuse UploadQueuePanel but maybe simplify it? The user showed a list. */}
           {/* The user image shows a list of files with progress. UploadQueuePanel does exactly that. */}
           
           <UploadQueuePanel
              queue={queue}
              totalBytes={totalBytes}
              failedCount={parseFailedCount + uploadFailedCount}
              workerCount={isSubmitting ? SUBMIT_WORKERS : parseWorkerCount}
              activeWorkers={parseActiveCount + uploadActiveCount}
              onRemoveItem={removeItem}
              onRetryItem={retryItem}
              onEditItem={() => {}}
              isEditEnabled={false}
            />
        </div>
      )}

      {/* Hide the dropzone completely if queue has items, OR keep it small? 
          The user image shows ONLY the list when items are present. 
          When empty, it shows nothing? No, the user said "After selecting images, show this modal".
          So if queue is empty, we probably shouldn't even show this modal content?
          But the parent modal controls visibility.
      */}
      {queue.length === 0 && (
         <div className="flex h-40 flex-col items-center justify-center text-zinc-500">
            <Loader2 className="animate-spin mb-2" />
            <p>等待文件选择...</p>
         </div>
      )}

    </div>
  );
};

export default UploadWorkspace;
