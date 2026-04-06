import React from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileEdit,
  FilePlus,
  FileQuestion,
  FileX,
  GitBranch,
  Loader2,
  Minus,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { GitChangeRow } from "../types";

interface GitChangeListProps {
  stagedRows: GitChangeRow[];
  unstagedRows: GitChangeRow[];
  operatingKey: string | null;
  bulkLoading?: boolean;
  onToggleStage: (row: GitChangeRow) => void;
  onDiscard: (row: GitChangeRow) => void;
  onDelete: (row: GitChangeRow) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  collapsible?: boolean;
  stagedExpanded?: boolean;
  unstagedExpanded?: boolean;
  onToggleStagedExpanded?: () => void;
  onToggleUnstagedExpanded?: () => void;
  compact?: boolean;
}

function statusColor(status: string): string {
  switch (status) {
    case "added":
    case "untracked":
      return "text-emerald-500";
    case "modified":
    case "type_changed":
      return "text-amber-500";
    case "deleted":
      return "text-rose-500";
    case "renamed":
    case "copied":
      return "text-sky-500";
    case "unmerged":
      return "text-orange-500";
    default:
      return "text-[var(--lumina-muted)]";
  }
}

function statusChar(status: string): string {
  switch (status) {
    case "added":
      return "A";
    case "untracked":
      return "U";
    case "modified":
      return "M";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "type_changed":
      return "T";
    case "unmerged":
      return "!";
    default:
      return "?";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "added":
      return "新增";
    case "untracked":
      return "未跟踪";
    case "modified":
      return "修改";
    case "deleted":
      return "删除";
    case "renamed":
      return "重命名";
    case "copied":
      return "复制";
    case "type_changed":
      return "类型变更";
    case "unmerged":
      return "冲突";
    default:
      return "未知";
  }
}

