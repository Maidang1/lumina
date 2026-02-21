import React from "react";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface ManageToolbarProps {
  viewMode: "grid" | "list";
  selectedCount: number;
  onSelectAllVisible: () => void;
  onChangeViewMode: (mode: "grid" | "list") => void;
}

const ManageToolbar: React.FC<ManageToolbarProps> = ({
  viewMode,
  selectedCount,
  onSelectAllVisible,
  onChangeViewMode,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.08] py-4">
      <h2 className="text-sm font-medium text-lumina-text-secondary">Library Management</h2>
      <div className="flex items-center gap-6 text-sm">
        <Button variant="ghost" className="h-auto p-0 text-white/40 hover:bg-transparent hover:text-white/75" type="button">
          <span className="mr-1">↑</span> Sort by upload time
        </Button>
        <Button variant="ghost" className="h-auto p-0 text-white/40 hover:bg-transparent hover:text-white/75" type="button">
          <span className="mr-1">↓</span> Newest first
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-auto p-0 text-white/40 hover:bg-transparent hover:text-white/75"
          onClick={onSelectAllVisible}
        >
          <div className={`mr-2 h-4 w-4 rounded border transition-colors ${selectedCount > 0 ? "border-lumina-accent bg-lumina-accent" : "border-white/20"}`} />
          Select all
        </Button>
        <div className="ml-4 flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChangeViewMode("grid")}
            className={`h-8 w-8 rounded p-1.5 transition-colors ${
              viewMode === "grid"
                ? "bg-white/[0.12] text-lumina-accent"
                : "text-white/40 hover:text-white/75"
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
                ? "bg-white/[0.12] text-lumina-accent"
                : "text-white/40 hover:text-white/75"
            }`}
          >
            <List size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ManageToolbar;
