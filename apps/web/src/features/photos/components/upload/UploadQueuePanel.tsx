import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Gauge, Image as ImageIcon, X } from "lucide-react";
import { UploadQueueItem } from "@/features/photos/types";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Progress } from "@/shared/ui/progress";

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
  onUpdateDescription?: (id: string, description: string, save?: boolean) => void;
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
  return item.file.size;
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
  const previousRef = useRef<Map<string, { progress: number; bytesUploaded: number; timestamp: number; speedBps: number }>>(
    new Map(),
  );
  const [metrics, setMetrics] = useState<Record<string, UploadRuntimeMetric>>({});
  const [overall, setOverall] = useState<UploadRuntimeMetric>({ speedBps: 0 });

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
        nextPrev.set(item.id, { progress, bytesUploaded, timestamp: now, speedBps: 0 });
        return;
      }

      const dt = Math.max(0.001, (now - prev.timestamp) / 1000);
      const deltaBytes = Math.max(0, bytesUploaded - prev.bytesUploaded);
      const instantSpeed = deltaBytes / dt;
      const smoothSpeed = instantSpeed > 0 ? prev.speedBps * 0.6 + instantSpeed * 0.4 : prev.speedBps * 0.85;

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
    const map = new Map<string, number>();
    queue
      .filter((item) =>
        item.status === "failed" ||
        item.status === "parse_failed" ||
        item.status === "upload_failed",
      )
      .forEach((item) => {
        const reason = (item.uploadError || item.parseError || item.error || "Unknown error").trim();
        map.set(reason, (map.get(reason) || 0) + 1);
      });
    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [queue]);

  if (queue.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a]">
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
          <span>
            Queue {queue.length}
          </span>
          <span>
            Workers {activeWorkers}/{workerCount}
          </span>
          <span>
            Total {formatBytes(totalBytes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Gauge size={12} />
            {formatSpeed(overall.speedBps)}
          </span>
          <span>
            ETA {formatEta(overall.etaSeconds)}
          </span>
        </div>
      </div>

      {failedCount > 0 && failedReasonStats.length > 0 && (
        <div className="border-b border-white/5 bg-rose-500/5 px-4 py-3">
          <div className="mb-2 inline-flex items-center gap-2 text-xs text-rose-300">
            <AlertTriangle size={12} />
            {failedCount} failure(s)
          </div>
          <div className="space-y-1">
            {failedReasonStats.slice(0, 4).map((entry) => (
              <div key={entry.reason} className="flex items-start justify-between gap-3 text-xs text-rose-200/90">
                <span className="truncate" title={entry.reason}>{entry.reason}</span>
                <span className="shrink-0 text-rose-300">x{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-white/5">
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

          return (
            <div
              key={item.id}
              className="group flex items-center justify-between gap-4 p-4 hover:bg-white/[0.02]"
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
                      <ImageIcon size={16} className="text-white/20" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium text-white"
                    title={item.file.name}
                  >
                    {item.file.name}
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
                        className="h-7 w-full flex-1 border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-zinc-600 focus-visible:ring-sky-500/50"
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
                        className="h-7 w-20 border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-zinc-600 focus-visible:ring-sky-500/50"
                        defaultValue={
                          item.editDraft?.category ?? item.metadata?.category ?? ""
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
                              : "text-zinc-400",
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
                      {isUploading && (
                        <span className="text-[11px] text-zinc-500">
                          {formatSpeed(runtimeMetric?.speedBps)} · ETA{" "}
                          {formatEta(runtimeMetric?.etaSeconds)}
                        </span>
                      )}
                      {isFailed && (
                        <span
                          className="max-w-72 truncate text-[11px] text-rose-300/90"
                          title={item.uploadError || item.parseError || item.error || "Unknown error"}
                        >
                          {item.uploadError || item.parseError || item.error || "Unknown error"}
                        </span>
                      )}
                    </>
                  )}
                </div>

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
          );
        })}
      </div>
    </div>
  );
};

export default UploadQueuePanel;
