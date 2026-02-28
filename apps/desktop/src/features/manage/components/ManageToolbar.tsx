import React from "react";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ManageToolbarProps {
  viewMode: "grid" | "list";
  isBatchMode: boolean;
  selectedCount: number;
  onSelectAllVisible: () => void;
  onChangeViewMode: (mode: "grid" | "list") => void;
  onToggleBatchMode: () => void;
}

const ManageToolbar: React.FC<ManageToolbarProps> = ({
  viewMode,
  isBatchMode,
  selectedCount,
  onSelectAllVisible,
  onChangeViewMode,
  onToggleBatchMode,
}) => {
  return (
    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-[var(--muted-foreground)]">照片库</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleBatchMode}
            className={`h-8 rounded px-3 text-xs transition-colors ${
              isBatchMode
                ? "bg-white/[0.12] text-[var(--primary)]"
                : "text-white/50 hover:text-white"
            }`}
          >
            {isBatchMode ? "退出批量" : "批量选择"}
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChangeViewMode("grid")}
            className={`h-8 w-8 rounded p-1.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-white/[0.12] text-[var(--primary)]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <LayoutGrid size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChangeViewMode("list")}
            className={`h-8 w-8 rounded p-1.5 transition-colors ${
                viewMode === "list"
                  ? "bg-white/[0.12] text-[var(--primary)]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <List size={16} />
            </Button>
          </div>
        </div>
      </div>
      {isBatchMode && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Button
            type="button"
            variant="ghost"
            className="h-auto p-0 text-white/50 hover:bg-transparent hover:text-white"
            onClick={onSelectAllVisible}
          >
            <div className={`mr-2 h-4 w-4 rounded border transition-colors ${selectedCount > 0 ? "border-[var(--primary)] bg-[var(--primary)]" : "border-white/20"}`} />
            全选
          </Button>
        </div>
      )}
    </div>
  );
};

export default ManageToolbar;
