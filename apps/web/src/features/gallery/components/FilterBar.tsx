import React, { useState } from "react";
import { ChevronDown, X, Search, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type {
  GalleryFilters,
  FilterOption,
  AvailableFilters,
} from "../hooks/useGalleryFilters";

interface FilterBarProps {
  filters: GalleryFilters;
  availableFilters: AvailableFilters;
  onFiltersChange: (filters: Partial<GalleryFilters>) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
}

const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  availableFilters,
  onFiltersChange,
  onClearFilters,
  hasActiveFilters,
  filteredCount,
  totalCount,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleFilter = (
    type: "locations" | "cameras" | "categories",
    value: string
  ) => {
    const current = filters[type];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ [type]: next });
  };

  const activeFilterTags = [
    ...filters.locations.map((v) => ({ type: "locations" as const, value: v, label: v })),
    ...filters.cameras.map((v) => ({ type: "cameras" as const, value: v, label: v })),
    ...filters.categories.map((v) => ({ type: "categories" as const, value: v, label: v })),
  ];

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
          />
          <Input
            type="text"
            placeholder="Search photos..."
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
            className="h-9 bg-white/5 border-white/10 pl-9 text-sm placeholder:text-white/30"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-2 border-white/10 bg-white/5 ${isExpanded ? "bg-white/10" : ""}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <SlidersHorizontal size={14} />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#c9a962] text-[10px] font-medium text-black">
              {activeFilterTags.length}
            </span>
          )}
        </Button>

        <div className="ml-auto text-xs text-white/50">
          {filteredCount === totalCount
            ? `${totalCount} photos`
            : `${filteredCount} of ${totalCount} photos`}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <FilterDropdown
                label="Location"
                options={availableFilters.locations}
                selected={filters.locations}
                onToggle={(v) => toggleFilter("locations", v)}
                isOpen={openDropdown === "location"}
                onOpenChange={(open) =>
                  setOpenDropdown(open ? "location" : null)
                }
              />

              <FilterDropdown
                label="Camera"
                options={availableFilters.cameras}
                selected={filters.cameras}
                onToggle={(v) => toggleFilter("cameras", v)}
                isOpen={openDropdown === "camera"}
                onOpenChange={(open) => setOpenDropdown(open ? "camera" : null)}
              />

              <FilterDropdown
                label="Category"
                options={availableFilters.categories}
                selected={filters.categories}
                onToggle={(v) => toggleFilter("categories", v)}
                isOpen={openDropdown === "category"}
                onOpenChange={(open) =>
                  setOpenDropdown(open ? "category" : null)
                }
              />

              <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                <span className="text-xs text-white/50">Sort:</span>
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    onFiltersChange({
                      sortBy: e.target.value as GalleryFilters["sortBy"],
                    })
                  }
                  className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white"
                >
                  <option value="date">Date</option>
                  <option value="name">Name</option>
                  <option value="size">Size</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    onFiltersChange({
                      sortOrder: filters.sortOrder === "desc" ? "asc" : "desc",
                    })
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10"
                >
                  {filters.sortOrder === "desc" ? "↓" : "↑"}
                </button>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-8 text-xs text-white/60 hover:text-white"
                  onClick={onClearFilters}
                >
                  Clear all
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeFilterTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilterTags.map((tag) => (
            <span
              key={`${tag.type}-${tag.value}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white"
            >
              {tag.label}
              <button
                type="button"
                onClick={() => toggleFilter(tag.type, tag.value)}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/20"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  options,
  selected,
  onToggle,
  isOpen,
  onOpenChange,
}) => {
  if (options.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className={`flex h-8 items-center gap-2 rounded-md border px-3 text-xs transition-colors ${
          selected.length > 0
            ? "border-[#c9a962]/50 bg-[#c9a962]/10 text-white"
            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#c9a962] text-[10px] font-medium text-black">
            {selected.length}
          </span>
        )}
        <ChevronDown
          size={12}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-[180px] overflow-auto rounded-lg border border-white/10 bg-[#0f1115] p-1 shadow-xl"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggle(option.value)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${
                  selected.includes(option.value)
                    ? "bg-[#c9a962]/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="truncate">{option.label}</span>
                <span className="ml-2 text-white/40">{option.count}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilterBar;
