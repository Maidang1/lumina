import React from "react";
import { Photo, PhotoOpenTransition } from "@/features/photos/types";
import PhotoCard from "./PhotoCard";

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo, transitionSource: PhotoOpenTransition) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (photoId: string) => void;
  interactionMode?: "detail" | "selectionOnly" | "none";
  compact?: boolean;
}

const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  onPhotoClick,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  interactionMode = "detail",
  compact = false,
}) => {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={index}
            onClick={onPhotoClick}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(photo.id)}
            onToggleSelect={onToggleSelect}
            interactionMode={interactionMode}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
};

export default PhotoGrid;
