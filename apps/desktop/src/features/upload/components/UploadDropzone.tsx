import React from "react";
import { Upload } from "lucide-react";
import { DEFAULT_UPLOAD_CONFIG } from "@/types/photo";
import { Button } from "@/components/ui/button";

interface UploadDropzoneProps {
  isRepoConfigured: boolean;
  onSelectFilesFromDialog: () => void;
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  isRepoConfigured,
  onSelectFilesFromDialog,
}) => {
  return (
    <div className="relative rounded-xl border-2 border-dashed border-white/12 bg-white/[0.02] shadow-[var(--shadow-elevation-1)] transition-all duration-150 ease-in-out hover:border-white/25 hover:bg-white/[0.04]">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/8 text-gray-300 transition-transform duration-150">
          <Upload size={32} />
        </div>

        <div className="space-y-4">
          <p className="text-sm text-[var(--foreground)]">选择照片并写入本地 Git 仓库工作区</p>
          <Button
            onClick={onSelectFilesFromDialog}
            disabled={!isRepoConfigured}
            variant="outline"
            className="h-10 rounded-lg border-white/20 bg-white/5 px-8 text-sm text-white hover:bg-white/12 disabled:opacity-50"
          >
            选择照片
          </Button>
          <p className="max-w-md text-xs leading-relaxed text-[var(--muted-foreground)]">
            支持 JPG、PNG、WebP、HEIC（单文件最大 {DEFAULT_UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB）。
            上传只写入本地仓库，完成后请使用左侧 `Commit & Push` 同步远端。
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadDropzone;
