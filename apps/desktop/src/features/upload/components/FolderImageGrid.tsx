import React, { useCallback, useRef } from "react";
import { ImageOff } from "lucide-react";
import FolderImageCard from "./FolderImageCard";
import type { FolderImage } from "@/features/upload/hooks/useFolderBrowserStore";

interface FolderImageGridProps {
  images: FolderImage[];
  selectedIds: Set<string>;
  queuedPaths: Set<string>;
  isScanning: boolean;
  onToggleSelect: (path: string) => void;
  onRangeSelect: (path: string) => void;
  onAddToSelect: (path: string) => void;
}

const FolderImageGrid: React.FC<FolderImageGridProps> = ({
  images,
  selectedIds,
  queuedPaths,
  isScanning,
  onToggleSelect,
  onRangeSelect,
  onAddToSelect,
}) => {
  // Use refs for the callbacks so inline handlers are stable per path via the single dispatch
  const selectHandlers = useRef(onToggleSelect);
  const rangeHandlers = useRef(onRangeSelect);
  const addHandlers = useRef(onAddToSelect);
  selectHandlers.current = onToggleSelect;
  rangeHandlers.current = onRangeSelect;
  addHandlers.current = onAddToSelect;

  // Single stable click dispatcher — avoids creating N inline closures in the map
  const handleCardClick = useCallback(
    (path: string, e: React.MouseEvent) => {
      if (e.shiftKey) {
        rangeHandlers.current(path);
      } else if (e.metaKey || e.ctrlKey) {
        addHandlers.current(path);
      } else {
        selectHandlers.current(path);
      }
    },
    [],
  );

  if (isScanning) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--lumina-muted)] border-t-[var(--lumina-text)]" />
          <p className="text-sm text-[var(--lumina-muted)]">正在扫描文件夹…</p>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <ImageOff size={40} className="text-[var(--lumina-muted)]" />
          <p className="text-sm text-[var(--lumina-muted)]">
            未找到图片文件
          </p>
          <p className="text-xs text-[var(--lumina-muted)]">
            支持 JPG、PNG、WebP、HEIC、HEIF、AVIF 等格式
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
      {images.map((image) => (
        <FolderImageCard
          key={image.path}
          image={image}
          isSelected={selectedIds.has(image.path)}
          isInQueue={queuedPaths.has(image.path)}
          onCardClick={handleCardClick}
        />
      ))}
    </div>
  );
};

export default FolderImageGrid;
