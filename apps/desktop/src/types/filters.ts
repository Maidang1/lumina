export interface PhotoFilters {
  dateRange?: { start: Date; end: Date };
  cameras?: string[];
  locations?: string[];
  tags?: string[];
  searchQuery?: string;
}

export type SortOption =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "size-desc"
  | "size-asc";

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}
