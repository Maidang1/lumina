import React from "react";
import { Photo, PhotoOpenTransition } from "@/types/photo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PhotoListProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo, transitionSource: PhotoOpenTransition) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (photoId: string) => void;
}

const PhotoList: React.FC<PhotoListProps> = ({
  photos,
  onPhotoClick,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}) => {
  const handleRowClick = (photo: Photo, e: React.MouseEvent) => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(photo.id);
      return;
    }

    if (onPhotoClick) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onPhotoClick(photo, {
        photoId: photo.id,
        left: rect.left + 8,
        top: rect.top + 8,
        width: 48,
        height: 48,
        borderRadius: 4,
        sourceScale: window.visualViewport?.scale ?? 1,
        sourceViewportWidth: window.innerWidth,
        sourceViewportHeight: window.innerHeight,
        capturedAt: Date.now(),
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 backdrop-blur-sm">
    <Table className="text-left text-sm text-[var(--lumina-text-secondary)]">
      <TableHeader className="bg-[var(--lumina-surface)] text-xs uppercase text-[var(--lumina-muted)]">
        <TableRow>
          <TableHead className="px-4 py-3 font-medium">Preview</TableHead>
          <TableHead className="px-4 py-3 font-medium">Filename</TableHead>
          <TableHead className="px-4 py-3 font-medium">Capture Time</TableHead>
          <TableHead className="px-4 py-3 font-medium">Dimensions</TableHead>
          <TableHead className="px-4 py-3 font-medium">Size</TableHead>
          <TableHead className="px-4 py-3 font-medium">Category</TableHead>
          <TableHead className="px-4 py-3 font-medium">Description</TableHead>
          <TableHead className="px-4 py-3 font-medium">Camera/Lens</TableHead>
          <TableHead className="px-4 py-3 font-medium">Settings</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-[var(--lumina-border-subtle)]">
        {photos.map((photo) => {
          const isSelected = selectedIds.has(photo.id);

          return (
            <TableRow
              key={photo.id}
              onClick={(e) => handleRowClick(photo, e)}
              className={`group cursor-pointer transition-colors hover:bg-[var(--lumina-accent-muted)] ${
                isSelected ? "bg-[var(--lumina-accent-muted)]" : ""
              }`}
            >
              <TableCell className="px-4 py-3">
                <div className="relative h-12 w-12 overflow-hidden rounded bg-[var(--lumina-surface-elevated)]">
                  <img
                    src={photo.thumbnail}
                    srcSet={photo.thumbnailSrcSet}
                    sizes={photo.thumbnailSizes}
                    alt={photo.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {selectionMode && (
                    <div
                      className={`absolute inset-0 flex items-center justify-center bg-black/40 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    >
                      <div
                        className={`h-4 w-4 rounded-full border ${isSelected ? "bg-[var(--lumina-text)] border-[var(--lumina-text)]" : "border-white"}`}
                      />
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex flex-col">
                  <span
                    className="font-medium text-[var(--lumina-text)] truncate max-w-[200px]"
                    title={photo.filename}
                  >
                    {photo.filename}
                  </span>
                  <span className="text-xs text-[var(--lumina-muted)]">{photo.format}</span>
                </div>
              </TableCell>
              <TableCell className="px-4 py-3">
                {photo.exif?.date ? (
                  <div className="flex flex-col">
                    <span>{photo.exif.date.split(" ")[0]}</span>
                    <span className="text-xs text-[var(--lumina-muted)]">
                      {photo.exif.date.split(" ")[1]}
                    </span>
                  </div>
                ) : (
                  <span className="text-[var(--lumina-muted)]">-</span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3">
                {photo.width} × {photo.height}
              </TableCell>
              <TableCell className="px-4 py-3">{photo.size}</TableCell>
              <TableCell className="px-4 py-3">
                <span
                  className="inline-block max-w-[120px] truncate"
                  title={photo.category || "-"}
                >
                  {photo.category || "-"}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3">
                <span
                  className="inline-block max-w-[240px] truncate text-[var(--lumina-text-secondary)]"
                  title={photo.visualDescription || "-"}
                >
                  {photo.visualDescription || "-"}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex flex-col max-w-[150px]">
                  <span className="truncate" title={photo.exif?.camera}>
                    {photo.exif?.camera || "-"}
                  </span>
                  <span
                    className="text-xs text-[var(--lumina-muted)] truncate"
                    title={photo.exif?.lens}
                  >
                    {photo.exif?.lens}
                  </span>
                </div>
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex flex-col text-xs">
                  {photo.exif ? (
                    <>
                      <span>
                        {photo.exif.iso ? `ISO ${photo.exif.iso}` : ""}{" "}
                        {photo.exif.aperture ? `f/${photo.exif.aperture}` : ""}
                      </span>
                      <span className="text-[var(--lumina-muted)]">
                        {photo.exif.shutter ? `${photo.exif.shutter}s` : ""}{" "}
                        {photo.exif.focalLength
                          ? `${photo.exif.focalLength}`
                          : ""}
                      </span>
                    </>
                  ) : (
                    <span className="text-[var(--lumina-muted)]">-</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
};

export default PhotoList;
