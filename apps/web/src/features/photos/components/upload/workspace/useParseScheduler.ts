import { MutableRefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { UploadQueueItem } from "@/features/photos/types";
import { parseUploadItem } from "@/features/photos/components/upload/processUploadItem";

interface UseParseSchedulerParams {
  queue: UploadQueueItem[];
  isTokenConfigured: boolean;
  updateItemById: (id: string, updates: Partial<UploadQueueItem>) => void;
  updateStageById: (
    id: string,
    stageId: string,
    updates: Partial<UploadQueueItem["stages"][number]>
  ) => void;
  thumbBlobRef: MutableRefObject<Map<string, Blob>>;
}

interface UseParseSchedulerResult {
  parseWorkerCount: number;
}

export const useParseScheduler = ({
  queue,
  isTokenConfigured,
  updateItemById,
  updateStageById,
  thumbBlobRef,
}: UseParseSchedulerParams): UseParseSchedulerResult => {
  const inFlightParseRef = useRef<Set<string>>(new Set());

  const parseWorkerCount = useMemo(() => {
    const hardware =
      typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;
    return Math.min(4, Math.max(2, Math.floor(hardware / 2)));
  }, []);

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
          parseError: error instanceof Error ? error.message : "Parse failed",
          error: error instanceof Error ? error.message : "Parse failed",
        });
      } finally {
        inFlightParseRef.current.delete(item.id);
      }
    },
    [thumbBlobRef, updateItemById, updateStageById]
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

  return {
    parseWorkerCount,
  };
};
