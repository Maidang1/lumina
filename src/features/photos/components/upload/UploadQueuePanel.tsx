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
}

const UploadQueuePanel: React.FC<UploadQueuePanelProps> = ({
  queue,
  totalBytes,
  failedCount,
  workerCount,
  activeWorkers,
  onRemoveItem,
  onRetryItem,
  onEditItem,
  isEditEnabled = false,
}) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const throughput = useMemo(() => {
    const completed = queue.filter(
      (item) => item.status === "completed" || item.status === "upload_completed"
    );
    const processedBytes = completed.reduce(
      (sum, item) => sum + item.file.size + (item.liveVideoFile?.size || 0),
      0
    );
    const totalMs = completed.reduce(
      (sum, item) => sum + (item.processingSummary?.total_ms || 0),
      0
    );
    if (totalMs <= 0) return 0;
    return (processedBytes / 1024 / 1024) / (totalMs / 1000);
  }, [queue]);

  if (queue.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl bg-[#0a0a0a] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">上传队列</h3>
          <Badge variant="secondary" className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">
            {queue.length}
          </Badge>
          {failedCount > 0 && (
            <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-xs">
              {failedCount} 失败
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{(totalBytes / 1024 / 1024).toFixed(1)} MB</span>
          {throughput > 0 && <span>{throughput.toFixed(1)} MB/s</span>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {queue.map((item) => {
          const isProcessing = item.status === "processing" || item.status === "parsing";
          const isUploading = item.status === "uploading";
          const isCompleted = item.status === "completed" || item.status === "upload_completed";
          const isFailed = item.status === "failed" || item.status === "parse_failed" || item.status === "upload_failed";
          const isQueued = item.status === "queued" || item.status === "queued_parse";
          
          return (
            <div
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-lg bg-black/40 transition-all hover:-translate-y-0.5"
            >
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.file.name}
                  className={cn(
                    "h-full w-full object-cover",
                    (isProcessing || isUploading) && "opacity-70"
                  )}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/5">
                  <ImageIcon className="h-6 w-6 text-white/20" />
                </div>
              )}

              {/* Hover Actions */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <div className="flex gap-1">
                  {isEditEnabled && (isCompleted || item.status === "parsed" || item.status === "ready_to_upload") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditItem?.(item.id);
                      }}
                      className="h-6 w-6 rounded-full bg-black/70 p-1 text-white hover:bg-blue-500"
                    >
                      <Settings2 size={12} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.id);
                    }}
                    className="h-6 w-6 rounded-full bg-black/70 p-1 text-white hover:bg-red-500"
                  >
                    <X size={12} />
                  </Button>
                  
                  {isFailed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryItem(item.id);
                      }}
                      className="h-6 w-6 rounded-full bg-black/70 p-1 text-white hover:bg-emerald-500"
                    >
                      <RotateCcw size={12} />
                    </Button>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <div className="absolute right-1 top-1">
                {item.uploadMode === "live_photo" && (
                  <Badge variant="outline" className="h-3 border-yellow-500/50 bg-yellow-500/20 px-1 text-[8px] text-yellow-400">
                    LIVE
                  </Badge>
                )}
              </div>

              {/* Progress Bar */}
              {(isProcessing || isUploading) && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {/* Status Icon */}
              <div className="absolute bottom-1 left-1">
                {isCompleted && <CheckCircle2 size={10} className="text-emerald-400" />}
                {isFailed && <AlertCircle size={10} className="text-red-400" />}
              </div>

              {/* Processing Spinner */}
              {(isProcessing || isUploading) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UploadQueuePanel;
