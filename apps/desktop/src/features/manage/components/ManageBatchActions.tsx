import React, { useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { BatchActionResult } from "@/hooks/useBatchPhotoActions";

interface ManageBatchActionsProps {
  selectedCount: number;
  batchResult: BatchActionResult | null;
  onClearBatchResult: () => void;
  onClearSelection: () => void;
  onBatchTag: (tag: string) => void;
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
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");

  if (selectedCount === 0 && !batchResult) {
    return null;
  }

  const actionLabel =
    batchResult?.action === "delete"
      ? "删除"
      : batchResult?.action === "download"
        ? "下载"
        : batchResult?.action === "tag"
          ? "标签"
          : "";

  return (
    <div className="space-y-3">
      {batchResult && (
        <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[var(--foreground)] shadow-[var(--shadow-elevation-2)] backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="text-[var(--muted-foreground)]">
              {actionLabel}结果（{batchResult.total}）
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
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-[var(--foreground)] shadow-[var(--shadow-elevation-2)] backdrop-blur-md">
          <span className="mr-2 text-[var(--muted-foreground)]">
            已选 {selectedCount} 张
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
            onClick={onClearSelection}
          >
            取消选择
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
            onClick={() => {
              setTagInput("");
              setIsTagDialogOpen(true);
            }}
          >
            添加标签
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
            onClick={onBatchDownload}
          >
            下载
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="cursor-pointer rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-red-300 transition-colors duration-200 hover:bg-red-500/20"
            onClick={onBatchDelete}
          >
            删除
          </Button>
        </div>
      )}

      {isTagDialogOpen && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[var(--card)] p-4 shadow-[var(--shadow-elevation-3)]">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">添加标签</h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              为所有选中照片应用同一个标签。
            </p>
            <input
              type="text"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              className="mt-3 w-full rounded-md border border-[var(--border)] bg-white/[0.04] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-0 focus:border-[var(--ring)]"
              placeholder="标签"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const normalized = tagInput.trim();
                  if (!normalized) return;
                  onBatchTag(normalized);
                  setIsTagDialogOpen(false);
                }
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsTagDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const normalized = tagInput.trim();
                  if (!normalized) return;
                  onBatchTag(normalized);
                  setIsTagDialogOpen(false);
                }}
              >
                应用
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageBatchActions;
