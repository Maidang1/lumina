import { useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { Photo } from "@/features/photos/types";

export type SortBy = "date" | "name" | "size";
export type SortOrder = "asc" | "desc";
export type ViewMode = "masonry" | "grid" | "list";

export interface GalleryFilters {
  timeRange?: { start: string; end: string };
  locations: string[];
  cameras: string[];
  categories: string[];
  searchQuery: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  viewMode: ViewMode;
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface AvailableFilters {
  locations: FilterOption[];
  cameras: FilterOption[];
  categories: FilterOption[];
  timeRange: { min: string; max: string };
}

export interface UseGalleryFiltersResult {
  filters: GalleryFilters;
  setFilters: (filters: Partial<GalleryFilters>) => void;
  clearFilters: () => void;
  availableFilters: AvailableFilters;
  filteredPhotos: Photo[];
  totalCount: number;
  hasActiveFilters: boolean;
}

const DEFAULT_FILTERS: GalleryFilters = {
  locations: [],
  cameras: [],
  categories: [],
  searchQuery: "",
  sortBy: "date",
  sortOrder: "desc",
  viewMode: "masonry",
};

export function useGalleryFilters(photos: Photo[]): UseGalleryFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo((): GalleryFilters => {
    const locations = searchParams.get("location")?.split(",").filter(Boolean) || [];
    const cameras = searchParams.get("camera")?.split(",").filter(Boolean) || [];
    const categories = searchParams.get("category")?.split(",").filter(Boolean) || [];
    const searchQuery = searchParams.get("q") || "";
    const sortBy = (searchParams.get("sort") as SortBy) || "date";
    const sortOrder = (searchParams.get("order") as SortOrder) || "desc";
    const viewMode = (searchParams.get("view") as ViewMode) || "masonry";
    const timeStart = searchParams.get("from");
    const timeEnd = searchParams.get("to");

    return {
      locations,
      cameras,
      categories,
      searchQuery,
      sortBy,
      sortOrder,
      viewMode,
      timeRange: timeStart && timeEnd ? { start: timeStart, end: timeEnd } : undefined,
    };
  }, [searchParams]);

  const availableFilters = useMemo((): AvailableFilters => {
    const locationCounts = new Map<string, number>();
    const cameraCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    let minDate = "";
    let maxDate = "";

    for (const photo of photos) {
      if (photo.location) {
        const count = locationCounts.get(photo.location) || 0;
        locationCounts.set(photo.location, count + 1);
      }

      if (photo.exif?.camera) {
        const camera = photo.exif.camera;
        const count = cameraCounts.get(camera) || 0;
        cameraCounts.set(camera, count + 1);
      }

      if (photo.category) {
        const count = categoryCounts.get(photo.category) || 0;
        categoryCounts.set(photo.category, count + 1);
      }

      const dateStr = photo.metadata?.timestamps?.created_at;
      if (dateStr) {
        const month = dateStr.slice(0, 7);
        if (!minDate || month < minDate) minDate = month;
        if (!maxDate || month > maxDate) maxDate = month;
      }
    }

    const toOptions = (map: Map<string, number>): FilterOption[] =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, label: value, count }));

    return {
      locations: toOptions(locationCounts),
      cameras: toOptions(cameraCounts),
      categories: toOptions(categoryCounts),
      timeRange: { min: minDate || "", max: maxDate || "" },
    };
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    let result = [...photos];

    if (filters.locations.length > 0) {
      result = result.filter(
        (p) => p.location && filters.locations.includes(p.location)
      );
    }

    if (filters.cameras.length > 0) {
      result = result.filter(
        (p) => p.exif?.camera && filters.cameras.includes(p.exif.camera)
      );
    }

    if (filters.categories.length > 0) {
      result = result.filter(
        (p) => p.category && filters.categories.includes(p.category)
      );
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.filename.toLowerCase().includes(query) ||
          p.title.toLowerCase().includes(query) ||
          p.visualDescription?.toLowerCase().includes(query) ||
          p.location?.toLowerCase().includes(query)
      );
    }

    if (filters.timeRange) {
      const { start, end } = filters.timeRange;
      result = result.filter((p) => {
        const dateStr = p.metadata?.timestamps?.created_at;
        if (!dateStr) return false;
        const month = dateStr.slice(0, 7);
        return month >= start && month <= end;
      });
    }

    result.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case "date": {
          const dateA = a.metadata?.timestamps?.created_at || "";
          const dateB = b.metadata?.timestamps?.created_at || "";
          comparison = dateA.localeCompare(dateB);
          break;
        }
        case "name":
          comparison = a.filename.localeCompare(b.filename);
          break;
        case "size": {
          const sizeA = a.metadata?.files?.original?.bytes || 0;
          const sizeB = b.metadata?.files?.original?.bytes || 0;
          comparison = sizeA - sizeB;
          break;
        }
      }

      return filters.sortOrder === "desc" ? -comparison : comparison;
    });

    return result;
  }, [photos, filters]);

  const setFilters = useCallback(
    (newFilters: Partial<GalleryFilters>) => {
      const nextParams = new URLSearchParams(searchParams);

      if (newFilters.locations !== undefined) {
        if (newFilters.locations.length > 0) {
          nextParams.set("location", newFilters.locations.join(","));
        } else {
          nextParams.delete("location");
        }
      }

      if (newFilters.cameras !== undefined) {
        if (newFilters.cameras.length > 0) {
          nextParams.set("camera", newFilters.cameras.join(","));
        } else {
          nextParams.delete("camera");
        }
      }

      if (newFilters.categories !== undefined) {
        if (newFilters.categories.length > 0) {
          nextParams.set("category", newFilters.categories.join(","));
        } else {
          nextParams.delete("category");
        }
      }

      if (newFilters.searchQuery !== undefined) {
        if (newFilters.searchQuery) {
          nextParams.set("q", newFilters.searchQuery);
        } else {
          nextParams.delete("q");
        }
      }

      if (newFilters.sortBy !== undefined) {
        if (newFilters.sortBy !== "date") {
          nextParams.set("sort", newFilters.sortBy);
        } else {
          nextParams.delete("sort");
        }
      }

      if (newFilters.sortOrder !== undefined) {
        if (newFilters.sortOrder !== "desc") {
          nextParams.set("order", newFilters.sortOrder);
        } else {
          nextParams.delete("order");
        }
      }

      if (newFilters.viewMode !== undefined) {
        if (newFilters.viewMode !== "masonry") {
          nextParams.set("view", newFilters.viewMode);
        } else {
          nextParams.delete("view");
        }
      }

      if (newFilters.timeRange !== undefined) {
        if (newFilters.timeRange) {
          nextParams.set("from", newFilters.timeRange.start);
          nextParams.set("to", newFilters.timeRange.end);
        } else {
          nextParams.delete("from");
          nextParams.delete("to");
        }
      }

      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    const nextParams = new URLSearchParams();
    const view = searchParams.get("view");
    if (view) nextParams.set("view", view);
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  const hasActiveFilters =
    filters.locations.length > 0 ||
    filters.cameras.length > 0 ||
    filters.categories.length > 0 ||
    !!filters.searchQuery ||
    !!filters.timeRange;

  return {
    filters,
    setFilters,
    clearFilters,
    availableFilters,
    filteredPhotos,
    totalCount: photos.length,
    hasActiveFilters,
  };
}
