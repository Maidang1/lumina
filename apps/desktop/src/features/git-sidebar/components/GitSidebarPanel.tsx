import React, { useEffect, useState, useCallback } from "react";
import {
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getChangesPreview,
  stageFile,
  unstageFile,
  discardFile,
  stageAll,
  unstageAll,
  type ChangesPreview,
} from "@/lib/tauri/github";
import { FileChangeItem } from "./FileChangeItem";
import { CommitForm } from "./CommitForm";

interface GitSidebarPanelProps {
  open: boolean;
  onClose: () => void;
  onCommit: () => void;
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
  const [changes, setChanges] = useState<ChangesPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [operatingFile, setOperatingFile] = useState<string | null>(null);
  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [unstagedExpanded, setUnstagedExpanded] = useState(true);

  const loadChanges = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getChangesPreview();
      setChanges(data);
    } catch (err) {
      console.error("Failed to load changes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadChanges();
    }
  }, [open, loadChanges]);

  const handleStageFile = async (path: string) => {
    setOperatingFile(path);
    try {
      await stageFile(path);
      await loadChanges();
    } finally {
      setOperatingFile(null);
    }
  };

  const handleUnstageFile = async (path: string) => {
    setOperatingFile(path);
    try {
      await unstageFile(path);
      await loadChanges();
    } finally {
      setOperatingFile(null);
    }
  };

  const handleDiscardFile = async (path: string) => {
    setOperatingFile(path);
    try {
      await discardFile(path);
      await loadChanges();
    } finally {
      setOperatingFile(null);
    }
  };

  const handleStageAll = async () => {
    setLoading(true);
    try {
      await stageAll();
      await loadChanges();
    } finally {
      setLoading(false);
    }
  };

  const handleUnstageAll = async () => {
    setLoading(true);
    try {
      await unstageAll();
      await loadChanges();
    } finally {
      setLoading(false);
    }
  };

  const stagedFiles = changes?.files.filter((f) => f.staged) || [];
  const unstagedFiles = changes?.files.filter((f) => !f.staged) || [];

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
          <span className="text-xs font-medium text-[var(--lumina-text)]">
            源代码管理
          </span>
          {changes && changes.files.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-medium">
              {changes.files.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void loadChanges()}
            disabled={loading}
            className="p-1 rounded hover:bg-[var(--lumina-accent-muted)] text-[var(--lumina-muted)] hover:text-[var(--lumina-text)]"
            title="刷新"
          >
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
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
        stagedCount={stagedFiles.length}
        onCommit={onCommit}
        loading={commitLoading}
        disabled={loading}
      />

      <div className="flex-1 overflow-y-auto">
        {stagedFiles.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-[var(--lumina-accent-muted)]"
              onClick={() => setStagedExpanded(!stagedExpanded)}
            >
              <div className="flex items-center gap-1 text-xs font-medium text-[var(--lumina-text)]">
                {stagedExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>已暂存的更改</span>
                <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 text-[10px]">
                  {stagedFiles.length}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleUnstageAll();
                }}
                className="p-1 rounded hover:bg-[var(--lumina-surface-elevated)] text-[var(--lumina-muted)] hover:text-[var(--lumina-text)]"
                title="全部取消暂存"
              >
                <Minus size={12} />
              </button>
            </div>
            {stagedExpanded && (
              <div className="pb-1">
                {stagedFiles.map((file) => (
                  <FileChangeItem
                    key={`staged-${file.path}`}
                    file={file}
                    operating={operatingFile === file.path}
                    onUnstage={() => void handleUnstageFile(file.path)}
                    onClick={() => void handleUnstageFile(file.path)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {unstagedFiles.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-[var(--lumina-accent-muted)]"
              onClick={() => setUnstagedExpanded(!unstagedExpanded)}
            >
              <div className="flex items-center gap-1 text-xs font-medium text-[var(--lumina-text)]">
                {unstagedExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>更改</span>
                <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--lumina-accent-muted)] text-[var(--lumina-muted)] text-[10px]">
                  {unstagedFiles.length}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleStageAll();
                }}
                className="p-1 rounded hover:bg-[var(--lumina-surface-elevated)] text-[var(--lumina-muted)] hover:text-emerald-500"
                title="全部暂存"
              >
                <Plus size={12} />
              </button>
            </div>
            {unstagedExpanded && (
              <div className="pb-1">
                {unstagedFiles.map((file) => (
                  <FileChangeItem
                    key={`unstaged-${file.path}`}
                    file={file}
                    operating={operatingFile === file.path}
                    onStage={() => void handleStageFile(file.path)}
                    onDiscard={() => void handleDiscardFile(file.path)}
                    onClick={() => void handleStageFile(file.path)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && changes && changes.files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitBranch size={32} className="mb-2 text-[var(--lumina-muted)]/50" />
            <p className="text-xs text-[var(--lumina-muted)]">没有待提交的更改</p>
          </div>
        )}
      </div>
    </aside>
  );
}
