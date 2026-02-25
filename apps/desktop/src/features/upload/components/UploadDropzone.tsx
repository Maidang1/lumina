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
    <div className="relative rounded-xl border-2 border-dashed border-white/10 bg-[#0a0a0a] transition-all duration-150 ease-in-out hover:border-white/20 hover:bg-[#121212]">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-transform duration-150">
          <Upload size={32} />
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-300">选择照片并写入本地 Git 仓库工作区</p>
          <Button
            onClick={onSelectFilesFromDialog}
            disabled={!isRepoConfigured}
            variant="outline"
            className="h-10 rounded-lg border-white/20 bg-white/5 px-8 text-sm text-white hover:bg-white/10 disabled:opacity-50"
          >
            选择照片
          </Button>
          <p className="text-xs text-gray-500 max-w-md leading-relaxed">
            支持 JPG、PNG、WebP、HEIC（单文件最大 {DEFAULT_UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB）。
            上传只写入本地仓库，完成后请使用左侧 `Commit & Push` 同步远端。
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadDropzone;
