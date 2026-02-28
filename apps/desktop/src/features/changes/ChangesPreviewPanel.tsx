import React, { useEffect, useState } from "react";
import {
  FilePlus,
  FileEdit,
  FileX,
  Loader2,
  RefreshCw,
  GitCommit,
  Plus,
  Minus,
  Undo2,
  CheckCircle2,
  XCircle,
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
  type ChangedFile,
} from "@/lib/tauri/github";

interface ChangesPreviewPanelProps {
  open: boolean;
  onClose: () => void;
  onCommit: () => void;
  commitLoading?: boolean;
}

function getStatusIcon(status: string): React.ReactNode {
  switch (status) {
    case "added":
    case "untracked":
      return <FilePlus size={14} className="text-emerald-500" />;
    case "modified":
      return <FileEdit size={14} className="text-amber-500" />;
    case "deleted":
      return <FileX size={14} className="text-rose-500" />;
    default:
      return <FileEdit size={14} className="text-[var(--lumina-muted)]" />;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "added":
      return "新增";
    case "untracked":
      return "未跟踪";
    case "modified":
      return "修改";
    case "deleted":
      return "删除";
    default:
      return status;
  }
}

export function ChangesPreviewPanel({
  open,
  onClose,
  onCommit,
  commitLoading = false,
}: ChangesPreviewPanelProps): React.ReactElement | null {
  const [changes, setChanges] = useState<ChangesPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operatingFile, setOperatingFile] = useState<string | null>(null);

  const loadChanges = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getChangesPreview();
      setChanges(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取变更失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadChanges();
    }
  }, [open]);

  const handleStageFile = async (path: string) => {
    setOperatingFile(path);
    try {
      await stageFile(path);
      await loadChanges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂存失败");
    } finally {
      setOperatingFile(null);
    }
  };

  const handleUnstageFile = async (path: string) => {
    setOperatingFile(path);
    try {
      await unstageFile(path);
      await loadChanges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消暂存失败");
    } finally {
      setOperatingFile(null);
    }
  };

  const handleDiscardFile = async (path: string) => {
    setOperatingFile(path);
    try {
      await discardFile(path);
      await loadChanges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "放弃更改失败");
    } finally {
      setOperatingFile(null);
    }
  };

  const handleStageAll = async () => {
    setLoading(true);
    try {
      await stageAll();
      await loadChanges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "全部暂存失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUnstageAll = async () => {
    setLoading(true);
    try {
      await unstageAll();
      await loadChanges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "全部取消暂存失败");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const hasChanges = changes && changes.files.length > 0;
  const stagedFiles = changes?.files.filter((f) => f.staged) || [];
  const unstagedFiles = changes?.files.filter((f) => !f.staged) || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
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
          <h2 className="text-sm font-medium text-[var(--lumina-text)]">
            变更预览
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadChanges()}
              disabled={loading}
              className="flex h-7 w-7 items-center justify-center rounded text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text)]"
              title="刷新"
            >
              <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            </button>
          </div>
        </header>

        <div className="max-h-[450px] overflow-y-auto">
          {loading && !changes && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[var(--lumina-muted)]" />
            </div>
          )}

          {error && (
            <div className="px-4 py-8 text-center text-sm text-rose-500">
              {error}
            </div>
          )}

          {!loading && !error && changes && (
            <>
              {changes.files.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm text-[var(--lumina-muted)]">
                    没有待提交的变更
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-[var(--lumina-border-subtle)] px-4 py-3">
                    <div className="flex gap-4 text-xs text-[var(--lumina-muted)]">
                      {changes.total_added > 0 && (
                        <span className="flex items-center gap-1">
                          <FilePlus size={12} className="text-emerald-500" />
                          {changes.total_added} 新增
                        </span>
                      )}
                      {changes.total_modified > 0 && (
                        <span className="flex items-center gap-1">
                          <FileEdit size={12} className="text-amber-500" />
                          {changes.total_modified} 修改
                        </span>
                      )}
                      {changes.total_deleted > 0 && (
                        <span className="flex items-center gap-1">
                          <FileX size={12} className="text-rose-500" />
                          {changes.total_deleted} 删除
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unstagedFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleStageAll()}
                          disabled={loading}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text)]"
                          title="全部暂存"
                        >
                          <Plus size={12} />
                          全部暂存
                        </button>
                      )}
                      {stagedFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleUnstageAll()}
                          disabled={loading}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text)]"
                          title="全部取消暂存"
                        >
                          <Minus size={12} />
                          全部取消
                        </button>
                      )}
                    </div>
                  </div>

                  {stagedFiles.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 bg-[var(--lumina-accent-muted)] px-4 py-2 text-xs font-medium text-[var(--lumina-text)]">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        已暂存 ({stagedFiles.length})
                      </div>
                      <ul className="divide-y divide-[var(--lumina-border-subtle)]">
                        {stagedFiles.map((file, index) => (
                          <FileItem
                            key={`staged-${file.path}-${index}`}
                            file={file}
                            operating={operatingFile === file.path}
                            onStage={() => void handleStageFile(file.path)}
                            onUnstage={() => void handleUnstageFile(file.path)}
                            onDiscard={() => void handleDiscardFile(file.path)}
                          />
                        ))}
                      </ul>
                    </div>
                  )}

                  {unstagedFiles.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 bg-[var(--lumina-border-subtle)] px-4 py-2 text-xs font-medium text-[var(--lumina-text-secondary)]">
                        <XCircle size={12} className="text-[var(--lumina-muted)]" />
                        未暂存 ({unstagedFiles.length})
                      </div>
                      <ul className="divide-y divide-[var(--lumina-border-subtle)]">
                        {unstagedFiles.map((file, index) => (
                          <FileItem
                            key={`unstaged-${file.path}-${index}`}
                            file={file}
                            operating={operatingFile === file.path}
                            onStage={() => void handleStageFile(file.path)}
                            onUnstage={() => void handleUnstageFile(file.path)}
                            onDiscard={() => void handleDiscardFile(file.path)}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--lumina-border)] px-4 py-3">
          <span className="text-xs text-[var(--lumina-muted)]">
            {stagedFiles.length > 0
              ? `${stagedFiles.length} 个文件将被提交`
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
              onClick={onCommit}
              disabled={stagedFiles.length === 0 || commitLoading}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                stagedFiles.length > 0 && !commitLoading
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

interface FileItemProps {
  file: ChangedFile;
  operating: boolean;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
}

function FileItem({
  file,
  operating,
  onStage,
  onUnstage,
  onDiscard,
}: FileItemProps): React.ReactElement {
  const isDeleted = file.status === "deleted";

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--lumina-accent-muted)]">
      {operating ? (
        <Loader2 size={14} className="animate-spin text-[var(--lumina-muted)]" />
      ) : (
        getStatusIcon(file.status)
      )}
      <span
        className="flex-1 truncate text-[var(--lumina-text-secondary)]"
        title={file.path}
      >
        {file.path}
      </span>
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[10px]",
          file.staged
            ? "bg-emerald-500/10 text-emerald-500"
            : "bg-[var(--lumina-accent-muted)] text-[var(--lumina-muted)]",
        )}
      >
        {getStatusLabel(file.status)}
      </span>
      <div className="flex items-center gap-1">
        {file.staged ? (
          <button
            type="button"
            onClick={onUnstage}
            disabled={operating}
            className="flex h-7 items-center gap-1 rounded border border-[var(--lumina-border)] px-2 text-xs text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text)]"
            title="取消暂存"
          >
            <Minus size={12} />
            取消
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onStage}
              disabled={operating}
              className="flex h-7 items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 text-xs text-emerald-600 transition-colors hover:bg-emerald-500/20"
              title="暂存"
            >
              <Plus size={12} />
              暂存
            </button>
            {!isDeleted && file.status !== "untracked" && (
              <button
                type="button"
                onClick={onDiscard}
                disabled={operating}
                className="flex h-7 items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 text-xs text-rose-600 transition-colors hover:bg-rose-500/20"
                title="放弃更改"
              >
                <Undo2 size={12} />
                放弃
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}
