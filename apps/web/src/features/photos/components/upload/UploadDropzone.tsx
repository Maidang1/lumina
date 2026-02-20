import React from "react";
import { CheckCircle2, Images, Upload } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { DEFAULT_UPLOAD_CONFIG } from "@/features/photos/types";

interface UploadDropzoneProps {
  isDragging: boolean;
  uploadMode: "static";
  isTokenConfigured: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onChangeMode: (mode: "static") => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  // Deprecated props (kept for compatibility if needed, but we will ignore them)
  pendingLiveStillName?: string;
  pendingLiveVideoName?: string;
  liveStillInputRef?: React.RefObject<HTMLInputElement | null>;
  liveVideoInputRef?: React.RefObject<HTMLInputElement | null>;
  onLiveStillSelect?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLiveVideoSelect?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  isDragging,
  isTokenConfigured,
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
}) => {
  return (
    <div
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all duration-150 ease-in-out",
        isDragging
          ? "border-emerald-500/50 bg-emerald-500/5"
          : "border-white/10 bg-[#0a0a0a] hover:bg-[#121212] hover:border-white/20"
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div
          className={cn(
            "mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-transform duration-150",
            isDragging && "scale-110 text-emerald-400"
          )}
        >
          <Upload size={32} />
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-300">Drag files here, or</p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={!isTokenConfigured}
            variant="outline"
            className="h-10 rounded-lg border-white/20 bg-white/5 px-8 text-sm text-white hover:bg-white/10 disabled:opacity-50"
          >
            Select Files
          </Button>
          <p className="text-xs text-gray-500">
            Supports JPG, PNG, WebP, HEIC (Max {DEFAULT_UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB)
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={onFileSelect}
        />
      </div>
    </div>
  );
};

export default UploadDropzone;
