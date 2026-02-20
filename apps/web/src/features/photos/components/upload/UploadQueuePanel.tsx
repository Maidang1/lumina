import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Image as ImageIcon, Loader2, RotateCcw, Settings2, Sparkles, X } from "lucide-react";
import { UploadQueueItem } from "@/features/photos/types";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Progress } from "@/shared/ui/progress";
import { Separator } from "@/shared/ui/separator";
import ProcessingProgress from "../ProcessingProgress";

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

const UploadQueuePanel: React.FC<UploadQueuePanelProps> = ({
  queue,
  onRemoveItem,
  onUpdateCategory,
  onUpdateDescription,
}) => {
  if (queue.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a]">
      <div className="flex flex-col divide-y divide-white/5">
        {queue.map((item) => {
          const isProcessing = item.status === "processing" || item.status === "parsing";
          const isUploading = item.status === "uploading";
          const isCompleted = item.status === "completed" || item.status === "upload_completed";
          const isFailed = item.status === "failed" || item.status === "parse_failed" || item.status === "upload_failed";
          
          let statusText = "Pending";
          if (isProcessing) statusText = "Parsing...";
          if (isUploading) statusText = "Uploading...";
          if (isCompleted) statusText = "Completed";
          if (isFailed) statusText = "Failed";

          const showInput = (isCompleted || item.status === "parsed" || item.status === "ready_to_upload") && onUpdateCategory;

          return (
            <div
              key={item.id}
              className="group flex items-center justify-between gap-4 p-4 hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-white/5">
                   {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                   ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon size={16} className="text-white/20" />
                    </div>
                   )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {(item.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex w-64 flex-col items-end gap-1.5">
                  {showInput ? (
                    <div className="flex w-full gap-2">
                       <input
                        type="text"
                        placeholder="Description..."
                        className="h-7 w-full flex-1 rounded border border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-zinc-600 focus:border-sky-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
                        defaultValue={item.editDraft?.description ?? item.metadata?.description ?? ""}
                        onBlur={(e) => onUpdateDescription?.(item.id, e.target.value, true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="text"
                        placeholder="Category..."
                        className="h-7 w-20 rounded border border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-zinc-600 focus:border-sky-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
                        defaultValue={item.editDraft?.category ?? item.metadata?.category ?? ""}
                        onBlur={(e) => onUpdateCategory?.(item.id, e.target.value, true)}
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
                              : "text-zinc-400"
                        )}
                      >
                        {statusText}
                      </span>
                      {(isProcessing || isUploading) && (
                        <Progress value={item.progress} className="h-1 w-24 bg-white/10" />
                      )}
                    </>
                  )}
                </div>

                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="rounded-full p-1 text-zinc-600 opacity-0 transition-all hover:bg-white/10 hover:text-zinc-300 group-hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UploadQueuePanel;
