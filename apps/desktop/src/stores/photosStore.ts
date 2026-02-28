import { create } from "zustand";
import type { Photo } from "@/types/photo";
import type { PhotoFilters, SortOption } from "@/types/filters";

interface PhotosState {
  photos: Photo[];
  isLoading: boolean;
  selectedIds: Set<string>;
  isBatchMode: boolean;

  filters: PhotoFilters;
  sortBy: SortOption;

  selectedPhoto: Photo | null;

  setPhotos: (photos: Photo[]) => void;
  addPhotos: (photos: Photo[]) => void;
  removePhotoById: (id: string) => void;
  setIsLoading: (loading: boolean) => void;

  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setIsBatchMode: (mode: boolean) => void;
  toggleBatchMode: () => void;

  setFilters: (filters: Partial<PhotoFilters>) => void;
  clearFilters: () => void;
  setSortBy: (sort: SortOption) => void;

  setSelectedPhoto: (photo: Photo | null) => void;
}

export const usePhotosStore = create<PhotosState>((set) => ({
  photos: [],
  isLoading: false,
  selectedIds: new Set(),
  isBatchMode: false,

  filters: {},
  sortBy: "date-desc",

  selectedPhoto: null,

  setPhotos: (photos) => set({ photos }),
  addPhotos: (newPhotos) =>
    set((state) => ({ photos: [...state.photos, ...newPhotos] })),
  removePhotoById: (id) =>
    set((state) => ({
      photos: state.photos.filter((p) => p.id !== id),
      selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
    })),
  setIsLoading: (loading) => set({ isLoading: loading }),

  toggleSelect: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedIds: newSet };
    }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),
  setIsBatchMode: (mode) =>
    set({ isBatchMode: mode, selectedIds: mode ? new Set() : new Set() }),
  toggleBatchMode: () =>
    set((state) => ({
      isBatchMode: !state.isBatchMode,
      selectedIds: new Set(),
    })),

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  clearFilters: () => set({ filters: {} }),
  setSortBy: (sort) => set({ sortBy: sort }),

  setSelectedPhoto: (photo) => set({ selectedPhoto: photo }),
}));
