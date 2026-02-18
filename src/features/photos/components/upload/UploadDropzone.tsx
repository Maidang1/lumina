import React from "react";
import { Images, Upload } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { DEFAULT_UPLOAD_CONFIG } from "@/features/photos/types";

interface UploadDropzoneProps {
  isDragging: boolean;
  uploadMode: "static" | "live_photo";
  isTokenConfigured: boolean;
  pendingLiveStillName?: string;
  pendingLiveVideoName?: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  liveStillInputRef: React.RefObject<HTMLInputElement | null>;
  liveVideoInputRef: React.RefObject<HTMLInputElement | null>;
  onChangeMode: (mode: "static" | "live_photo") => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLiveStillSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLiveVideoSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  isDragging,
  uploadMode,
  isTokenConfigured,
  pendingLiveStillName,
  pendingLiveVideoName,
  fileInputRef,
  liveStillInputRef,
  liveVideoInputRef,
  onChangeMode,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
  onLiveStillSelect,
  onLiveVideoSelect,
}) => {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border p-0",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)] before:content-['']",
        isDragging
          ? "border-[#c9a962]/60 bg-[#c9a962]/10 shadow-[0_0_0_1px_rgba(201,169,98,0.25)]"
          : "border-white/5 bg-[#0A0A0A] hover:border-white/20"
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <CardContent className="relative p-8 md:p-10">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="mb-5 flex w-full items-center justify-center gap-2">
            <Button
              onClick={() => onChangeMode("static")}
              variant={uploadMode === "static" ? "default" : "outline"}
              className={cn(
                "rounded-full px-4 py-2 text-xs",
                uploadMode === "static"
                  ? "bg-white text-black hover:bg-gray-200"
                  : "border-white/20 bg-transparent text-gray-300 hover:bg-white/10"
              )}
            >
              静态图片
            </Button>
            <Button
              onClick={() => onChangeMode("live_photo")}
              variant={uploadMode === "live_photo" ? "default" : "outline"}
              className={cn(
                "rounded-full px-4 py-2 text-xs",
                uploadMode === "live_photo"
                  ? "bg-[#c9a962] text-black hover:bg-[#d4b97f]"
                  : "border-[#c9a962]/40 bg-transparent text-[#d4b97f] hover:bg-[#c9a962]/15"
              )}
            >
              实况图片
            </Button>
          </div>
          <div
            className={cn(
              "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors",
              isDragging
                ? "border-[#c9a962]/80 bg-[#c9a962]/20 text-[#f1e2bf]"
                : "border-white/15 bg-white/5 text-gray-300"
            )}
          >
            <Upload size={26} />
          </div>

          {uploadMode === "static" ? (
            <>
              <p className="text-base font-medium text-white">拖拽照片到这里，立即开始处理</p>
              <p className="mt-1 text-sm text-gray-400">自动生成缩略图、提取 EXIF、OCR 与画质分析</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isTokenConfigured}
                  className="gap-2 rounded-full bg-white text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-500 disabled:text-gray-200"
                >
                  <Images size={14} />
                  选择文件
                </Button>
                <Badge className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-300">
                  JPG · PNG · WebP · HEIC
                </Badge>
                <Badge className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-300">
                  最大 {DEFAULT_UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB
                </Badge>
              </div>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-white">手动配对上传实况：主图 + MOV</p>
              <p className="mt-1 text-sm text-gray-400">需同时选择一张主图和一个 MOV 文件，缺一不可</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button
                  onClick={() => liveStillInputRef.current?.click()}
                  disabled={!isTokenConfigured}
                  className="gap-2 rounded-full bg-white text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-500 disabled:text-gray-200"
                >
                  <Images size={14} />
                  选择主图
                </Button>
                <Button
                  onClick={() => liveVideoInputRef.current?.click()}
                  disabled={!isTokenConfigured}
                  variant="outline"
                  className="gap-2 rounded-full border-[#c9a962]/50 bg-[#c9a962]/10 text-[#d4b97f] hover:bg-[#c9a962]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload size={14} />
                  选择 MOV
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400">
                <Badge className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-300">
                  主图: {pendingLiveStillName || "未选择"}
                </Badge>
                <Badge className="rounded-full border border-[#c9a962]/40 bg-[#c9a962]/10 px-3 py-1 text-xs text-[#d4b97f]">
                  MOV: {pendingLiveVideoName || "未选择"}
                </Badge>
                <Badge className="rounded-full border border-[#c9a962]/40 bg-[#c9a962]/10 px-3 py-1 text-xs text-[#d4b97f]">
                  MOV 最大 10MB
                </Badge>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={onFileSelect}
        />
        <input
          ref={liveStillInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onLiveStillSelect}
        />
        <input
          ref={liveVideoInputRef}
          type="file"
          accept=".mov,video/quicktime"
          className="hidden"
          onChange={onLiveVideoSelect}
        />
      </CardContent>
    </Card>
  );
};

export default UploadDropzone;
