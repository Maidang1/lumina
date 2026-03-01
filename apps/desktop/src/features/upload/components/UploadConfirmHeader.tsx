import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";

interface UploadConfirmHeaderProps {
  queueLength: number;
  totalBytes: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}

const UploadConfirmHeader: React.FC<UploadConfirmHeaderProps> = ({
  queueLength,
  totalBytes,
  canSubmit,
  isSubmitting,
  onSubmit,
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between rounded-xl border border-[var(--lumina-border-subtle)] bg-[var(--lumina-surface)]/30 backdrop-blur-xl px-4 py-3 shadow-lg"
    >
      <div>
        <h2 className="text-lg font-medium text-[var(--foreground)]">准备写入仓库</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          本次将写入 {queueLength} 个文件，预计 {(totalBytes / 1024 / 1024).toFixed(1)} MB。
        </p>
      </div>
      <Button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="h-9 px-6 text-sm font-medium"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={14} className="mr-2 animate-spin motion-reduce:animate-none" />
            写入中...
          </>
        ) : (
          "开始写入"
        )}
      </Button>
    </motion.div>
  );
};

export default UploadConfirmHeader;
