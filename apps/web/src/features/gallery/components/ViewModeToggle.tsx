import React from "react";
import { LayoutGrid, List, Rows3 } from "lucide-react";
import type { ViewMode } from "../hooks/useGalleryFilters";

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  viewMode,
  onChange,
}) => {
  const modes: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
    { value: "masonry", icon: <Rows3 size={14} />, label: "Masonry" },
    { value: "grid", icon: <LayoutGrid size={14} />, label: "Grid" },
    { value: "list", icon: <List size={14} />, label: "List" },
  ];

  return (
    <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-1">
      {modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          onClick={() => onChange(mode.value)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            viewMode === mode.value
              ? "bg-white/12 text-white"
              : "text-white/45 hover:text-white/75"
          }`}
          title={mode.label}
        >
          {mode.icon}
          <span className="hidden sm:inline">{mode.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ViewModeToggle;
