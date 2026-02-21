import React from "react";
import { Photo } from "@/features/photos/types";
import { Star, Image as ImageIcon, Film } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

interface PhotoListProps {
  photos: Photo[];
  onPhotoClick?: (
    photo: Photo,
    transitionSource: {
      photoId: string;
      left: number;
      top: number;
      width: number;
      height: number;
      borderRadius: number;
    }
  ) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (photoId: string) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (photoId: string) => void;
}

const PhotoList: React.FC<PhotoListProps> = ({
  photos,
  onPhotoClick,
  favoriteIds,
  onToggleFavorite,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}) => {
  const handleRowClick = (photo: Photo, e: React.MouseEvent) => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(photo.id);
      return;
    }
    
    // Calculate center of screen for transition source as fallback
    // In list view, precise transition is less critical or harder to calculate per row image
    if (onPhotoClick) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onPhotoClick(photo, {
            photoId: photo.id,
            left: rect.left + 8, // Approx image position
            top: rect.top + 8,
            width: 48, // Approx image size
            height: 48,
            borderRadius: 4,
        });
    }
  };

  return (
    <Table className="text-left text-sm text-zinc-400">
      <TableHeader className="bg-[#1A1A1A] text-xs uppercase text-zinc-500">
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
          <TableHead className="px-4 py-3 text-right font-medium">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-white/5">
          {photos.map((photo) => {
            const isSelected = selectedIds.has(photo.id);
            const isFavorite = favoriteIds.has(photo.id);

            return (
              <TableRow
                key={photo.id}
                onClick={(e) => handleRowClick(photo, e)}
                className={`group cursor-pointer transition-colors hover:bg-white/[0.02] ${
                  isSelected ? "bg-white/[0.04]" : ""
                }`}
              >
                <TableCell className="px-4 py-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded bg-zinc-800">
                    <img
                      src={photo.thumbnail}
                      alt={photo.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                     {photo.isLive && (
                        <div className="absolute top-0.5 right-0.5 rounded-full bg-black/50 p-0.5">
                            <Film size={8} className="text-white" />
                        </div>
                     )}
                     {selectionMode && (
                        <div className={`absolute inset-0 flex items-center justify-center bg-black/40 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                             <div className={`h-4 w-4 rounded-full border ${isSelected ? 'bg-sky-500 border-sky-500' : 'border-white'}`} />
                        </div>
                     )}
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-200 truncate max-w-[200px]" title={photo.filename}>
                      {photo.filename}
                    </span>
                    <span className="text-xs text-zinc-500">{photo.format}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                   {photo.exif?.date ? (
                      <div className="flex flex-col">
                        <span>{photo.exif.date.split(' ')[0]}</span>
                        <span className="text-xs text-zinc-500">{photo.exif.date.split(' ')[1]}</span>
                      </div>
                   ) : (
                       <span className="text-zinc-600">-</span>
                   )}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {photo.width} × {photo.height}
                </TableCell>
                <TableCell className="px-4 py-3">{photo.size}</TableCell>
                <TableCell className="px-4 py-3">
                  <span className="inline-block max-w-[120px] truncate" title={photo.category || "-"}>
                    {photo.category || "-"}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span
                    className="inline-block max-w-[240px] truncate text-zinc-300"
                    title={photo.visualDescription || "-"}
                  >
                    {photo.visualDescription || "-"}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3">
                    <div className="flex flex-col max-w-[150px]">
                        <span className="truncate" title={photo.exif?.camera}>{photo.exif?.camera || '-'}</span>
                        <span className="text-xs text-zinc-500 truncate" title={photo.exif?.lens}>{photo.exif?.lens}</span>
                    </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                    <div className="flex flex-col text-xs">
                        {photo.exif ? (
                            <>
                                <span>{photo.exif.iso ? `ISO ${photo.exif.iso}` : ''} {photo.exif.aperture ? `f/${photo.exif.aperture}` : ''}</span>
                                <span className="text-zinc-500">{photo.exif.shutter ? `${photo.exif.shutter}s` : ''} {photo.exif.focalLength ? `${photo.exif.focalLength}` : ''}</span>
                            </>
                        ) : (
                            <span className="text-zinc-600">-</span>
                        )}
                    </div>
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(photo.id);
                    }}
                    size="icon"
                    variant="ghost"
                    className={`h-8 w-8 rounded-full p-2 transition-colors hover:bg-white/10 ${
                      isFavorite ? "text-yellow-500" : "text-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
};

export default PhotoList;
