import React, { useEffect, useMemo } from "react";
import { Loader2, RefreshCw, GitCommit } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GitChangeList,
  deriveGitChanges,
  useGitChangesSnapshot,
  useGitOps,
  type GitChangeRow,
} from "@/features/git";

interface ChangesPreviewPanelProps {
  open: boolean;
  onClose: () => void;
  onCommit: (message?: string) => void;
  commitLoading?: boolean;
}

export function ChangesPreviewPanel({
  open,
  onClose,
  onCommit,
  commitLoading = false,
}: ChangesPreviewPanelProps): React.ReactElement | null {
  const { snapshot, loading, error, setError, refresh } = useGitChangesSnapshot();
  const { operatingKey, bulkLoading, stage, unstage, discard, remove, stageEverything, unstageEverything } =
    useGitOps({ refresh, setError });

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  const derived = useMemo(() => deriveGitChanges(snapshot), [snapshot]);

  const handleToggleStage = (row: GitChangeRow): void => {
    if (row.source === "staged") {
      void unstage(row.path, row.key);
    } else {
      void stage(row.path, row.key);
    }
  };

  if (!open) return null;

  const hasChanges = derived.counts.total > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className={cn(
          "relative w-full max-w-xl overflow-hidden rounded-xl",
          "border border-[var(--lumina-border)] bg-[var(--lumina-surface)] shadow-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--lumina-border)] px-4 py-3">
          <h2 className="text-sm font-medium text-[var(--lumina-text)]">变更预览</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || bulkLoading}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text)]"
            title="刷新"
          >
            <RefreshCw size={14} className={cn((loading || bulkLoading) && "animate-spin")} />
          </button>
        </header>

        <div className="max-h-[450px] overflow-y-auto">
          {loading && !snapshot && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[var(--lumina-muted)]" />
            </div>
          )}

          {error && <div className="px-4 py-8 text-center text-sm text-rose-500">{error}</div>}

          {!loading && snapshot && (
            <>
              {!hasChanges ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm text-[var(--lumina-muted)]">没有待提交的变更</p>
                </div>
              ) : (
                <GitChangeList
                  stagedRows={derived.stagedRows}
                  unstagedRows={derived.unstagedRows}
                  operatingKey={operatingKey}
                  bulkLoading={bulkLoading}
                  onToggleStage={handleToggleStage}
                  onDiscard={(row) => void discard(row.path, row.key)}
                  onDelete={(row) => void remove(row.path, row.key)}
                  onStageAll={() => void stageEverything()}
                  onUnstageAll={() => void unstageEverything()}
                />
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--lumina-border)] px-4 py-3">
          <span className="text-xs text-[var(--lumina-muted)]">
            {derived.counts.staged > 0
              ? `${derived.counts.staged} 个文件将被提交`
              : hasChanges
                ? "请先暂存要提交的文件"
                : "工作区干净"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--lumina-border)] bg-transparent px-4 py-1.5 text-sm text-[var(--lumina-text-secondary)] transition-colors hover:bg-[var(--lumina-accent-muted)]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => onCommit()}
              disabled={derived.counts.staged === 0 || commitLoading}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                derived.counts.staged > 0 && !commitLoading
                  ? "bg-[var(--lumina-text)] text-[var(--lumina-bg)] hover:opacity-90"
                  : "cursor-not-allowed bg-[var(--lumina-border-subtle)] text-[var(--lumina-muted)]",
              )}
            >
              <GitCommit size={14} />
              {commitLoading ? "提交中..." : "Commit & Push"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
