import React, { useEffect, useMemo } from "react";
import { Loader2, RefreshCw, GitCommit, GitBranch, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GitChangeList,
  deriveGitChanges,
  useGitChangesSnapshot,
  useGitOps,
  type GitChangeRow,
} from "@/features/git";

interface ChangesPageProps {
  onCommit: (message?: string) => void;
  commitLoading?: boolean;
  repoHint?: string;
}

export function ChangesPage({
  onCommit,
  commitLoading = false,
  repoHint,
}: ChangesPageProps): React.ReactElement {
  const { snapshot, loading, error, setError, refresh } = useGitChangesSnapshot();
  const { operatingKey, bulkLoading, stage, unstage, discard, remove, stageEverything, unstageEverything } =
    useGitOps({ refresh, setError });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const derived = useMemo(() => deriveGitChanges(snapshot), [snapshot]);

  const handleToggleStage = (row: GitChangeRow): void => {
    if (row.source === "staged") {
      void unstage(row.path, row.key);
    } else {
      void stage(row.path, row.key);
    }
  };

  const hasChanges = derived.counts.total > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 px-5 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--lumina-text)]">变更管理</h1>
            <p className="mt-1 text-sm text-[var(--lumina-muted)]">查看和管理本地仓库的文件变更</p>
          </div>
          {repoHint && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--lumina-border)] bg-[var(--lumina-surface)] px-3 py-2">
              <GitBranch size={14} className="text-emerald-500" />
              <span className="text-sm text-[var(--lumina-text-secondary)]">{repoHint}</span>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {loading ? (
              <Loader2 size={16} className="animate-spin text-[var(--lumina-muted)]" />
            ) : (
              <div className="flex gap-4 text-sm text-[var(--lumina-muted)]">
                {derived.counts.added > 0 && <span>{derived.counts.added} 新增</span>}
                {derived.counts.modified > 0 && <span>{derived.counts.modified} 修改</span>}
                {derived.counts.deleted > 0 && <span>{derived.counts.deleted} 删除</span>}
                {derived.counts.renamed > 0 && <span>{derived.counts.renamed} 重命名</span>}
                {!hasChanges && <span>工作区干净</span>}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || bulkLoading}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text)]"
            title="刷新"
          >
            <RefreshCw size={16} className={cn((loading || bulkLoading) && "animate-spin")} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
            {error}
          </div>
        )}

        {loading && !snapshot && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 size={32} className="animate-spin text-[var(--lumina-muted)]" />
          </div>
        )}

        {!loading && (
          <div className="overflow-hidden rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 backdrop-blur-sm">
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
          </div>
        )}

        {!loading && !hasChanges && (
          <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 backdrop-blur-sm">
            <CheckCircle2 size={48} className="mb-4 text-emerald-500/50" />
            <p className="text-lg font-medium text-[var(--lumina-text)]">工作区干净</p>
            <p className="mt-1 text-sm text-[var(--lumina-muted)]">没有待提交的文件变更</p>
          </div>
        )}

        {derived.counts.staged > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 px-4 py-3 backdrop-blur-sm">
            <span className="text-sm text-[var(--lumina-muted)]">{derived.counts.staged} 个文件将被提交</span>
            <button
              type="button"
              onClick={() => onCommit()}
              disabled={commitLoading}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors",
                commitLoading
                  ? "cursor-not-allowed bg-[var(--lumina-border-subtle)] text-[var(--lumina-muted)]"
                  : "bg-[var(--lumina-text)] text-[var(--lumina-bg)] hover:opacity-90",
              )}
            >
              <GitCommit size={16} />
              {commitLoading ? "提交中..." : "Commit & Push"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
