import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Undo2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ImageGroup, GitChangeRow } from "../types";

interface GitImageGroupListProps {
  title: string;
  groups: ImageGroup[];
  ungrouped: GitChangeRow[];
  onRevertImage: (imageId: string) => void;
  reverting: boolean;
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
    default:
      return "?";
  }
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function truncateHash(imageId: string): string {
  const hash = imageId.replace("sha256:", "");
  return hash.slice(0, 8);
}

function ImageGroupCard({
  group,
  onRevert,
  reverting,
  compact,
}: {
  group: ImageGroup;
  onRevert: (imageId: string) => void;
  reverting: boolean;
  compact?: boolean;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[var(--lumina-border-subtle)] last:border-b-0">
      <div
        className={cn(
          "group flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--lumina-accent-muted)] cursor-pointer",
          !compact && "px-3 py-2",
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown size={12} className="text-[var(--lumina-muted)] flex-shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-[var(--lumina-muted)] flex-shrink-0" />
        )}

        <ImageIcon size={14} className="text-[var(--lumina-muted)] flex-shrink-0" />

        <span className="flex-1 min-w-0 truncate text-xs text-[var(--lumina-text)]" title={group.imageId}>
          {truncateHash(group.imageId)}
        </span>

        <span className="text-[10px] text-[var(--lumina-muted)]">
          {group.rows.length} 文件
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm("确定要撤销此图片的所有文件吗？")) {
              onRevert(group.imageId);
            }
          }}
          disabled={reverting}
          className={cn(
            "p-1 rounded opacity-0 transition-opacity group-hover:opacity-100",
            "hover:bg-amber-500/10 text-amber-500/70 hover:text-amber-400",
            reverting && "opacity-50 pointer-events-none",
          )}
          title="撤销此图片"
        >
          {reverting ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />}
        </button>
      </div>

      {expanded && (
        <div className="pl-7 pb-1">
          {group.rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center gap-2 px-2 py-0.5 text-[11px] text-[var(--lumina-muted)]"
            >
              <span className={cn("w-3 text-center text-[10px] font-medium", statusColor(row.status))}>
                {statusChar(row.status)}
              </span>
              <span className="truncate" title={row.path}>
                {getFileName(row.path)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GitImageGroupList({
  title,
  groups,
  ungrouped,
  onRevertImage,
  reverting,
  compact = true,
}: GitImageGroupListProps): React.ReactElement | null {
  const totalItems = groups.length + ungrouped.length;
  if (totalItems === 0) return null;

  return (
    <div>
      <div className={cn("px-2 py-1.5 text-xs font-medium text-[var(--lumina-text)]", !compact && "px-3 py-2")}>
        <span>{title}</span>
        <span className="ml-2 rounded bg-[var(--lumina-accent-muted)] px-1.5 py-0.5 text-[10px] text-[var(--lumina-muted)]">
          {groups.length} 图片 / {groups.reduce((s, g) => s + g.rows.length, 0) + ungrouped.length} 文件
        </span>
      </div>

      {groups.map((group) => (
        <ImageGroupCard
          key={group.imageId}
          group={group}
          onRevert={onRevertImage}
          reverting={reverting}
          compact={compact}
        />
      ))}

      {ungrouped.length > 0 && (
        <div className="border-t border-[var(--lumina-border-subtle)]">
          <div className="px-2 py-1 text-[10px] font-medium text-[var(--lumina-muted)]">
            其他文件
          </div>
          {ungrouped.map((row) => (
            <div
              key={row.key}
              className="flex items-center gap-2 px-4 py-0.5 text-[11px] text-[var(--lumina-muted)]"
            >
              <span className={cn("w-3 text-center text-[10px] font-medium", statusColor(row.status))}>
                {statusChar(row.status)}
              </span>
              <span className="truncate" title={row.path}>
                {row.path}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
