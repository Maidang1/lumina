import React from "react";
import { Photo } from "../types";
import {
  X,
  Aperture,
  Timer,
  Gauge,
  MapPin,
  Calendar,
  Camera,
  Download,
} from "lucide-react";
import Histogram from "./Histogram";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface PhotoDetailProps {
  photo: Photo;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

const PhotoDetail: React.FC<PhotoDetailProps> = ({ photo, onClose }) => {
  const metadata = photo.metadata;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        overlayClassName="bg-black/95"
        className="h-screen max-w-none rounded-none border-0 bg-transparent p-0"
      >
        <div className="relative flex h-full w-full flex-col md:flex-row">
          <DialogClose className="absolute right-4 top-4 z-50 rounded-full bg-black/50 p-2 text-white md:hidden">
            <X size={24} />
          </DialogClose>

          <div className="relative flex h-[60%] flex-1 items-center justify-center bg-black p-4 md:h-full md:p-8">
            <DialogHeader className="absolute left-6 top-6 z-20 hidden md:block">
              <DialogClose className="text-white/50 transition-colors hover:text-white">
                <div className="flex items-center gap-2 text-sm uppercase tracking-widest">
                  <X size={20} />
                  <span>Close Gallery</span>
                </div>
              </DialogClose>
              <DialogTitle className="sr-only">{photo.title}</DialogTitle>
            </DialogHeader>
            <img
              src={photo.url}
              alt={photo.title}
              className="max-h-full max-w-full object-contain shadow-2xl"
            />
          </div>

          <ScrollArea className="h-[40%] w-full border-l border-white/5 bg-pro-gray/90 backdrop-blur-md md:h-full md:w-[420px] lg:w-[480px]">
            <div className="space-y-6 p-8">
              <div>
                <h2 className="mb-2 font-serif text-3xl text-white">{photo.title}</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                  <Badge variant="outline" className="gap-1.5 border-white/10 text-gray-300">
                    <MapPin size={14} /> {photo.location || "未标注地点"}
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 border-white/10 text-gray-300">
                    <Calendar size={14} /> {photo.exif.date}
                  </Badge>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Histogram</h3>
                <Histogram />
              </div>

              <div>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">拍摄参数</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-white/5 bg-black/40">
                    <CardContent className="p-4">
                      <div className="mb-1 flex items-center gap-2 text-gray-400">
                        <Aperture size={16} />
                        <span className="text-xs uppercase tracking-wider">Aperture</span>
                      </div>
                      <span className="font-mono text-lg text-white">{photo.exif.aperture}</span>
                    </CardContent>
                  </Card>
                  <Card className="border-white/5 bg-black/40">
                    <CardContent className="p-4">
                      <div className="mb-1 flex items-center gap-2 text-gray-400">
                        <Timer size={16} />
                        <span className="text-xs uppercase tracking-wider">Shutter</span>
                      </div>
                      <span className="font-mono text-lg text-white">{photo.exif.shutter}</span>
                    </CardContent>
                  </Card>
                  <Card className="border-white/5 bg-black/40">
                    <CardContent className="p-4">
                      <div className="mb-1 flex items-center gap-2 text-gray-400">
                        <Gauge size={16} />
                        <span className="text-xs uppercase tracking-wider">ISO</span>
                      </div>
                      <span className="font-mono text-lg text-white">{photo.exif.iso || "-"}</span>
                    </CardContent>
                  </Card>
                  <Card className="border-white/5 bg-black/40">
                    <CardContent className="p-4">
                      <div className="mb-1 flex items-center gap-2 text-gray-400">
                        <Camera size={16} />
                        <span className="text-xs uppercase tracking-wider">Focal Len</span>
                      </div>
                      <span className="font-mono text-lg text-white">{photo.exif.focalLength}</span>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />
              <div className="space-y-2">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">文件信息</h3>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-400">设备</span>
                  <span className="text-sm font-medium text-white">{photo.exif.camera}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-400">镜头</span>
                  <span className="text-sm font-medium text-white">{photo.exif.lens}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-400">分辨率</span>
                  <span className="text-sm font-medium text-white">{photo.width} × {photo.height}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-400">原图大小</span>
                  <span className="text-sm font-medium text-white">{metadata ? formatBytes(metadata.files.original.bytes) : photo.size}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-400">缩略图</span>
                  <span className="text-sm font-medium text-white">
                    {metadata
                      ? `${metadata.files.thumb.width} × ${metadata.files.thumb.height} · ${formatBytes(metadata.files.thumb.bytes)}`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-400">格式</span>
                  <span className="text-sm font-medium text-white">{metadata?.files.original.mime || photo.format}</span>
                </div>
              </div>

              {metadata && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">智能分析</h3>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-400">主色</span>
                      <span className="font-mono text-sm text-white">{metadata.derived.dominant_color.hex}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-400">模糊检测</span>
                      <span className="text-sm font-medium text-white">
                        {metadata.derived.blur.is_blurry ? "可能模糊" : "清晰"}（{metadata.derived.blur.score.toFixed(1)}）
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-400">OCR</span>
                      <span className="text-sm font-medium text-white">
                        {metadata.derived.ocr.status === "ok"
                          ? `已识别${metadata.derived.ocr.summary ? `：${metadata.derived.ocr.summary.slice(0, 24)}` : ""}`
                          : metadata.derived.ocr.status === "skipped"
                          ? "已跳过"
                          : "失败"}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {metadata && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">隐私与处理</h3>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-400">原图含 GPS</span>
                      <span className="text-sm font-medium text-white">{metadata.privacy.original_contains_gps ? "是" : "否"}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-400">GPS 已移除</span>
                      <span className="text-sm font-medium text-white">{metadata.privacy.exif_gps_removed ? "是" : "否"}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-400">创建时间</span>
                      <span className="text-sm font-medium text-white">{formatTime(metadata.timestamps.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-400">处理时间</span>
                      <span className="text-sm font-medium text-white">{formatTime(metadata.timestamps.client_processed_at)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-1">
                      <span className="text-sm text-gray-400">图片 ID</span>
                      <span className="break-all text-right font-mono text-xs text-white/80">{metadata.image_id}</span>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2">
                <Button
                  onClick={() => window.open(photo.url, "_blank", "noopener,noreferrer")}
                  className="w-full gap-2 py-4 text-xs font-semibold uppercase tracking-widest"
                >
                  <Download size={16} /> Download Original
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoDetail;
