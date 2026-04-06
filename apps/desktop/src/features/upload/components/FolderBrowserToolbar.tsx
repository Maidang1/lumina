import React from "react";
import {
  FolderOpen,
  ArrowUpDown,
  CheckSquare2,
  Square,
  Plus,
  FolderTree,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type {
  SortField,
  SortDirection,
} from "@/features/upload/hooks/useFolderBrowserStore";

interface FolderBrowserToolbarProps {
  folderPath: string | null;
  totalCount: number;
  selectedCount: number;
  sortField: SortField;
  sortDirection: SortDirection;
  recursive: boolean;
  isScanning: boolean;
  onChangeFolder: () => void;
  onSortFieldChange: (field: SortField) => void;
  onSortDirectionToggle: () => void;
  onRecursiveChange: (recursive: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAddToQueue: () => void;
  onBack: () => void;
}

const sortFieldLabels: Record<SortField, string> = {
  date: "日期",
  name: "名称",
  size: "大小",
};

const FolderBrowserToolbar: React.FC<FolderBrowserToolbarProps> = ({
  folderPath,
  totalCount,
  selectedCount,
  sortField,
  sortDirection,
  recursive,
  isScanning,
  onChangeFolder,
  onSortFieldChange,
  onSortDirectionToggle,
  onRecursiveChange,
  onSelectAll,
  onDeselectAll,
  onAddToQueue,
  onBack,
}) => {
  const folderName = folderPath?.split("/").filter(Boolean).pop() ?? "";

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--lumina-border-subtle)] px-4 pb-3">
      {/* Top row: folder info + back */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <FolderOpen size={16} className="shrink-0 text-[var(--lumina-muted)]" />
          <span className="truncate text-sm font-medium text-[var(--lumina-text)]">
            {folderName || "选择文件夹"}
          </span>
          {totalCount > 0 && (
            <span className="shrink-0 text-xs text-[var(--lumina-muted)]">
              {totalCount} 张图片
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-md px-3 py-1 text-xs text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-surface)] hover:text-[var(--lumina-text)]"
        >
          返回
        </button>
      </div>

      {/* Bottom row: controls */}
      <div className="flex items-center gap-2">
        {/* Change folder */}
        <button
          type="button"
          onClick={onChangeFolder}
          disabled={isScanning}
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-[var(--lumina-border)] px-2.5 py-1 text-xs transition-colors",
            "text-[var(--lumina-text-secondary)] hover:bg-[var(--lumina-surface-elevated)] hover:text-[var(--lumina-text)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <FolderOpen size={12} />
          更换文件夹
        </button>

        {/* Recursive toggle */}
        <button
          type="button"
          onClick={() => onRecursiveChange(!recursive)}
          disabled={isScanning}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
            recursive
              ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
              : "border-[var(--lumina-border)] text-[var(--lumina-text-secondary)] hover:bg-[var(--lumina-surface-elevated)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <FolderTree size={12} />
          包含子文件夹
        </button>

        {/* Sort */}
        <div className="flex items-center">
          <select
            value={sortField}
            onChange={(e) => onSortFieldChange(e.target.value as SortField)}
            className="h-7 rounded-l-md border border-r-0 border-[var(--lumina-border)] bg-[var(--lumina-surface)] px-2 text-xs text-[var(--lumina-text-secondary)] outline-none"
          >
            {(Object.keys(sortFieldLabels) as SortField[]).map((field) => (
              <option key={field} value={field}>
                {sortFieldLabels[field]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onSortDirectionToggle}
            className="flex h-7 items-center rounded-r-md border border-[var(--lumina-border)] px-1.5 text-[var(--lumina-text-secondary)] hover:bg-[var(--lumina-surface-elevated)]"
            title={sortDirection === "asc" ? "升序" : "降序"}
          >
            <ArrowUpDown size={12} />
          </button>
        </div>

        <div className="flex-1" />

        {/* Select all / deselect all */}
        {totalCount > 0 && (
          <button
            type="button"
            onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-[var(--lumina-muted)] transition-colors hover:bg-[var(--lumina-surface)] hover:text-[var(--lumina-text)]"
          >
            {selectedCount === totalCount ? (
              <>
                <Square size={12} />
                取消全选
              </>
            ) : (
              <>
                <CheckSquare2 size={12} />
                全选
              </>
            )}
          </button>
        )}

        {/* Add to queue button */}
        <button
          type="button"
          onClick={onAddToQueue}
          disabled={selectedCount === 0}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-all",
            "bg-[var(--lumina-text)] text-[var(--lumina-bg)]",
            "hover:opacity-90",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Plus size={12} />
          添加 {selectedCount > 0 ? `${selectedCount} 张` : ""}到上传队列
        </button>
      </div>
    </div>
  );
};

export default FolderBrowserToolbar;
