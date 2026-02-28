import React, { useState, useRef, useEffect } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

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
    <div className="flex flex-1 items-center gap-3">
      <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
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

      <div className="relative">
        <Button
          ref={buttonRef}
          variant="outline"
          size="sm"
          className={`h-9 gap-2 border-white/10 bg-white/5 ${isOpen ? "bg-white/10" : ""}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Filters</span>
          {hasActiveFilters && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#c9a962] text-[10px] font-medium text-black">
              {activeFilterTags.length}
            </span>
          )}
        </Button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-50 mt-2 min-w-[320px] rounded-xl border border-white/10 bg-[#0c0e12]/95 p-4 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Filters</span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="text-xs text-white/50 hover:text-white"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="space-y-3">
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

                <div className="border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Sort by</span>
                    <div className="flex items-center gap-2">
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
                  </div>
                </div>
              </div>

              {activeFilterTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                  {activeFilterTags.map((tag) => (
                    <span
                      key={`${tag.type}-${tag.value}`}
                      className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white"
                    >
                      {tag.label}
                      <button
                        type="button"
                        onClick={() => toggleFilter(tag.type, tag.value)}
                        className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-white/20"
                      >
                        <X size={8} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="ml-auto text-xs text-white/50">
        {filteredCount === totalCount
          ? `${totalCount} photos`
          : `${filteredCount} of ${totalCount} photos`}
      </div>
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
  if (options.length === 0) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">{label}</span>
        <span className="text-xs text-white/30">No options</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition-colors hover:bg-white/10"
      >
        <span className="text-white/70">{label}</span>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c9a962] px-1.5 text-[10px] font-medium text-black">
              {selected.length}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-white/10 bg-[#0a0c0f]">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onToggle(option.value)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    selected.includes(option.value)
                      ? "bg-[#c9a962]/15 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  <span className="ml-2 text-white/40">{option.count}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilterBar;
