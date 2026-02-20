import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, HardDriveUpload, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Separator } from "@/shared/ui/separator";
import {
  DEFAULT_UPLOAD_CONFIG,
  UploadQueueItem,
} from "@/features/photos/types";
import { uploadService } from "@/features/photos/services/uploadService";
import UploadDropzone from "@/features/photos/components/upload/UploadDropzone";
import UploadQueuePanel from "@/features/photos/components/upload/UploadQueuePanel";
import UploadSettingsPopover from "@/features/photos/components/upload/UploadSettingsPopover";
import { MAX_LIVE_VIDEO_SIZE, createInitialStages } from "@/features/photos/components/upload/constants";
import { parseUploadItem, submitUploadItem } from "@/features/photos/components/upload/processUploadItem";

const SUBMIT_WORKERS = 3;

const makeQueueId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const UploadPage: React.FC = () => {
  const navigate = useNavigate();

  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [uploadMode, setUploadMode] = useState<"static" | "live_photo">("static");
  const [pendingLiveStill, setPendingLiveStill] = useState<File | null>(null);
  const [pendingLiveVideo, setPendingLiveVideo] = useState<File | null>(null);
  const [uploadToken, setUploadToken] = useState<string>("");
  const [tokenError, setTokenError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveStillInputRef = useRef<HTMLInputElement>(null);
  const liveVideoInputRef = useRef<HTMLInputElement>(null);
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
        status: "queued_parse",
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
        
        // 尝试查找同名的 .mov 文件（自动关联）
        const movFileName = selected.name.replace(/\.[^/.]+$/, "") + ".mov";
        
        // 创建一个新的 file input 来尝试选择关联的 MOV 文件
        // 由于安全限制，无法自动选择文件，但我们可以提示用户
        if (!pendingLiveVideo) {
          // 显示提示，让用户选择对应的视频文件
          setTokenError(`已选择主图: ${selected.name}，请继续选择对应的 MOV 视频文件`);
        } else {
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

  const openEditPanel = useCallback((id: string) => {
    setEditingItemId(id);
    setShowEditPanel(true);
  }, []);

  const closeEditPanel = useCallback(() => {
    setShowEditPanel(false);
    setEditingItemId(null);
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

  const uploadCompletedCount = queue.filter(
    (item) => item.status === "upload_completed"
  ).length;
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

  const doSubmitItem = useCallback(async (item: UploadQueueItem): Promise<void> => {
    const thumbBlob = thumbBlobRef.current.get(item.id);
    if (!item.metadata || !thumbBlob) {
      updateItemById(item.id, {
        status: "upload_failed",
        uploadError: "缺少解析结果，无法上传",
      });
      return;
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
    } catch (error) {
      updateItemById(item.id, {
        status: "upload_failed",
        uploadError: error instanceof Error ? error.message : "上传失败",
        error: error instanceof Error ? error.message : "上传失败",
      });
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

    let nextIndex = 0;
    const workerTotal = Math.min(SUBMIT_WORKERS, candidates.length);
    const workers = Array.from({ length: workerTotal }, async () => {
      while (nextIndex < candidates.length) {
        const current = candidates[nextIndex];
        nextIndex += 1;
        if (!current) {
          return;
        }
        await doSubmitItem(current);
      }
    });

    await Promise.all(workers);
    setIsSubmitting(false);
  }, [doSubmitItem, queue]);

  const canSubmit = isParseDone && parsedCount > 0 && !isSubmitting;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080808]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-[1720px] items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="rounded-xl border-0 bg-transparent px-3 text-gray-200 hover:bg-white/[0.06]"
            >
              <ArrowLeft size={16} className="mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-lg font-medium text-white">上传照片</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-4 text-sm text-gray-400 md:flex">
              <span>准备: <span className="text-white">{parsedCount}/{queue.length}</span></span>
              {uploadCompletedCount > 0 && (
                <span>成功: <span className="text-emerald-400">{uploadCompletedCount}</span></span>
              )}
              {uploadFailedCount > 0 && (
                <span>失败: <span className="text-red-400">{uploadFailedCount}</span></span>
              )}
            </div>
            <UploadSettingsPopover
              uploadToken={uploadToken}
              tokenError={tokenError}
              isTokenConfigured={isTokenConfigured}
              panelTitle="配置"
              iconSize={16}
              buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-gray-400 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              onChangeToken={(next) => {
                setUploadToken(next);
                uploadService.setUploadToken(next);
                setIsTokenConfigured(next.trim().length > 0);
                if (tokenError) {
                  setTokenError("");
                }
              }}
            />
            <Button
              onClick={() => {
                void handleSubmitAll();
              }}
              disabled={!canSubmit}
              className="h-9 rounded-xl bg-emerald-500 px-5 text-sm font-medium text-white hover:bg-emerald-400 disabled:bg-emerald-500/40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin motion-reduce:animate-none" />
                  上传中...
                </>
              ) : (
                `提交 ${parsedCount} 张`
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1720px] space-y-8 px-8 py-8">
        {!isTokenConfigured && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200/80">
            请先点击右上角设置图标配置访问令牌，否则无法上传。
          </div>
        )}

        <div className="space-y-6">
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

          {queue.length === 0 ? (
            <div className="rounded-xl bg-[#0a0a0a]/30 p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <HardDriveUpload size={32} className="text-white/20" />
              </div>
              <p className="text-base font-medium text-white">上传队列是空的</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
                使用上方的上传区域添加照片，支持静态图片和 iOS 实况照片
              </p>
            </div>
          ) : (
            <UploadQueuePanel
              queue={queue}
              totalBytes={totalBytes}
              failedCount={parseFailedCount + uploadFailedCount}
              workerCount={isSubmitting ? SUBMIT_WORKERS : parseWorkerCount}
              activeWorkers={parseActiveCount + uploadActiveCount}
              onRemoveItem={removeItem}
              onRetryItem={retryItem}
              onEditItem={openEditPanel}
              isEditEnabled={isParseDone}
            />
          )}
        </div>

        {isParseDone && queue.length > 0 && (
          <div className="col-span-full">
            <Card className="border border-white/10 bg-[#101010]">
            <CardContent className="space-y-4 p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-white">预览与编辑</h2>
                  <p className="text-xs text-gray-400">全部解析结束后可编辑描述与文件名，完成后再提交上传</p>
                </div>
                <Badge className="rounded-full border border-[#c9a962]/40 bg-[#c9a962]/10 text-[#d4b97f]">
                  可提交 {parsedCount} 张
                </Badge>
              </div>

              <Separator className="bg-white/10" />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {queue.map((item) => {
                  if (item.status !== "parsed" && item.status !== "ready_to_upload" && item.status !== "uploading" && item.status !== "upload_completed" && item.status !== "upload_failed") {
                    return null;
                  }

                  return (
                    <div key={item.id} className="group relative flex flex-col rounded-xl border border-white/10 bg-[#0a0a0a] p-4 transition-all hover:border-white/20 hover:bg-[#121212]">
                      <div className="mb-4 flex items-start gap-4">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-white/10" />
                        ) : (
                          <div className="h-20 w-20 rounded-lg bg-white/5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-white" title={item.file.name}>{item.file.name}</p>
                            {item.uploadMode === "live_photo" && (
                              <Badge variant="outline" className="h-4 border-yellow-500/50 bg-yellow-500/10 px-1 text-[9px] text-yellow-500">
                                LIVE
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {item.metadata?.geo?.region?.display_name || "未解析区域"}
                          </p>
                          {item.uploadError && (
                            <p className="mt-1 text-xs text-red-400">{item.uploadError}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-gray-400">文件名</label>
                          <Input
                            className="h-9 border-white/10 bg-black/20 text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                            value={item.editDraft?.original_filename ?? item.metadata?.original_filename ?? item.file.name}
                            onChange={(event) =>
                              handleDraftChange(item.id, "original_filename", event.target.value)
                            }
                            disabled={isSubmitting || item.status === "uploading" || item.status === "upload_completed"}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-gray-400">描述</label>
                          <Textarea
                            value={item.editDraft?.description ?? item.metadata?.description ?? ""}
                            onChange={(event) => handleDraftChange(item.id, "description", event.target.value)}
                            className="min-h-[80px] resize-none border-white/10 bg-black/20 text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                            disabled={isSubmitting || item.status === "uploading" || item.status === "upload_completed"}
                            placeholder="添加照片描述..."
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          </div>
        )}

      </main>
    </div>
  );
};

export default UploadPage;
