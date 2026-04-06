import React, { useState, useCallback } from "react";
import { Upload, ImagePlus, FolderOpen } from "lucide-react";
import { DEFAULT_UPLOAD_CONFIG } from "@/types/photo";
import { cn } from "@/shared/lib/utils";
import { motion } from "motion/react";

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
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center px-6 py-10">
      <div
        className="relative w-full max-w-4xl transition-all duration-300"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <motion.div
          animate={{ scale: isDragOver ? 1.02 : 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "flex flex-col items-center justify-center rounded-[28px] border border-[var(--lumina-border-subtle)] bg-[var(--lumina-surface)]/94 px-10 py-16 transition-all duration-500",
            isDragOver
              ? "shadow-[var(--shadow-elevation-3)] ring-2 ring-[var(--lumina-border-subtle)]"
              : "shadow-[var(--shadow-elevation-1)] hover:shadow-[var(--shadow-elevation-2)]",
            !isRepoConfigured && "pointer-events-none opacity-50",
          )}
        >
          <motion.div
            animate={{
              backgroundColor: isDragOver ? "rgba(0, 0, 0, 0.06)" : "rgba(0, 0, 0, 0.02)",
              color: isDragOver ? "var(--lumina-text)" : "var(--lumina-muted)",
              y: isDragOver ? -8 : 0,
            }}
            className={cn(
              "mb-8 flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-500",
              "border border-[var(--lumina-border-subtle)]",
            )}
          >
            <Upload size={30} strokeWidth={1.25} />
          </motion.div>

          <h2 className="mb-2 text-3xl font-semibold tracking-tight text-[var(--lumina-text)]">
            拖放照片到这里
          </h2>
          <p className="mb-10 max-w-lg text-center text-sm leading-6 text-[var(--lumina-muted)]">
            像在 Codex 里开始一个新线程一样，直接把素材丢进来，或者从下方选择文件与文件夹开始整理。
          </p>

          <div className="grid w-full max-w-2xl gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={onSelectFilesFromDialog}
              disabled={!isRepoConfigured}
              className={cn(
                "flex min-h-28 flex-col items-start justify-between rounded-2xl border border-[var(--lumina-border-subtle)] bg-[var(--lumina-surface)] px-5 py-4 text-left transition-all",
                "hover:bg-[var(--lumina-surface-elevated)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--lumina-border-subtle)] bg-[var(--lumina-accent-muted)] text-[var(--lumina-text)]">
                <ImagePlus size={16} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[var(--lumina-text)]">
                  选择文件
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--lumina-muted)]">
                  适合快速添加少量照片，立即进入上传队列。
                </span>
              </span>
            </button>
            {onSelectFolderFromDialog && (
              <button
                type="button"
                onClick={onSelectFolderFromDialog}
                disabled={!isRepoConfigured}
                className={cn(
                  "flex min-h-28 flex-col items-start justify-between rounded-2xl border border-[var(--lumina-border-subtle)] bg-[var(--lumina-surface)] px-5 py-4 text-left transition-all",
                  "hover:bg-[var(--lumina-surface-elevated)]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--lumina-border-subtle)] bg-[var(--lumina-accent-muted)] text-[var(--lumina-text)]">
                  <FolderOpen size={16} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--lumina-text)]">
                    选择文件夹
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--lumina-muted)]">
                    扫描整个目录，预览后批量挑选要写入仓库的照片。
                  </span>
                </span>
              </button>
            )}
          </div>
        </motion.div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--lumina-muted)]">
          <span className="rounded-full border border-[var(--lumina-border-subtle)] px-2.5 py-1">
            支持 JPG / PNG / WebP / HEIC
          </span>
          <span className="rounded-full border border-[var(--lumina-border-subtle)] px-2.5 py-1">
            单文件最大 {DEFAULT_UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB
          </span>
        </div>
      </div>
    </div>
  );
};

export default UploadDropzone;
