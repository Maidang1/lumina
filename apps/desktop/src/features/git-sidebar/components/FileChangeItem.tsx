import React from "react";
import { FilePlus, FileEdit, FileX, FileQuestion, Plus, Minus, Undo2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LegacyChangedFile {
  status: string;
  path: string;
  staged: boolean;
}

interface FileChangeItemProps {
  file: LegacyChangedFile;
  operating?: boolean;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
  onClick?: () => void;
}

function getStatusIcon(status: string, size = 14): React.ReactNode {
  switch (status) {
    case "added":
      return <FilePlus size={size} className="text-emerald-500" />;
    case "untracked":
      return <FileQuestion size={size} className="text-emerald-500" />;
    case "modified":
      return <FileEdit size={size} className="text-amber-500" />;
    case "deleted":
      return <FileX size={size} className="text-rose-500" />;
    default:
      return <FileEdit size={size} className="text-[var(--lumina-muted)]" />;
  }
}

function getStatusChar(status: string): string {
  switch (status) {
    case "added":
      return "A";
    case "untracked":
      return "U";
    case "modified":
      return "M";
    case "deleted":
      return "D";
    default:
      return "?";
  }
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function getFileDir(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

export function FileChangeItem({
  file,
  operating = false,
  onStage,
  onUnstage,
  onDiscard,
  onClick,
}: FileChangeItemProps): React.ReactElement {
  const isDeleted = file.status === "deleted";
  const canDiscard = !isDeleted && file.status !== "untracked";

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2 py-1 text-xs hover:bg-[var(--lumina-accent-muted)] rounded cursor-pointer",
        operating && "opacity-50 pointer-events-none",
      )}
      onClick={onClick}
    >
      {operating ? (
        <Loader2 size={14} className="animate-spin text-[var(--lumina-muted)] flex-shrink-0" />
      ) : (
        <span className="flex-shrink-0">{getStatusIcon(file.status)}</span>
      )}

      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span className="truncate text-[var(--lumina-text)]" title={file.path}>
          {getFileName(file.path)}
        </span>
        {getFileDir(file.path) && (
          <span className="truncate text-[var(--lumina-muted)] text-[10px]">
            {getFileDir(file.path)}
          </span>
        )}
      </div>

      <span
        className={cn(
          "flex-shrink-0 w-4 h-4 flex items-center justify-center rounded text-[10px] font-medium",
          file.status === "added" || file.status === "untracked"
            ? "text-emerald-500"
            : file.status === "modified"
              ? "text-amber-500"
              : file.status === "deleted"
                ? "text-rose-500"
                : "text-[var(--lumina-muted)]",
        )}
      >
        {getStatusChar(file.status)}
      </span>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {file.staged ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnstage?.();
            }}
            className="p-1 rounded hover:bg-[var(--lumina-surface-elevated)] text-[var(--lumina-muted)] hover:text-[var(--lumina-text)]"
            title="取消暂存"
          >
            <Minus size={12} />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStage?.();
              }}
              className="p-1 rounded hover:bg-[var(--lumina-surface-elevated)] text-[var(--lumina-muted)] hover:text-emerald-500"
              title="暂存"
            >
              <Plus size={12} />
            </button>
            {canDiscard && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDiscard?.();
                }}
                className="p-1 rounded hover:bg-[var(--lumina-surface-elevated)] text-[var(--lumina-muted)] hover:text-rose-500"
                title="放弃更改"
              >
                <Undo2 size={12} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
