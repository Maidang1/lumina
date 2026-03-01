import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Eye, Gauge, Image as ImageIcon, X } from "lucide-react";
import { UploadQueueItem } from "@/types/photo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "motion/react";

interface UploadQueuePanelProps {
  queue: UploadQueueItem[];
  totalBytes: number;
  failedCount: number;
  workerCount: number;
  activeWorkers: number;
  onRemoveItem: (id: string) => void;
  onRetryItem: (id: string) => void;
  onEditItem?: (id: string) => void;
  isEditEnabled?: boolean;
  onUpdateCategory?: (id: string, category: string, save?: boolean) => void;
  onUpdateDescription?: (
    id: string,
    description: string,
    save?: boolean,
  ) => void;
}

interface UploadRuntimeMetric {
  speedBps: number;
  etaSeconds?: number;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatSpeed(speedBps?: number): string {
  if (!speedBps || speedBps <= 0) return "--";
  return `${formatBytes(speedBps)}/s`;
}

function formatEta(etaSeconds?: number): string {
  if (!etaSeconds || !Number.isFinite(etaSeconds) || etaSeconds <= 0) {
    return "--";
  }
  const total = Math.ceil(etaSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes > 99) {
    return ">99m";
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getItemBytes(item: UploadQueueItem): number {
  return item.sourceSize ?? item.file.size;
}

function getItemName(item: UploadQueueItem): string {
  return item.sourceName ?? item.file.name;
}

function canPreviewItem(item: UploadQueueItem): boolean {
  return Boolean(
    item.metadata &&
    (item.status === "parsed" ||
      item.status === "ready_to_upload" ||
      item.status === "uploading" ||
      item.status === "upload_completed" ||
      item.status === "completed"),
  );
}

function formatElapsedMs(elapsedMs?: number): string {
  if (!elapsedMs || elapsedMs <= 0) return "0.0s";
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function getPrimaryError(item: UploadQueueItem): string {
  return item.uploadError || item.parseError || item.error || "Unknown error";
}

function getErrorDetailLines(item: UploadQueueItem): string[] {
  const details: string[] = [];
  const seenMessages = new Set<string>();
  const pushIfUnique = (label: string, message?: string): void => {
    const normalized = (message || "").trim();
    if (!normalized || seenMessages.has(normalized)) {
      return;
    }
    seenMessages.add(normalized);
    details.push(`${label}: ${normalized}`);
  };

  pushIfUnique("Parse", item.parseError);
  pushIfUnique("Upload", item.uploadError);
  pushIfUnique("Error", item.error);

  item.stages.forEach((stage) => {
    const stageError = (stage.error || "").trim();
    if (stageError && !seenMessages.has(stageError)) {
      seenMessages.add(stageError);
      details.push(`Stage[${stage.name}]: ${stageError}`);
    }
  });

  const unique = Array.from(
    new Set(details.map((line) => line.trim()).filter(Boolean)),
  );
  return unique.length > 0 ? unique : ["Unknown error"];
}

function getErrorHint(item: UploadQueueItem): string | null {
  const joined = [
    item.parseError || "",
    item.uploadError || "",
    item.error || "",
    ...item.stages.map((stage) => stage.error || ""),
  ]
    .join(" | ")
    .toLowerCase();

  if (
    joined.includes("unsupported/invalid image format") &&
    (joined.includes("image/heic") || joined.includes("image/heif"))
  ) {
    return "当前解析器不支持 HEIC/HEIF。请先转换为 JPG/PNG 后再上传。";
  }
  return null;
}

const UploadQueuePanel: React.FC<UploadQueuePanelProps> = ({
  queue,
  totalBytes,
  failedCount,
  workerCount,
  activeWorkers,
  onRemoveItem,
  onUpdateCategory,
  onUpdateDescription,
}) => {
  const previousRef = useRef<
    Map<
      string,
      {
        progress: number;
        bytesUploaded: number;
        timestamp: number;
        speedBps: number;
      }
    >
  >(new Map());
  const [metrics, setMetrics] = useState<Record<string, UploadRuntimeMetric>>(
    {},
  );
  const [overall, setOverall] = useState<UploadRuntimeMetric>({ speedBps: 0 });
  const [hoverPreviewItemId, setHoverPreviewItemId] = useState<string | null>(
    null,
  );
  const [hoverErrorItemId, setHoverErrorItemId] = useState<string | null>(null);
  const [hoverFailedReason, setHoverFailedReason] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const now = Date.now();
    const nextPrev = new Map(previousRef.current);
    const nextMetrics: Record<string, UploadRuntimeMetric> = {};
    let totalUploaded = 0;
    let totalRemaining = 0;
    let weightedSpeed = 0;

    const visibleIds = new Set(queue.map((item) => item.id));
    Array.from(nextPrev.keys()).forEach((id) => {
      if (!visibleIds.has(id)) {
        nextPrev.delete(id);
      }
    });

    queue.forEach((item) => {
      const itemBytes = getItemBytes(item);
      const progress = Math.min(100, Math.max(0, item.progress || 0));
      const bytesUploaded = (itemBytes * progress) / 100;
      const isUploading = item.status === "uploading";
      totalUploaded += bytesUploaded;
      totalRemaining += Math.max(0, itemBytes - bytesUploaded);

      const prev = nextPrev.get(item.id);
      if (!prev) {
        nextPrev.set(item.id, {
          progress,
          bytesUploaded,
          timestamp: now,
          speedBps: 0,
        });
        return;
      }

      const dt = Math.max(0.001, (now - prev.timestamp) / 1000);
      const deltaBytes = Math.max(0, bytesUploaded - prev.bytesUploaded);
      const instantSpeed = deltaBytes / dt;
      const smoothSpeed =
        instantSpeed > 0
          ? prev.speedBps * 0.6 + instantSpeed * 0.4
          : prev.speedBps * 0.85;

      nextPrev.set(item.id, {
        progress,
        bytesUploaded,
        timestamp: now,
        speedBps: smoothSpeed,
      });

      if (!isUploading) {
        return;
      }

      const remaining = Math.max(0, itemBytes - bytesUploaded);
      const eta = smoothSpeed > 0 ? remaining / smoothSpeed : undefined;
      nextMetrics[item.id] = {
        speedBps: smoothSpeed,
        etaSeconds: eta,
      };
      weightedSpeed += smoothSpeed;
    });

    previousRef.current = nextPrev;
    setMetrics(nextMetrics);

    const overallSpeed = weightedSpeed;
    setOverall({
      speedBps: overallSpeed,
      etaSeconds: overallSpeed > 0 ? totalRemaining / overallSpeed : undefined,
    });
  }, [queue]);

  const failedReasonStats = useMemo(() => {
    const map = new Map<string, { count: number; samples: string[] }>();
    queue
      .filter(
        (item) =>
          item.status === "failed" ||
          item.status === "parse_failed" ||
          item.status === "upload_failed",
      )
      .forEach((item) => {
        const reason = getPrimaryError(item).trim();
        const existing = map.get(reason);
        const sample = `${getItemName(item)}: ${getErrorDetailLines(item).join(" | ")}`;
        if (existing) {
          existing.count += 1;
          if (
            existing.samples.length < 3 &&
            !existing.samples.includes(sample)
          ) {
            existing.samples.push(sample);
          }
        } else {
          map.set(reason, { count: 1, samples: [sample] });
        }
      });
    return Array.from(map.entries())
      .map(([reason, payload]) => ({
        reason,
        count: payload.count,
        samples: payload.samples,
      }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
  }, [queue]);

  useEffect(() => {
    if (!hoverPreviewItemId) {
      return;
    }
    const exists = queue.some(
      (item) => item.id === hoverPreviewItemId && canPreviewItem(item),
    );
    if (!exists) {
      setHoverPreviewItemId(null);
    }
  }, [hoverPreviewItemId, queue]);

  if (queue.length === 0) {
    return null;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[var(--lumina-border-subtle)] bg-[var(--lumina-surface)]/30 shadow-xl backdrop-blur-xl"
    >
      <div className="border-b border-[var(--lumina-border-subtle)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted-foreground)]">
          <span>Queue {queue.length}</span>
          <span>
            Workers {activeWorkers}/{workerCount}
          </span>
          <span>Total {formatBytes(totalBytes)}</span>
          <span className="inline-flex items-center gap-1">
            <Gauge size={12} />
            {formatSpeed(overall.speedBps)}
          </span>
          <span>ETA {formatEta(overall.etaSeconds)}</span>
        </div>
      </div>

      {failedCount > 0 && failedReasonStats.length > 0 && (
        <div className="border-b border-rose-500/20 bg-rose-500/10 px-4 py-3">
          <div className="mb-2 inline-flex items-center gap-2 text-xs text-rose-300">
            <AlertTriangle size={12} />
            {failedCount} failure(s)
          </div>
          <div className="space-y-1">
            {failedReasonStats.slice(0, 4).map((entry) => (
              <div
                key={entry.reason}
                className="relative flex items-start justify-between gap-3 text-xs text-rose-200/90"
                onMouseEnter={() => setHoverFailedReason(entry.reason)}
                onMouseLeave={() =>
                  setHoverFailedReason((current) =>
                    current === entry.reason ? null : current,
                  )
                }
              >
                <span className="truncate" title={entry.reason}>
                  {entry.reason}
                </span>
                <span className="shrink-0 text-rose-300">x{entry.count}</span>
                {hoverFailedReason === entry.reason &&
                  entry.samples.length > 0 && (
                    <div className="absolute right-0 top-full z-30 mt-2 w-[520px] max-w-[85vw] rounded-lg border border-rose-400/30 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md">
                      <p className="mb-2 text-xs font-medium text-rose-200">
                        错误详情样例
                      </p>
                      <div className="space-y-1.5 text-[11px] text-rose-100/90">
                        {entry.samples.map((sample) => (
                          <p key={sample} className="break-words leading-4">
                            {sample}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-[var(--lumina-border-subtle)]">
        <AnimatePresence initial={false}>
        {queue.map((item) => {
          const isProcessing =
            item.status === "processing" || item.status === "parsing";
          const isUploading = item.status === "uploading";
          const isCompleted =
            item.status === "completed" || item.status === "upload_completed";
          const isFailed =
            item.status === "failed" ||
            item.status === "parse_failed" ||
            item.status === "upload_failed";

          let statusText = "Pending";
          if (isProcessing) statusText = "Parsing...";
          if (isUploading) statusText = "Uploading...";
          if (isCompleted) statusText = "Completed";
          if (isFailed) statusText = "Failed";

          const showInput =
            (isCompleted ||
              item.status === "parsed" ||
              item.status === "ready_to_upload") &&
            onUpdateCategory;

          const runtimeMetric = metrics[item.id];
          const activeParsingStage = item.stages.find(
            (stage) => stage.status === "processing",
          );
          const latestCompletedStage =
            [...item.stages]
              .reverse()
              .find((stage) => stage.status === "completed") ?? null;
          const parsingStageName =
            activeParsingStage?.name || latestCompletedStage?.name;
          const parsingElapsedMs = activeParsingStage?.started_at
            ? Date.now() - activeParsingStage.started_at
            : undefined;

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.98, maxHeight: 0 }}
              animate={{ opacity: 1, scale: 1, maxHeight: 120 }}
              exit={{ opacity: 0, scale: 0.95, maxHeight: 0, margin: 0, padding: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="group flex items-center justify-between gap-4 p-4 hover:bg-[var(--lumina-surface-elevated)]/50"
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-white/5">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon
                        size={16}
                        className="text-[var(--foreground)]/20"
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium text-[var(--foreground)]"
                    title={getItemName(item)}
                  >
                    {getItemName(item)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {(getItemBytes(item) / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex w-72 flex-col items-end gap-1.5">
                  {showInput ? (
                    <div className="flex w-full gap-2">
                      <Input
                        type="text"
                        placeholder="Description..."
                        className="h-7 w-full flex-1 border-[var(--border)] bg-white/[0.04] px-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-[var(--ring)]"
                        defaultValue={
                          item.editDraft?.description ??
                          item.metadata?.description ??
                          ""
                        }
                        onBlur={(e) =>
                          onUpdateDescription?.(item.id, e.target.value, true)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Input
                        type="text"
                        placeholder="Category..."
                        className="h-7 w-20 border-[var(--border)] bg-white/[0.04] px-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-[var(--ring)]"
                        defaultValue={
                          item.editDraft?.category ??
                          item.metadata?.category ??
                          ""
                        }
                        onBlur={(e) =>
                          onUpdateCategory?.(item.id, e.target.value, true)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "text-xs",
                          isCompleted
                            ? "text-emerald-500"
                            : isFailed
                              ? "text-red-500"
                              : "text-[var(--muted-foreground)]",
                        )}
                      >
                        {statusText}
                      </span>
                      {(isProcessing || isUploading) && (
                        <Progress
                          value={item.progress}
                          className="h-1 w-28 bg-white/10"
                        />
                      )}
                      {isProcessing && (
                        <span className="text-[11px] text-zinc-500">
                          {parsingStageName
                            ? `阶段: ${parsingStageName}`
                            : "正在解析图像..."}{" "}
                          · 已耗时 {formatElapsedMs(parsingElapsedMs)}
                        </span>
                      )}
                      {isUploading && (
                        <span className="text-[11px] text-zinc-500">
                          {formatSpeed(runtimeMetric?.speedBps)} · ETA{" "}
                          {formatEta(runtimeMetric?.etaSeconds)}
                        </span>
                      )}
                      {isFailed && (
                        <div
                          className="relative max-w-72"
                          onMouseEnter={() => setHoverErrorItemId(item.id)}
                          onMouseLeave={() =>
                            setHoverErrorItemId((current) =>
                              current === item.id ? null : current,
                            )
                          }
                        >
                          <span
                            className="block truncate text-[11px] text-rose-300/90"
                            title={getPrimaryError(item)}
                          >
                            {getPrimaryError(item)}
                          </span>
                          {hoverErrorItemId === item.id && (
                            <div className="absolute right-0 top-full z-30 mt-2 w-[520px] max-w-[85vw] rounded-lg border border-rose-400/30 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md">
                              <p className="mb-1 text-xs font-medium text-rose-200">
                                错误详情
                              </p>
                              <p className="mb-2 text-[11px] text-zinc-400">
                                {getItemName(item)}
                              </p>
                              <div className="space-y-1.5 text-[11px] text-rose-100/90">
                                {getErrorDetailLines(item).map((line) => (
                                  <p
                                    key={line}
                                    className="break-words leading-4"
                                  >
                                    {line}
                                  </p>
                                ))}
                              </div>
                              {getErrorHint(item) && (
                                <p className="mt-3 text-[11px] text-amber-300/90">
                                  建议: {getErrorHint(item)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {canPreviewItem(item) && (
                    <div
                      className="relative"
                      onMouseEnter={() => setHoverPreviewItemId(item.id)}
                      onMouseLeave={() =>
                        setHoverPreviewItemId((current) =>
                          current === item.id ? null : current,
                        )
                      }
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onFocus={() => setHoverPreviewItemId(item.id)}
                        onBlur={() =>
                          setHoverPreviewItemId((current) =>
                            current === item.id ? null : current,
                          )
                        }
                        className={cn(
                          "h-7 px-2 text-[11px] text-[var(--muted-foreground)] hover:bg-white/10 hover:text-zinc-200",
                          hoverPreviewItemId === item.id && "text-sky-300",
                        )}
                      >
                        <Eye size={13} className="mr-1" />
                        解析预览
                      </Button>
                      {hoverPreviewItemId === item.id && item.metadata && (
                        <div className="absolute right-0 top-full z-30 mt-2 w-[520px] max-w-[90vw] rounded-lg border border-white/12 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md">
                          <div className="mb-2">
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              解析预览
                            </p>
                            <p
                              className="text-xs text-[var(--muted-foreground)]"
                              title={getItemName(item)}
                            >
                              {getItemName(item)}
                            </p>
                          </div>
                          <div className="grid gap-3 md:grid-cols-[100px_1fr]">
                            <div className="h-[75px] w-[100px] overflow-hidden rounded-md border border-[var(--border)] bg-white/[0.04]">
                              {item.thumbnail ? (
                                <img
                                  src={item.thumbnail}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-zinc-500">
                                  <ImageIcon size={16} />
                                </div>
                              )}
                            </div>
                            <div className="grid gap-x-3 gap-y-1 text-[11px] text-zinc-300 sm:grid-cols-2">
                              <span>
                                尺寸: {item.metadata.derived?.dimensions?.width}{" "}
                                x {item.metadata.derived?.dimensions?.height}
                              </span>
                              <span>
                                MIME:{" "}
                                {item.metadata.files?.original?.mime ||
                                  "unknown"}
                              </span>
                              <span>
                                主色:{" "}
                                {item.metadata.derived?.dominant_color?.hex ||
                                  "-"}
                              </span>
                              <span>
                                模糊分:{" "}
                                {typeof item.metadata.derived?.blur?.score ===
                                "number"
                                  ? item.metadata.derived.blur.score.toFixed(2)
                                  : "-"}
                              </span>
                              <span>
                                是否模糊:{" "}
                                {item.metadata.derived?.blur?.is_blurry
                                  ? "是"
                                  : "否"}
                              </span>
                              <span>
                                pHash:{" "}
                                {item.metadata.derived?.phash?.value || "-"}
                              </span>
                              <span>
                                相机: {item.metadata.exif?.Model || "-"}
                              </span>
                              <span>
                                镜头: {item.metadata.exif?.LensModel || "-"}
                              </span>
                              <span>ISO: {item.metadata.exif?.ISO || "-"}</span>
                              <span>
                                省份:{" "}
                                {item.metadata.geo?.region?.province || "-"}
                              </span>
                              <span>
                                拍摄时间:{" "}
                                {item.metadata.exif?.DateTimeOriginal || "-"}
                              </span>
                              <span>
                                OCR: {item.metadata.derived?.ocr?.status || "-"}
                              </span>
                              <span>
                                总耗时:{" "}
                                {item.metadata.processing?.summary?.total_ms ??
                                  0}{" "}
                                ms
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => onRemoveItem(item.id)}
                    className="h-6 w-6 rounded-full p-1 text-zinc-600 opacity-0 transition-all hover:bg-white/10 hover:text-zinc-300 group-hover:opacity-100"
                  >
                    <X size={16} />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default UploadQueuePanel;
