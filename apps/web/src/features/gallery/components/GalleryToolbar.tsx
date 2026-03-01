import React from "react";
import { BarChart3 } from "lucide-react";
import FilterBar from "./FilterBar";
import ViewModeToggle from "./ViewModeToggle";
import type {
  GalleryFilters,
  AvailableFilters,
  ViewMode,
} from "../hooks/useGalleryFilters";

interface GalleryToolbarProps {
  filters: GalleryFilters;
  availableFilters: AvailableFilters;
  onFiltersChange: (filters: Partial<GalleryFilters>) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
  onOpenExifStats?: () => void;
}

const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
  filters,
  availableFilters,
  onFiltersChange,
  onClearFilters,
  hasActiveFilters,
  filteredCount,
  totalCount,
  onOpenExifStats,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ViewModeToggle
        viewMode={filters.viewMode}
        onChange={(mode: ViewMode) => onFiltersChange({ viewMode: mode })}
      />
      <FilterBar
        filters={filters}
        availableFilters={availableFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={onClearFilters}
        hasActiveFilters={hasActiveFilters}
        filteredCount={filteredCount}
        totalCount={totalCount}
      />
      {onOpenExifStats && (
        <button
          type="button"
          onClick={onOpenExifStats}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/45 transition-colors hover:text-white/75"
          title="EXIF Statistics"
        >
          <BarChart3 size={14} />
          <span className="hidden sm:inline">Stats</span>
        </button>
      )}
    </div>
  );
};

export default GalleryToolbar;
