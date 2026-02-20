import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_UPLOAD_CONFIG, UploadQueueItem } from "@/features/photos/types";
import { createInitialStages } from "@/features/photos/components/upload/constants";
import { UploadQueueStats } from "./types";

const makeQueueId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface UseUploadQueueStoreResult {
  queue: UploadQueueItem[];
  queueRef: MutableRefObject<UploadQueueItem[]>;
  thumbBlobRef: MutableRefObject<Map<string, Blob>>;
  updateItemById: (id: string, updates: Partial<UploadQueueItem>) => void;
  updateStageById: (
    id: string,
    stageId: string,
    updates: Partial<UploadQueueItem["stages"][number]>
  ) => void;
  enqueueStaticFiles: (files: FileList | File[]) => void;
  removeItem: (id: string) => void;
  retryItem: (id: string) => void;
  applyDraftField: (id: string, field: "description" | "original_filename" | "category", value: string) => void;
  clearResources: () => void;
  stats: UploadQueueStats;
}

export const useUploadQueueStore = (): UseUploadQueueStoreResult => {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const queueRef = useRef<UploadQueueItem[]>([]);
  const thumbBlobRef = useRef<Map<string, Blob>>(new Map());

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

  const removeItem = useCallback((id: string) => {
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

  const applyDraftField = useCallback(
    (
      id: string,
      field: "description" | "original_filename" | "category",
      value: string
    ) => {
      setQueue((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            editDraft: {
              description: item.editDraft?.description ?? item.metadata?.description ?? "",
              original_filename:
                item.editDraft?.original_filename ??
                item.metadata?.original_filename ??
                item.file.name,
              category: item.editDraft?.category ?? item.metadata?.category ?? "",
              [field]: value,
            },
          };
        })
      );
    },
    []
  );

  const clearResources = useCallback(() => {
    queueRef.current.forEach((item) => {
      if (item.thumbnail) {
        URL.revokeObjectURL(item.thumbnail);
      }
    });
    thumbBlobRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      clearResources();
    };
  }, [clearResources]);

  const stats = useMemo<UploadQueueStats>(() => {
    const parsedCount = queue.filter(
      (item) => item.status === "parsed" || item.status === "ready_to_upload"
    ).length;
    const parseFailedCount = queue.filter((item) => item.status === "parse_failed").length;
    const parseActiveCount = queue.filter((item) => item.status === "parsing").length;
    const uploadActiveCount = queue.filter((item) => item.status === "uploading").length;
    const uploadCompletedCount = queue.filter((item) => item.status === "upload_completed").length;
    const uploadFailedCount = queue.filter((item) => item.status === "upload_failed").length;
    const totalBytes = queue.reduce((sum, item) => sum + item.file.size + (item.liveVideoFile?.size || 0), 0);
    const isParseDone =
      queue.length > 0 && queue.every((item) => item.status !== "queued_parse" && item.status !== "parsing");

    return {
      parsedCount,
      parseFailedCount,
      parseActiveCount,
      uploadActiveCount,
      uploadCompletedCount,
      uploadFailedCount,
      totalBytes,
      isParseDone,
    };
  }, [queue]);

  return {
    queue,
    queueRef,
    thumbBlobRef,
    updateItemById,
    updateStageById,
    enqueueStaticFiles,
    removeItem,
    retryItem,
    applyDraftField,
    clearResources,
    stats,
  };
};
