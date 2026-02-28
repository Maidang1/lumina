import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { UploadParseProfile, UploadQueueItem } from "@/types/photo";
import { parseUploadItem } from "@/features/upload/lib/processUploadItem";

interface ParsedPaths {
  originalPath: string;
  thumbPath: string;
  thumbVariantPaths?: Partial<Record<"400" | "800" | "1600", string>>;
}

interface UseParseSchedulerParams {
  queue: UploadQueueItem[];
  isTokenConfigured: boolean;
  parseProfile: UploadParseProfile;
  updateItemById: (id: string, updates: Partial<UploadQueueItem>) => void;
  updateStageById: (
    id: string,
    stageId: string,
    updates: Partial<UploadQueueItem["stages"][number]>,
  ) => void;
  parsedPathsRef: MutableRefObject<Map<string, ParsedPaths>>;
}

interface UseParseSchedulerResult {
  parseWorkerCount: number;
}

function trimErrorMessage(message: string, maxLength = 1200): string {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Parse failed";
  }
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return trimErrorMessage(error);
  }
  if (error instanceof Error) {
    const chunks = [error.message];
    const withCause = error as Error & { cause?: unknown };
    if (withCause.cause) {
      chunks.push(extractErrorMessage(withCause.cause));
    }
    return trimErrorMessage(chunks.filter(Boolean).join(" | "));
  }
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      error?: unknown;
      reason?: unknown;
      details?: unknown;
    };
    const chunks = [
      candidate.message,
      candidate.error,
      candidate.reason,
      candidate.details,
    ]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
    if (chunks.length > 0) {
      return trimErrorMessage(chunks.join(" | "));
    }
    try {
      return trimErrorMessage(JSON.stringify(error));
    } catch {
      return "Parse failed";
    }
  }
  return "Parse failed";
}

const PARSE_HEARTBEAT_MS = 350;
const PARSE_STAGE_ORDER = [
  "format_validate",
  "decode",
  "exif",
  "normalize_original",
  "hash",
  "thumbnail",
  "region",
] as const;

export const useParseScheduler = ({
  queue,
  isTokenConfigured,
  parseProfile,
  updateItemById,
  updateStageById,
  parsedPathsRef,
}: UseParseSchedulerParams): UseParseSchedulerResult => {
  const inFlightParseRef = useRef<Set<string>>(new Set());
  const parseTimerRef = useRef<Map<string, number>>(new Map());
  const parseStartedAtRef = useRef<Map<string, number>>(new Map());

  const parseWorkerCount = useMemo(() => {
    if (parseProfile === "turbo") {
      return 2;
    }
    const hardware =
      typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;
    return Math.min(3, Math.max(2, Math.floor(hardware / 2)));
  }, [parseProfile]);

  const stopParseHeartbeat = useCallback((itemId: string) => {
    const timer = parseTimerRef.current.get(itemId);
    if (timer !== undefined) {
      window.clearInterval(timer);
      parseTimerRef.current.delete(itemId);
    }
    parseStartedAtRef.current.delete(itemId);
  }, []);

  const startParseHeartbeat = useCallback(
    (item: UploadQueueItem) => {
      stopParseHeartbeat(item.id);
      const startedAt = Date.now();
      parseStartedAtRef.current.set(item.id, startedAt);

      const timer = window.setInterval(() => {
        const startTs = parseStartedAtRef.current.get(item.id);
        if (!startTs || !inFlightParseRef.current.has(item.id)) {
          stopParseHeartbeat(item.id);
          return;
        }

        const elapsedSec = (Date.now() - startTs) / 1000;

        let progress = 5;
        let stageIndex = 0;
        if (elapsedSec < 0.8) {
          progress = 8 + elapsedSec * 10;
          stageIndex = 0;
        } else if (elapsedSec < 2.5) {
          progress = 16 + (elapsedSec - 0.8) * 10;
          stageIndex = 1;
        } else if (elapsedSec < 4.5) {
          progress = 35 + (elapsedSec - 2.5) * 8;
          stageIndex = 3;
        } else if (elapsedSec < 9) {
          progress = 51 + (elapsedSec - 4.5) * 7;
          stageIndex = 5;
        } else {
          progress = 82 + Math.min(13, (elapsedSec - 9) * 1.2);
          stageIndex = parseProfile === "turbo" ? 5 : 6;
        }

        const clampedProgress = Math.min(95, Math.max(5, Math.round(progress)));
        updateItemById(item.id, { progress: clampedProgress });

        PARSE_STAGE_ORDER.forEach((stageId, index) => {
          if (index < stageIndex) {
            updateStageById(item.id, stageId, {
              status: "completed",
              progress: 100,
            });
            return;
          }
          if (index === stageIndex) {
            updateStageById(item.id, stageId, {
              status: "processing",
              progress: Math.max(10, clampedProgress),
              started_at: startTs,
            });
            return;
          }
          updateStageById(item.id, stageId, {
            status: "pending",
            progress: 0,
          });
        });
      }, PARSE_HEARTBEAT_MS);

      parseTimerRef.current.set(item.id, timer);
    },
    [parseProfile, stopParseHeartbeat, updateItemById, updateStageById],
  );

  const parseFile = useCallback(
    async (item: UploadQueueItem, workerSlot: number) => {
      if (inFlightParseRef.current.has(item.id)) {
        return;
      }
      inFlightParseRef.current.add(item.id);
      startParseHeartbeat(item);

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
          updateStage: (stageId, updates) =>
            updateStageById(item.id, stageId, updates),
          parseProfile,
        });

        parsedPathsRef.current.set(item.id, {
          originalPath: parsed.originalPath,
          thumbPath: parsed.thumbPath,
          thumbVariantPaths: parsed.thumbVariantPaths,
        });
        updateItemById(item.id, {
          status: "parsed",
          progress: 100,
          parseError: undefined,
        });
      } catch (error) {
        const detail = extractErrorMessage(error);
        const parseHint = `file=${item.sourceName || item.file.name}, profile=${parseProfile}`;
        const parseError = trimErrorMessage(`${detail} | ${parseHint}`);
        updateItemById(item.id, {
          status: "parse_failed",
          parseError,
          error: parseError,
        });
      } finally {
        stopParseHeartbeat(item.id);
        inFlightParseRef.current.delete(item.id);
      }
    },
    [
      parsedPathsRef,
      parseProfile,
      startParseHeartbeat,
      stopParseHeartbeat,
      updateItemById,
      updateStageById,
    ],
  );

  useEffect(() => {
    return () => {
      Array.from(parseTimerRef.current.keys()).forEach((itemId) =>
        stopParseHeartbeat(itemId),
      );
    };
  }, [stopParseHeartbeat]);

  useEffect(() => {
    if (!isTokenConfigured) {
      return;
    }

    const activeCount = queue.filter(
      (item) => item.status === "parsing",
    ).length;
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
