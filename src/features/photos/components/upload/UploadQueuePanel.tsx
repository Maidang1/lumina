import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
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
  onRemoveItem: (id: string) => void;
}

const UploadQueuePanel: React.FC<UploadQueuePanelProps> = ({
  queue,
  totalBytes,
  failedCount,
  onRemoveItem,
}) => {
  if (queue.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Sparkles size={14} className="text-[#c9a962]" />
          <span>上传队列</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
            {queue.length} 张
          </Badge>
          <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
            {(totalBytes / 1024 / 1024).toFixed(1)} MB
          </Badge>
          {failedCount > 0 && (
            <Badge className="rounded-full border border-red-400/40 bg-red-500/10 text-red-300">
              失败 {failedCount}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {queue.map((item) => (
          <Card
            key={item.id}
            className="rounded-xl border border-white/10 bg-gradient-to-b from-[#1a1a1a] to-[#151515] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <CardContent className="p-4">
              <div className="flex gap-4">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-black/40 ring-1 ring-white/10">
                    <ImageIcon size={22} className="text-gray-500" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {item.file.name}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        {item.liveVideoFile && (
                          <span className="ml-2 text-[#d4b97f]">
                            + MOV {(item.liveVideoFile.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        )}
                        {item.metadata?.image_id && (
                          <span className="ml-2 font-mono text-[11px] text-gray-400">
                            {item.metadata.image_id.slice(0, 16)}...
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.uploadMode === "live_photo" && (
                        <Badge className="rounded-full border border-[#c9a962]/50 bg-[#c9a962]/10 text-[#d4b97f]">
                          LIVE
                        </Badge>
                      )}
                      <Badge
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px]",
                          item.status === "completed" &&
                            "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
                          item.status === "uploading" &&
                            "border-[#c9a962]/40 bg-[#c9a962]/15 text-[#e7d3a4]",
                          item.status === "processing" &&
                            "border-[#c9a962]/30 bg-[#c9a962]/10 text-[#e7d3a4]",
                          item.status === "failed" &&
                            "border-red-400/40 bg-red-500/15 text-red-300",
                          item.status === "queued" &&
                            "border-white/20 bg-white/5 text-gray-300"
                        )}
                      >
                        {item.status === "completed" && "已完成"}
                        {item.status === "uploading" && "上传中"}
                        {item.status === "processing" && "处理中"}
                        {item.status === "failed" && "失败"}
                        {item.status === "queued" && "等待中"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveItem(item.id)}
                        className="h-7 w-7 rounded-full text-gray-500 hover:bg-white/10 hover:text-red-300"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>

                  {item.status === "processing" && (
                    <ProcessingProgress stages={item.stages} />
                  )}

                  {item.status === "uploading" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
                          正在上传到 GitHub
                        </span>
                        <span>{Math.round(item.progress)}%</span>
                      </div>
                      <Progress
                        value={item.progress}
                        indicatorClassName="bg-gradient-to-r from-[#c9a962] to-[#e7d3a4]"
                      />
                    </div>
                  )}

                  {item.status === "completed" && (
                    <div className="flex items-center gap-2 text-sm text-emerald-300">
                      <CheckCircle2 size={16} />
                      <span>上传完成</span>
                    </div>
                  )}

                  {item.status === "failed" && (
                    <div className="flex items-center gap-2 text-sm text-red-300">
                      <AlertCircle size={16} />
                      <span>{item.error || "处理失败"}</span>
                    </div>
                  )}
                </div>
              </div>

              {item.metadata?.exif && (
                <>
                  <Separator className="my-3 bg-white/10" />
                  <div className="flex flex-wrap gap-2 text-xs">
                    {item.metadata.exif.Model && (
                      <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                        {item.metadata.exif.Model}
                      </Badge>
                    )}
                    {item.metadata.exif.FNumber && (
                      <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                        f/{item.metadata.exif.FNumber}
                      </Badge>
                    )}
                    {item.metadata.exif.ExposureTime && (
                      <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                        1/{Math.round(1 / item.metadata.exif.ExposureTime)}s
                      </Badge>
                    )}
                    {item.metadata.exif.ISO && (
                      <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                        ISO {item.metadata.exif.ISO}
                      </Badge>
                    )}
                    {item.metadata.exif.FocalLength && (
                      <Badge className="rounded-full border border-white/15 bg-white/5 text-gray-300">
                        {item.metadata.exif.FocalLength}mm
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default UploadQueuePanel;
