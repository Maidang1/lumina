import React from "react";
import { Cloud, CloudOff, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadProgress } from "@/types/layout";

interface StatusBarProps {
  isRepoReady: boolean;
  isSyncing?: boolean;
  uploadProgress: UploadProgress | null;
}

function formatSpeed(speedBps?: number): string {
  if (!speedBps || speedBps <= 0) return "";
  const units = ["B/s", "KB/s", "MB/s"];
  let value = speedBps;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function formatEta(etaSeconds?: number | null): string {
  if (!etaSeconds || etaSeconds <= 0) return "";
  const minutes = Math.floor(etaSeconds / 60);
  const seconds = Math.floor(etaSeconds % 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function StatusBar({
  isRepoReady,
  isSyncing = false,
  uploadProgress,
}: StatusBarProps): React.ReactElement {
  const hasActiveUpload = uploadProgress && uploadProgress.completed < uploadProgress.total;
  const uploadPercent = uploadProgress
    ? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
    : 0;

  return (
    <footer className="flex h-8 items-center justify-between border-t border-[var(--lumina-border-subtle)] bg-[var(--lumina-surface)]/88 px-3 text-[11px] text-[var(--lumina-muted)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--lumina-border-subtle)] px-2 py-1">
          {isRepoReady ? (
            <>
              <Cloud size={12} className="text-emerald-500" />
              <span className={cn(isSyncing && "animate-pulse")}>
                {isSyncing ? "Syncing..." : "Connected"}
              </span>
            </>
          ) : (
            <>
              <CloudOff size={12} className="text-amber-500" />
              <span>Not configured</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {uploadProgress && (
          <div className="flex items-center gap-2">
            {hasActiveUpload ? (
              <>
                <Upload size={12} className="animate-pulse text-amber-400" />
                <span>
                  Uploading {uploadProgress.completed}/{uploadProgress.total}
                </span>
                <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--lumina-border)]">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
                {(uploadProgress.currentSpeed ?? 0) > 0 && (
                  <span className="opacity-60">
                    {formatSpeed(uploadProgress.currentSpeed)}
                  </span>
                )}
                {uploadProgress.eta && (
                  <span className="opacity-60">
                    ETA {formatEta(uploadProgress.eta)}
                  </span>
                )}
              </>
            ) : (
              <>
                {(uploadProgress.failed ?? 0) > 0 ? (
                  <>
                    <AlertCircle size={12} className="text-rose-400" />
                    <span>
                      Completed with {uploadProgress.failed ?? 0} error(s)
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={12} className="text-emerald-400" />
                    <span>Upload complete ({uploadProgress.completed})</span>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
