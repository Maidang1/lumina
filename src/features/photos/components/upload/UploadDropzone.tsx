import React from "react";
import { CheckCircle2, Images, Upload } from "lucide-react";
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
    <div
      className={cn(
        "relative rounded-xl transition-all duration-150 ease-in-out",
        isDragging
          ? "bg-emerald-500/5"
          : "bg-[#0a0a0a] hover:bg-[#121212]"
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-8 flex items-center gap-2 rounded-full bg-white/5 p-1">
          <button
            onClick={() => onChangeMode("static")}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition-all",
              uploadMode === "static"
                ? "bg-white text-black"
                : "text-gray-400 hover:text-white"
            )}
          >
            静态图片
          </button>
          <button
            onClick={() => onChangeMode("live_photo")}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition-all",
              uploadMode === "live_photo"
                ? "bg-white text-black"
                : "text-gray-400 hover:text-white"
            )}
          >
            实况图片
          </button>
        </div>

        <div
          className={cn(
            "mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-transform duration-150",
            isDragging && "scale-110 text-emerald-400"
          )}
        >
          <Upload size={32} />
        </div>

        {uploadMode === "static" ? (
          <div className="space-y-6">
            <p className="text-sm text-gray-300">拖拽或点击上传照片</p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!isTokenConfigured}
              variant="outline"
              className="h-9 rounded-lg border-white/20 bg-white/5 px-6 text-sm text-white hover:bg-white/10 disabled:opacity-50"
            >
              选择文件
            </Button>
            <p className="text-xs text-gray-500">
              JPG、PNG、WebP、HEIC (最大 {DEFAULT_UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB)
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <Button
                  onClick={() => liveStillInputRef.current?.click()}
                  disabled={!isTokenConfigured}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "border-white/20 bg-white/5 text-xs hover:bg-white/10",
                    pendingLiveStillName ? "text-emerald-400 border-emerald-400/30" : "text-white"
                  )}
                >
                  {pendingLiveStillName ? <CheckCircle2 size={12} className="mr-1"/> : <Images size={12} className="mr-1"/>}
                  {pendingLiveStillName ? "已选主图" : "主图"}
                </Button>
                {pendingLiveStillName && <span className="max-w-[120px] truncate text-[11px] text-gray-500">{pendingLiveStillName}</span>}
              </div>

              <span className="text-gray-500">+</span>

              <div className="flex flex-col items-center gap-1">
                <Button
                  onClick={() => liveVideoInputRef.current?.click()}
                  disabled={!isTokenConfigured}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "border-white/20 bg-white/5 text-xs hover:bg-white/10",
                    pendingLiveVideoName ? "text-emerald-400 border-emerald-400/30" : "text-white"
                  )}
                >
                  {pendingLiveVideoName ? <CheckCircle2 size={12} className="mr-1"/> : <Upload size={12} className="mr-1"/>}
                  {pendingLiveVideoName ? "已选视频" : "视频"}
                </Button>
                {pendingLiveVideoName && <span className="max-w-[120px] truncate text-[11px] text-gray-500">{pendingLiveVideoName}</span>}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              选择配对的主图和 MOV 视频
            </p>
          </div>
        )}

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
      </div>
    </div>
  );
};

export default UploadDropzone;
