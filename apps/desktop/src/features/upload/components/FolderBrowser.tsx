import React, { useCallback, useEffect, useMemo } from "react";
import { selectDirectory } from "@/lib/tauri/dialog";
import { getFileInfo } from "@/lib/tauri/fs";
import FolderBrowserToolbar from "./FolderBrowserToolbar";
import FolderImageGrid from "./FolderImageGrid";
import { useFolderBrowserStore } from "@/features/upload/hooks/useFolderBrowserStore";
import type { UploadQueueItem } from "@/types/photo";

interface FolderBrowserProps {
  queue: UploadQueueItem[];
  onAddToQueue: (
    files: Array<{
      path: string;
      name: string;
      size: number;
      modified: number;
      mime?: string;
    }>,
  ) => void;
  onBack: () => void;
  initialFolderPath?: string;
}

const FolderBrowser: React.FC<FolderBrowserProps> = ({
  queue,
  onAddToQueue,
  onBack,
  initialFolderPath,
}) => {
  const {
    folderPath,
    images,
    selectedIds,
    isScanning,
    sortField,
    sortDirection,
    recursive,
    scanFolder,
    setRecursive,
    setSortField,
    setSortDirection,
    toggleSelect,
    rangeSelect,
    addToSelect,
    selectAll,
    deselectAll,
    selectedCount,
    totalCount,
  } = useFolderBrowserStore();

  // Set of paths already in the upload queue
  const queuedPaths = useMemo(() => {
    const paths = new Set<string>();
    for (const item of queue) {
      if (item.sourcePath) {
        paths.add(item.sourcePath);
      }
    }
    return paths;
  }, [queue]);

  // Auto-scan on mount if initialFolderPath is provided
  useEffect(() => {
    if (initialFolderPath && !folderPath) {
      void scanFolder(initialFolderPath);
    }
  }, [initialFolderPath, folderPath, scanFolder]);

  const handleChangeFolder = useCallback(async () => {
    const path = await selectDirectory();
    if (path) {
      await scanFolder(path);
    }
  }, [scanFolder]);

  const handleSelectFolder = useCallback(async () => {
    const path = await selectDirectory();
    if (path) {
      await scanFolder(path);
    }
  }, [scanFolder]);

  // Re-scan when recursive toggle changes
  const handleRecursiveChange = useCallback(
    (newRecursive: boolean) => {
      setRecursive(newRecursive);
      if (folderPath) {
        void scanFolder(folderPath, newRecursive);
      }
    },
    [folderPath, scanFolder, setRecursive],
  );

  const handleAddToQueue = useCallback(async () => {
    const selectedImages = images.filter(
      (img) => selectedIds.has(img.path) && !queuedPaths.has(img.path),
    );
    if (selectedImages.length === 0) return;

    const enrichedFiles = await Promise.all(
      selectedImages.map(async (img) => {
        try {
          const info = await getFileInfo(img.path);
          return {
            path: img.path,
            name: img.name,
            size: Number(info.size || img.sizeBytes),
            modified: Number(
              info.modified || Math.floor(img.modifiedAt),
            ),
            mime: img.mimeType,
          };
        } catch {
          return {
            path: img.path,
            name: img.name,
            size: img.sizeBytes,
            modified: img.modifiedAt,
            mime: img.mimeType,
          };
        }
      }),
    );

    onAddToQueue(enrichedFiles);
    deselectAll();
  }, [images, selectedIds, queuedPaths, onAddToQueue, deselectAll]);

  // Show folder selection prompt if no folder is selected
  if (!folderPath && !isScanning) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--lumina-border-subtle)] text-[var(--lumina-muted)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              <path d="M12 10v6" />
              <path d="m9 13 3-3 3 3" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-medium text-[var(--lumina-text)]">
            选择文件夹浏览图片
          </h2>
          <p className="mb-6 text-sm text-[var(--lumina-muted)]">
            选择包含图片的文件夹，预览并批量选择要上传的照片
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleSelectFolder()}
              className="rounded-lg bg-[var(--lumina-text)] px-6 py-2.5 text-sm font-medium text-[var(--lumina-bg)] transition-all hover:opacity-90"
            >
              选择文件夹
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-[var(--lumina-border)] px-6 py-2.5 text-sm font-medium text-[var(--lumina-text-secondary)] transition-all hover:bg-[var(--lumina-surface-elevated)]"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Sticky toolbar — stays pinned at top of scroll container */}
      <div className="sticky -top-4 z-20 -mx-4 bg-[var(--lumina-bg)] px-4 pt-4">
        <FolderBrowserToolbar
          folderPath={folderPath}
          totalCount={totalCount}
          selectedCount={selectedCount}
          sortField={sortField}
          sortDirection={sortDirection}
          recursive={recursive}
          isScanning={isScanning}
          onChangeFolder={() => void handleChangeFolder()}
          onSortFieldChange={setSortField}
          onSortDirectionToggle={() =>
            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
          }
          onRecursiveChange={handleRecursiveChange}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onAddToQueue={() => void handleAddToQueue()}
          onBack={onBack}
        />
      </div>

      <div className="pt-3">
        <FolderImageGrid
          images={images}
          selectedIds={selectedIds}
          queuedPaths={queuedPaths}
          isScanning={isScanning}
          onToggleSelect={toggleSelect}
          onRangeSelect={rangeSelect}
          onAddToSelect={addToSelect}
        />
      </div>

      {/* Sticky status bar */}
      {totalCount > 0 && (
        <div className="sticky -bottom-4 -mx-4 border-t border-[var(--lumina-border-subtle)] bg-[var(--lumina-bg)] px-8 py-2">
          <p className="text-xs text-[var(--lumina-muted)]">
            共 {totalCount} 张图片
            {selectedCount > 0 && ` · 已选 ${selectedCount} 张`}
            {queuedPaths.size > 0 &&
              ` · ${queuedPaths.size} 张已在队列中`}
          </p>
        </div>
      )}
    </div>
  );
};

export default FolderBrowser;
