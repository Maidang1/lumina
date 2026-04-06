import { useCallback, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { scanFolderImages, type FolderImageInfo } from "@/lib/tauri/fs";
import { generatePreviewForUnsupported } from "@/lib/tauri/image";

export type SortField = "name" | "date" | "size";
export type SortDirection = "asc" | "desc";

export interface FolderImage extends FolderImageInfo {
  previewUrl: string;
  isPreviewLoading: boolean;
}

interface UseFolderBrowserStoreResult {
  folderPath: string | null;
  images: FolderImage[];
  selectedIds: Set<string>;
  isScanning: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  recursive: boolean;
  lastClickedIndex: number | null;
  scanFolder: (path: string, recursiveOverride?: boolean) => Promise<void>;
  setRecursive: (recursive: boolean) => void;
  setSortField: (field: SortField) => void;
  setSortDirection: (direction: SortDirection) => void;
  toggleSelect: (path: string) => void;
  rangeSelect: (path: string) => void;
  addToSelect: (path: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectedCount: number;
  totalCount: number;
}

function sortImages(
  images: FolderImage[],
  field: SortField,
  direction: SortDirection,
): FolderImage[] {
  const sorted = [...images];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "date":
        cmp = a.modifiedAt - b.modifiedAt;
        break;
      case "size":
        cmp = a.sizeBytes - b.sizeBytes;
        break;
    }
    return direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}

export function useFolderBrowserStore(): UseFolderBrowserStoreResult {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [rawImages, setRawImages] = useState<FolderImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [recursive, setRecursive] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const scanAbortRef = useRef(0);

  const images = useMemo(
    () => sortImages(rawImages, sortField, sortDirection),
    [rawImages, sortField, sortDirection],
  );

  // Reset lastClickedIndex when sort changes to prevent stale range selection
  const handleSetSortField = useCallback((field: SortField) => {
    setSortField(field);
    setLastClickedIndex(null);
  }, []);

  const handleSetSortDirection = useCallback((direction: SortDirection) => {
    setSortDirection(direction);
    setLastClickedIndex(null);
  }, []);

  const scanFolder = useCallback(
    async (path: string, recursiveOverride?: boolean): Promise<void> => {
      const useRecursive = recursiveOverride ?? recursive;
      const scanId = ++scanAbortRef.current;
      setIsScanning(true);
      setSelectedIds(new Set());
      setLastClickedIndex(null);
      setFolderPath(path);

      try {
        const result = await scanFolderImages(path, useRecursive);

        if (scanAbortRef.current !== scanId) return;

        const folderImages: FolderImage[] = result.map((info) => ({
          ...info,
          previewUrl: info.isBrowserSupported
            ? convertFileSrc(info.path)
            : "",
          isPreviewLoading: !info.isBrowserSupported,
        }));

        setRawImages(folderImages);

        // Generate previews for unsupported formats (HEIC/HEIF)
        const unsupportedPaths = result
          .filter((img) => !img.isBrowserSupported)
          .map((img) => img.path);

        if (unsupportedPaths.length > 0) {
          try {
            const previews =
              await generatePreviewForUnsupported(unsupportedPaths);
            if (scanAbortRef.current !== scanId) return;

            const previewMap = new Map<string, string>();
            for (const preview of previews) {
              if (preview.success && preview.previewPath) {
                previewMap.set(
                  preview.originalPath,
                  convertFileSrc(preview.previewPath),
                );
              }
            }

            setRawImages((prev) =>
              prev.map((img) => {
                const url = previewMap.get(img.path);
                if (url) {
                  return { ...img, previewUrl: url, isPreviewLoading: false };
                }
                if (!img.isBrowserSupported) {
                  return { ...img, isPreviewLoading: false };
                }
                return img;
              }),
            );
          } catch {
            if (scanAbortRef.current !== scanId) return;
            setRawImages((prev) =>
              prev.map((img) =>
                img.isBrowserSupported
                  ? img
                  : { ...img, isPreviewLoading: false },
              ),
            );
          }
        }
      } catch (e) {
        if (scanAbortRef.current !== scanId) return;
        console.error("Failed to scan folder:", e);
        setRawImages([]);
      } finally {
        if (scanAbortRef.current === scanId) {
          setIsScanning(false);
        }
      }
    },
    [recursive],
  );

  const toggleSelect = useCallback(
    (path: string) => {
      // Normal click: toggle item in selection (allow multi-select by clicking)
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
      const idx = images.findIndex((img) => img.path === path);
      setLastClickedIndex(idx >= 0 ? idx : null);
    },
    [images],
  );

  const rangeSelect = useCallback(
    (path: string) => {
      const currentIndex = images.findIndex((img) => img.path === path);
      if (currentIndex < 0) return;

      const startIndex = lastClickedIndex ?? 0;
      const from = Math.min(startIndex, currentIndex);
      const to = Math.max(startIndex, currentIndex);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = from; i <= to; i++) {
          next.add(images[i].path);
        }
        return next;
      });
      setLastClickedIndex(currentIndex);
    },
    [images, lastClickedIndex],
  );

  const addToSelect = useCallback(
    (path: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
      const idx = images.findIndex((img) => img.path === path);
      setLastClickedIndex(idx >= 0 ? idx : null);
    },
    [images],
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(images.map((img) => img.path)));
  }, [images]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
  }, []);

  return {
    folderPath,
    images,
    selectedIds,
    isScanning,
    sortField,
    sortDirection,
    recursive,
    lastClickedIndex,
    scanFolder,
    setRecursive,
    setSortField: handleSetSortField,
    setSortDirection: handleSetSortDirection,
    toggleSelect,
    rangeSelect,
    addToSelect,
    selectAll,
    deselectAll,
    selectedCount: selectedIds.size,
    totalCount: images.length,
  };
}
