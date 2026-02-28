import React, { useEffect, useState, useCallback } from "react";
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
  type ChangedFile,
} from "@/lib/tauri/github";

interface ChangesPageProps {
  onCommit: () => void;
  commitLoading?: boolean;
  repoHint?: string;
}

function getStatusIcon(status: string): React.ReactNode {
  switch (status) {
    case "added":
    case "untracked":
      return <FilePlus size={16} className="text-emerald-500" />;
    case "modified":
      return <FileEdit size={16} className="text-amber-500" />;
    case "deleted":
      return <FileX size={16} className="text-rose-500" />;
    default:
      return <FileEdit size={16} className="text-[var(--lumina-muted)]" />;
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

export function ChangesPage({
  onCommit,
  commitLoading = false,
  repoHint,
}: ChangesPageProps): React.ReactElement {
  const [changes, setChanges] = useState<ChangesPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatingFile, setOperatingFile] = useState<string | null>(null);

  const loadChanges = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadChanges();
  }, [loadChanges]);

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

  const stagedFiles = changes?.files.filter((f) => f.staged) || [];
  const unstagedFiles = changes?.files.filter((f) => !f.staged) || [];
  const hasChanges = changes && changes.files.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 px-5 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--lumina-text)]">
              变更管理
            </h1>
            <p className="mt-1 text-sm text-[var(--lumina-muted)]">
              查看和管理本地仓库的文件变更
            </p>
          </div>
          {repoHint && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--lumina-border)] bg-[var(--lumina-surface)] px-3 py-2">
              <GitBranch size={14} className="text-emerald-500" />
              <span className="text-sm text-[var(--lumina-text-secondary)]">
                {repoHint}
              </span>
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
              <>
                {changes && (
                  <div className="flex gap-4 text-sm text-[var(--lumina-muted)]">
                    {changes.total_added > 0 && (
                      <span className="flex items-center gap-1">
                        <FilePlus size={14} className="text-emerald-500" />
                        {changes.total_added} 新增
                      </span>
                    )}
                    {changes.total_modified > 0 && (
                      <span className="flex items-center gap-1">
                        <FileEdit size={14} className="text-amber-500" />
                        {changes.total_modified} 修改
                      </span>
                    )}
                    {changes.total_deleted > 0 && (
                      <span className="flex items-center gap-1">
                        <FileX size={14} className="text-rose-500" />
                        {changes.total_deleted} 删除
                      </span>
                    )}
                    {!hasChanges && (
                      <span className="text-[var(--lumina-muted)]">工作区干净</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadChanges()}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-accent-muted)] hover:text-[var(--lumina-text)]"
              title="刷新"
            >
              <RefreshCw size={16} className={cn(loading && "animate-spin")} />
            </button>
            {unstagedFiles.length > 0 && (
              <button
                type="button"
                onClick={() => void handleStageAll()}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--lumina-border)] px-3 py-1.5 text-sm text-[var(--lumina-text-secondary)] transition-colors hover:bg-[var(--lumina-accent-muted)]"
              >
                <Plus size={14} />
                全部暂存
              </button>
            )}
            {stagedFiles.length > 0 && (
              <button
                type="button"
                onClick={() => void handleUnstageAll()}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--lumina-border)] px-3 py-1.5 text-sm text-[var(--lumina-text-secondary)] transition-colors hover:bg-[var(--lumina-accent-muted)]"
              >
                <Minus size={14} />
                全部取消
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
            {error}
          </div>
        )}

        {loading && !changes && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 size={32} className="animate-spin text-[var(--lumina-muted)]" />
          </div>
        )}

        {!loading && changes && (
          <div className="space-y-4">
            {stagedFiles.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 border-b border-[var(--lumina-border)] bg-emerald-500/5 px-4 py-3">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-sm font-medium text-[var(--lumina-text)]">
                    已暂存的变更
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-500">
                    {stagedFiles.length}
                  </span>
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
              <div className="overflow-hidden rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 border-b border-[var(--lumina-border)] bg-[var(--lumina-surface)] px-4 py-3">
                  <XCircle size={16} className="text-[var(--lumina-muted)]" />
                  <span className="text-sm font-medium text-[var(--lumina-text)]">
                    未暂存的变更
                  </span>
                  <span className="rounded-full bg-[var(--lumina-accent-muted)] px-2 py-0.5 text-xs text-[var(--lumina-muted)]">
                    {unstagedFiles.length}
                  </span>
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

            {!hasChanges && (
              <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 backdrop-blur-sm">
                <CheckCircle2 size={48} className="mb-4 text-emerald-500/50" />
                <p className="text-lg font-medium text-[var(--lumina-text)]">
                  工作区干净
                </p>
                <p className="mt-1 text-sm text-[var(--lumina-muted)]">
                  没有待提交的文件变更
                </p>
              </div>
            )}
          </div>
        )}

        {stagedFiles.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 px-4 py-3 backdrop-blur-sm">
            <span className="text-sm text-[var(--lumina-muted)]">
              {stagedFiles.length} 个文件将被提交
            </span>
            <button
              type="button"
              onClick={onCommit}
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
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--lumina-accent-muted)]">
      {operating ? (
        <Loader2 size={16} className="animate-spin text-[var(--lumina-muted)]" />
      ) : (
        getStatusIcon(file.status)
      )}
      <span
        className="flex-1 truncate font-mono text-sm text-[var(--lumina-text-secondary)]"
        title={file.path}
      >
        {file.path}
      </span>
      <span
        className={cn(
          "rounded px-2 py-0.5 text-xs",
          file.staged
            ? "bg-emerald-500/10 text-emerald-500"
            : "bg-[var(--lumina-accent-muted)] text-[var(--lumina-muted)]",
        )}
      >
        {getStatusLabel(file.status)}
      </span>
      <div className="flex items-center gap-2">
        {file.staged ? (
          <button
            type="button"
            onClick={onUnstage}
            disabled={operating}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--lumina-border)] px-3 text-xs text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text)]"
          >
            <Minus size={14} />
            取消暂存
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onStage}
              disabled={operating}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs text-emerald-600 transition-colors hover:bg-emerald-500/20"
            >
              <Plus size={14} />
              暂存
            </button>
            {!isDeleted && file.status !== "untracked" && (
              <button
                type="button"
                onClick={onDiscard}
                disabled={operating}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-xs text-rose-600 transition-colors hover:bg-rose-500/20"
              >
                <Undo2 size={14} />
                放弃
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}