function statusIcon(status: string): React.ReactNode {
  switch (status) {
    case "added":
      return <FilePlus size={14} className={statusColor(status)} />;
    case "untracked":
      return <FileQuestion size={14} className={statusColor(status)} />;
    case "deleted":
      return <FileX size={14} className={statusColor(status)} />;
    default:
      return <FileEdit size={14} className={statusColor(status)} />;
  }
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function getDir(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function isStagedRow(row: GitChangeRow): boolean {
  return row.source === "staged";
}

function canDiscard(row: GitChangeRow): boolean {
  return row.source === "unstaged" && !row.untracked;
}

function RowItem({
  row,
  compact,
  operating,
  onToggleStage,
  onDiscard,
  onDelete,
}: {
  row: GitChangeRow;
  compact: boolean;
  operating: boolean;
  onToggleStage: (row: GitChangeRow) => void;
  onDiscard: (row: GitChangeRow) => void;
  onDelete: (row: GitChangeRow) => void;
}): React.ReactElement {
  const dir = getDir(row.path);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-[var(--lumina-accent-muted)] cursor-pointer",
        !compact && "px-4 py-2.5 text-sm rounded-none border-b border-[var(--lumina-border-subtle)]",
        operating && "opacity-50 pointer-events-none",
      )}
      onClick={() => onToggleStage(row)}
    >
      {operating ? (
        <Loader2 size={14} className="animate-spin text-[var(--lumina-muted)]" />
      ) : (
        <span className="flex-shrink-0">{statusIcon(row.status)}</span>
      )}

      <div className="min-w-0 flex-1 flex items-center gap-1">
        <span className="truncate text-[var(--lumina-text)]" title={row.path}>
          {getFileName(row.path)}
        </span>
        {row.oldPath && (
          <span className="truncate text-[10px] text-[var(--lumina-muted)]" title={row.oldPath}>
            {row.oldPath} -&gt;
          </span>
        )}
        {dir && (
          <span className="truncate text-[10px] text-[var(--lumina-muted)]">{dir}</span>
        )}
      </div>

      <span className={cn("text-[10px] font-medium w-4 text-center", statusColor(row.status))}>
        {statusChar(row.status)}
      </span>

      {!compact && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px]",
            isStagedRow(row)
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-[var(--lumina-accent-muted)] text-[var(--lumina-muted)]",
          )}
        >
          {statusLabel(row.status)}
        </span>
      )}

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStage(row);
          }}
          className={cn(
            "p-1 rounded hover:bg-[var(--lumina-surface-elevated)]",
            isStagedRow(row)
              ? "text-[var(--lumina-muted)] hover:text-[var(--lumina-text)]"
              : "text-[var(--lumina-muted)] hover:text-emerald-500",
          )}
          title={isStagedRow(row) ? "取消暂存" : "暂存"}
        >
          {isStagedRow(row) ? <Minus size={12} /> : <Plus size={12} />}
        </button>

        {canDiscard(row) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDiscard(row);
            }}
            className="p-1 rounded hover:bg-[var(--lumina-surface-elevated)] text-[var(--lumina-muted)] hover:text-amber-500"
            title="放弃更改"
          >
            <Undo2 size={12} />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(row);
          }}
          className="p-1 rounded hover:bg-[var(--lumina-surface-elevated)] text-[var(--lumina-muted)] hover:text-rose-500"
          title="删除文件"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export function GitChangeList({
  stagedRows,
  unstagedRows,
  operatingKey,
  bulkLoading = false,
  onToggleStage,
  onDiscard,
  onDelete,
  onStageAll,
  onUnstageAll,
  collapsible = false,
  stagedExpanded = true,
  unstagedExpanded = true,
  onToggleStagedExpanded,
  onToggleUnstagedExpanded,
  compact = false,
}: GitChangeListProps): React.ReactElement {
  const showStaged = !collapsible || stagedExpanded;
  const showUnstaged = !collapsible || unstagedExpanded;

  return (
    <>
      {stagedRows.length > 0 && (
        <div>
          <div
            className={cn(
              "flex items-center justify-between",
              compact
                ? "px-2 py-1.5 hover:bg-[var(--lumina-accent-muted)]"
                : "px-4 py-2 bg-[var(--lumina-accent-muted)]",
              collapsible && "cursor-pointer",
            )}
            onClick={collapsible ? onToggleStagedExpanded : undefined}
          >
            <div className="flex items-center gap-1 text-xs font-medium text-[var(--lumina-text)]">
              {collapsible ? (
                stagedExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <CheckCircle2 size={12} className="text-emerald-500" />
              )}
              <span>已暂存的更改</span>
              <span className="ml-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-500">
                {stagedRows.length}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUnstageAll();
              }}
              disabled={bulkLoading}
              className="p-1 rounded hover:bg-[var(--lumina-surface-elevated)] text-[var(--lumina-muted)] hover:text-[var(--lumina-text)]"
              title="全部取消暂存"
            >
              <Minus size={12} />
            </button>
          </div>

          {showStaged && (
            <div className={cn(compact ? "pb-1" : "")}> 
              {stagedRows.map((row) => (
                <RowItem
                  key={row.key}
                  row={row}
                  compact={compact}
                  operating={operatingKey === row.key}
                  onToggleStage={onToggleStage}
                  onDiscard={onDiscard}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {unstagedRows.length > 0 && (
        <div>
          <div
            className={cn(
              "flex items-center justify-between",
              compact
                ? "px-2 py-1.5 hover:bg-[var(--lumina-accent-muted)]"
                : "px-4 py-2 bg-[var(--lumina-surface)] border-t border-[var(--lumina-border-subtle)]",
              collapsible && "cursor-pointer",
            )}
            onClick={collapsible ? onToggleUnstagedExpanded : undefined}
          >
            <div className="flex items-center gap-1 text-xs font-medium text-[var(--lumina-text)]">
              {collapsible ? (
                unstagedExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <GitBranch size={12} className="text-[var(--lumina-muted)]" />
              )}
              <span>更改</span>
              <span className="ml-1 rounded bg-[var(--lumina-accent-muted)] px-1.5 py-0.5 text-[10px] text-[var(--lumina-muted)]">
                {unstagedRows.length}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStageAll();
              }}
              disabled={bulkLoading}
              className="p-1 rounded hover:bg-[var(--lumina-surface-elevated)] text-[var(--lumina-muted)] hover:text-emerald-500"
              title="全部暂存"
            >
              <Plus size={12} />
            </button>
          </div>

          {showUnstaged && (
            <div className={cn(compact ? "pb-1" : "")}> 
              {unstagedRows.map((row) => (
                <RowItem
                  key={row.key}
                  row={row}
                  compact={compact}
                  operating={operatingKey === row.key}
                  onToggleStage={onToggleStage}
                  onDiscard={onDiscard}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
