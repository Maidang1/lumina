import React from 'react';
import { Photo, PhotoOpenTransition } from '@/features/photos/types';
import PhotoCard from './PhotoCard';

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo, transitionSource: PhotoOpenTransition) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (photoId: string) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (photoId: string) => void;
  interactionMode?: "detail" | "selectionOnly" | "none";
  compact?: boolean;
}

const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  onPhotoClick,
  favoriteIds,
  onToggleFavorite,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  interactionMode = "detail",
  compact = false,
}) => {
  return (
    <div className="w-full">
      <div className="columns-1 gap-0 space-y-0 sm:columns-2 md:columns-3 xl:columns-4">
        {photos.map((photo, index) => (
          <PhotoCard 
            key={photo.id} 
            photo={photo} 
            index={index}
            onClick={onPhotoClick}
            isFavorite={favoriteIds.has(photo.id)}
            onToggleFavorite={onToggleFavorite}
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
