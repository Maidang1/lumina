import React from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BatchActionResult } from "@/hooks/useBatchPhotoActions";

interface ManageBatchActionsProps {
  selectedCount: number;
  batchResult: BatchActionResult | null;
  onClearBatchResult: () => void;
  onClearSelection: () => void;
  onBatchTag: () => void;
  onBatchDownload: () => void;
  onBatchDelete: () => void;
}

const ManageBatchActions: React.FC<ManageBatchActionsProps> = ({
  selectedCount,
  batchResult,
  onClearBatchResult,
  onClearSelection,
  onBatchTag,
  onBatchDownload,
  onBatchDelete,
}) => {
  if (selectedCount === 0 && !batchResult) {
    return null;
  }

  const actionLabel =
    batchResult?.action === "delete"
      ? "Delete"
      : batchResult?.action === "download"
        ? "Download"
        : batchResult?.action === "tag"
          ? "Tag"
          : "";

  return (
    <div className="space-y-3">
      {batchResult && (
        <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-lumina-text shadow-[0_14px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="text-lumina-text-secondary">
              {actionLabel} result ({batchResult.total})
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <CheckCircle2 size={14} />
              {batchResult.success}
            </span>
            <span className="inline-flex items-center gap-1 text-rose-300">
              <XCircle size={14} />
              {batchResult.failed}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            onClick={onClearBatchResult}
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-lumina-text shadow-[0_14px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <span className="mr-2 text-lumina-text-secondary">
            Selected {selectedCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
            onClick={onClearSelection}
          >
            Deselect
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
            onClick={onBatchTag}
          >
            Tag
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
            onClick={onBatchDownload}
          >
            Download
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="cursor-pointer rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-red-300 transition-colors duration-200 hover:bg-red-500/20"
            onClick={onBatchDelete}
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
};

export default ManageBatchActions;
