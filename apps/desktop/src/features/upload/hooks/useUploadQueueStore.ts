import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_UPLOAD_CONFIG,
  UploadQueueItem,
} from "@/types/photo";
import { createInitialStages } from "@/features/upload/lib/constants";
import { UploadQueueStats } from "@/features/upload/types";

const makeQueueId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface ParsedPaths {
  originalPath: string;
  thumbPath: string;
  thumbVariantPaths?: Partial<Record<"400" | "800" | "1600", string>>;
}

interface UseUploadQueueStoreResult {
  queue: UploadQueueItem[];
  queueRef: MutableRefObject<UploadQueueItem[]>;
  parsedPathsRef: MutableRefObject<Map<string, ParsedPaths>>;
  updateItemById: (id: string, updates: Partial<UploadQueueItem>) => void;
  updateStageById: (
    id: string,
    stageId: string,
    updates: Partial<UploadQueueItem["stages"][number]>,
  ) => void;
  enqueuePathFiles: (
    files: Array<{
      path: string;
      name: string;
      size: number;
      modified: number;
      mime?: string;
    }>,
  ) => void;
  removeItem: (id: string) => void;
  retryItem: (id: string) => void;
  applyDraftField: (
    id: string,
    field: "description" | "original_filename" | "category",
    value: string,
  ) => void;
  clearResources: () => void;
  stats: UploadQueueStats;
}

export const useUploadQueueStore = (): UseUploadQueueStoreResult => {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const queueRef = useRef<UploadQueueItem[]>([]);
  const parsedPathsRef = useRef<Map<string, ParsedPaths>>(new Map());

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const updateItemById = useCallback(
    (id: string, updates: Partial<UploadQueueItem>) => {
      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  const updateStageById = useCallback(
    (
      id: string,
      stageId: string,
      updates: Partial<UploadQueueItem["stages"][number]>,
    ) => {
      setQueue((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            stages: item.stages.map((stage) =>
              stage.id === stageId ? { ...stage, ...updates } : stage,
            ),
          };
        }),
      );
    },
    [],
  );

  const enqueuePathFiles = useCallback(
    (
      files: Array<{
        path: string;
        name: string;
        size: number;
        modified: number;
        mime?: string;
      }>,
    ) => {
      const allowedExts = new Set([
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "avif",
        "heic",
        "heif",
        "bmp",
        "tif",
        "tiff",
      ]);

      const accepted = files.filter((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const hasAllowedExt = allowedExts.has(ext);
        return hasAllowedExt && file.size <= DEFAULT_UPLOAD_CONFIG.maxFileSize;
      });

      const newItems: UploadQueueItem[] = accepted.map((file) => ({
        id: makeQueueId(),
        file: new File([], file.name, {
          type: file.mime || "application/octet-stream",
          lastModified: file.modified * 1000,
        }),
        sourcePath: file.path,
        sourceName: file.name,
        sourceSize: file.size,
        sourceMime: file.mime,
        status: "queued_parse",
        progress: 0,
        stages: createInitialStages(),
      }));

      setQueue((prev) => [...prev, ...newItems]);
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item?.thumbnail) {
        URL.revokeObjectURL(item.thumbnail);
      }
      parsedPathsRef.current.delete(id);
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
      }),
    );
    parsedPathsRef.current.delete(id);
  }, []);

  const applyDraftField = useCallback(
    (
      id: string,
      field: "description" | "original_filename" | "category",
      value: string,
    ) => {
      setQueue((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            editDraft: {
              description:
                item.editDraft?.description ?? item.metadata?.description ?? "",
              original_filename:
                item.editDraft?.original_filename ??
                item.metadata?.original_filename ??
                item.sourceName ??
                item.file.name,
              category:
                item.editDraft?.category ?? item.metadata?.category ?? "",
              [field]: value,
            },
          };
        }),
      );
    },
    [],
  );

  const clearResources = useCallback(() => {
    queueRef.current.forEach((item) => {
      if (item.thumbnail) {
        URL.revokeObjectURL(item.thumbnail);
      }
    });
    parsedPathsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      clearResources();
    };
  }, [clearResources]);

  const stats = useMemo<UploadQueueStats>(() => {
    const parsedCount = queue.filter(
      (item) => item.status === "parsed" || item.status === "ready_to_upload",
    ).length;
    const parseFailedCount = queue.filter(
      (item) => item.status === "parse_failed",
    ).length;
    const parseActiveCount = queue.filter(
      (item) => item.status === "parsing",
    ).length;
    const uploadActiveCount = queue.filter(
      (item) => item.status === "uploading",
    ).length;
    const uploadCompletedCount = queue.filter(
      (item) => item.status === "upload_completed",
    ).length;
    const uploadFailedCount = queue.filter(
      (item) => item.status === "upload_failed",
    ).length;
    const totalBytes = queue.reduce(
      (sum, item) => sum + (item.sourceSize ?? item.file.size),
      0,
    );
    const isParseDone =
      queue.length > 0 &&
      queue.every(
        (item) => item.status !== "queued_parse" && item.status !== "parsing",
      );

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
    parsedPathsRef,
    updateItemById,
    updateStageById,
    enqueuePathFiles,
    removeItem,
    retryItem,
    applyDraftField,
    clearResources,
    stats,
  };
};
