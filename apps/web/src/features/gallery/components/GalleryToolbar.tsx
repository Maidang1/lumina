import React from "react";
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
}

const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
  filters,
  availableFilters,
  onFiltersChange,
  onClearFilters,
  hasActiveFilters,
  filteredCount,
  totalCount,
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
    </div>
  );
};

export default GalleryToolbar;
