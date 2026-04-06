import React, { useEffect, useMemo, useState } from "react";
import { X, RefreshCw, GitBranch, Image as ImageIcon, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommitForm } from "./CommitForm";
import {
  GitChangeList,
  deriveGitChanges,
  groupChangesByImage,
  useGitChangesSnapshot,
  useGitOps,
  type GitChangeRow,
} from "@/features/git";
import { GitImageGroupList } from "@/features/git/components/GitImageGroupList";

type SidebarViewMode = "files" | "images";

interface GitSidebarPanelProps {
  open: boolean;
  onClose: () => void;
  onCommit: (message?: string) => void;
  commitLoading?: boolean;
  repoHint?: string;
}

export function GitSidebarPanel({
  open,
  onClose,
  onCommit,
  commitLoading = false,
  repoHint,
}: GitSidebarPanelProps): React.ReactElement | null {
  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [unstagedExpanded, setUnstagedExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<SidebarViewMode>("images");

  const { snapshot, loading, error, setError, refresh } = useGitChangesSnapshot();
  const { operatingKey, bulkLoading, stage, unstage, discard, remove, stageEverything, unstageEverything, revertImage } =
    useGitOps({ refresh, setError });

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  const derived = useMemo(() => deriveGitChanges(snapshot), [snapshot]);
  const grouped = useMemo(() => groupChangesByImage(snapshot), [snapshot]);

  const handleToggleStage = (row: GitChangeRow): void => {
    if (row.source === "staged") {
      void unstage(row.path, row.key);
    } else {
      void stage(row.path, row.key);
    }
  };

  const handleDiscard = (row: GitChangeRow): void => {
    void discard(row.path, row.key);
  };

  const handleDelete = (row: GitChangeRow): void => {
    void remove(row.path, row.key);
  };

  const handleRevertImage = (imageId: string): void => {
    void revertImage(imageId);
  };

  if (!open) return null;

  return (
    <aside
      className={cn(
        "flex flex-col h-full w-72 border-l border-[var(--lumina-border)] bg-[var(--lumina-surface)]",
        "animate-in slide-in-from-right-4 duration-200",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-[var(--lumina-border)]">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-[var(--lumina-muted)]" />
          <span className="text-xs font-medium text-[var(--lumina-text)]">源代码管理</span>
          {derived.counts.total > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-medium">
              {derived.counts.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "files" ? "images" : "files")}
            className={cn(
              "p-1 rounded hover:bg-[var(--lumina-accent-muted)] text-[var(--lumina-muted)] hover:text-[var(--lumina-text)]",
              viewMode === "images" && "text-[var(--lumina-text)] bg-[var(--lumina-accent-muted)]",
            )}
            title={viewMode === "files" ? "按图片分组" : "按文件列表"}
          >
            {viewMode === "files" ? <ImageIcon size={14} /> : <List size={14} />}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || bulkLoading}
            className="p-1 rounded hover:bg-[var(--lumina-accent-muted)] text-[var(--lumina-muted)] hover:text-[var(--lumina-text)]"
            title="刷新"
          >
            <RefreshCw size={14} className={cn((loading || bulkLoading) && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--lumina-accent-muted)] text-[var(--lumina-muted)] hover:text-[var(--lumina-text)]"
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {repoHint && (
        <div className="px-3 py-1.5 border-b border-[var(--lumina-border-subtle)] text-[10px] text-[var(--lumina-muted)]">
          {repoHint}
        </div>
      )}

      <CommitForm
        stagedCount={derived.counts.staged}
        onCommit={onCommit}
        loading={commitLoading}
        disabled={loading || bulkLoading}
      />

      {error && (
        <div className="px-3 py-2 border-b border-rose-500/20 text-[11px] text-rose-500 bg-rose-500/10">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {viewMode === "files" ? (
          <GitChangeList
            stagedRows={derived.stagedRows}
            unstagedRows={derived.unstagedRows}
            operatingKey={operatingKey}
            bulkLoading={bulkLoading}
            onToggleStage={handleToggleStage}
            onDiscard={handleDiscard}
            onDelete={handleDelete}
            onStageAll={() => void stageEverything()}
            onUnstageAll={() => void unstageEverything()}
            collapsible
            stagedExpanded={stagedExpanded}
            unstagedExpanded={unstagedExpanded}
            onToggleStagedExpanded={() => setStagedExpanded((value) => !value)}
            onToggleUnstagedExpanded={() => setUnstagedExpanded((value) => !value)}
            compact
          />
        ) : (
          <>
            {grouped.stagedGroups.length > 0 && (
              <GitImageGroupList
                title="已暂存"
                groups={grouped.stagedGroups}
                ungrouped={grouped.stagedUngrouped}
                onRevertImage={handleRevertImage}
                reverting={bulkLoading}
              />
            )}
            {grouped.unstagedGroups.length > 0 && (
              <GitImageGroupList
                title="更改"
                groups={grouped.unstagedGroups}
                ungrouped={grouped.unstagedUngrouped}
                onRevertImage={handleRevertImage}
                reverting={bulkLoading}
              />
            )}
          </>
        )}

        {!loading && derived.counts.total === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitBranch size={32} className="mb-2 text-[var(--lumina-muted)]/50" />
            <p className="text-xs text-[var(--lumina-muted)]">没有待提交的更改</p>
          </div>
        )}
      </div>
    </aside>
  );
}
