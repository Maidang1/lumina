import React, { useState, useCallback } from "react";
import { Upload, ImagePlus, FolderOpen } from "lucide-react";
import { DEFAULT_UPLOAD_CONFIG } from "@/types/photo";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface UploadDropzoneProps {
  isRepoConfigured: boolean;
  onSelectFilesFromDialog: () => void;
  onSelectFolderFromDialog?: () => void;
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  isRepoConfigured,
  onSelectFilesFromDialog,
  onSelectFolderFromDialog,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRepoConfigured) {
      setIsDragOver(true);
    }
  }, [isRepoConfigured]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div
        className={cn(
          "relative w-full max-w-xl transition-all duration-300",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <motion.div
          animate={{ scale: isDragOver ? 1.02 : 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "flex flex-col items-center justify-center rounded-3xl border border-[var(--lumina-border-subtle)] p-12 transition-all duration-500",
            isDragOver
              ? "bg-[var(--lumina-surface)]/60 shadow-2xl backdrop-blur-2xl ring-2 ring-[var(--lumina-border-subtle)]"
              : "bg-[var(--lumina-surface)]/20 shadow-xl backdrop-blur-md hover:border-white/10 hover:bg-[var(--lumina-surface)]/30 hover:shadow-2xl",
            !isRepoConfigured && "pointer-events-none opacity-50",
          )}
        >
          <motion.div
            animate={{ 
              backgroundColor: isDragOver ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.03)",
              color: isDragOver ? "#ffffff" : "var(--lumina-muted)",
              y: isDragOver ? -8 : 0,
            }}
            className={cn(
              "mb-8 flex h-24 w-24 items-center justify-center rounded-full transition-all duration-500",
              "border border-[var(--lumina-border-subtle)] shadow-inner",
            )}
          >
            <Upload size={36} strokeWidth={1} />
          </motion.div>

          <h2 className="mb-2 text-lg font-medium text-[var(--lumina-text)]">
            拖放照片到这里
          </h2>
          <p className="mb-6 text-sm text-[var(--lumina-muted)]">或者使用下方按钮选择</p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onSelectFilesFromDialog}
              disabled={!isRepoConfigured}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all",
                "bg-[var(--lumina-text)] text-[var(--lumina-bg)]",
                "hover:opacity-90",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <ImagePlus size={16} />
              选择文件
            </button>
            {onSelectFolderFromDialog && (
              <button
                type="button"
                onClick={onSelectFolderFromDialog}
                disabled={!isRepoConfigured}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all",
                  "border border-[var(--lumina-border)] bg-[var(--lumina-surface)] text-[var(--lumina-text-secondary)]",
                  "hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text)]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <FolderOpen size={16} />
                选择文件夹
              </button>
            )}
          </div>
        </motion.div>

        <p className="mt-4 text-center text-xs text-[var(--lumina-muted)]">
          支持 JPG、PNG、WebP、HEIC · 单文件最大{" "}
          {DEFAULT_UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB
        </p>
      </div>
    </div>
  );
};

export default UploadDropzone;
