import React from 'react';
import { Photo } from '@/features/photos/types';
import PhotoCard from './PhotoCard';

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (
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

const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  onPhotoClick,
  favoriteIds,
  onToggleFavorite,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}) => {
  return (
    <div className="w-full py-3">
      <div className="columns-2 gap-4 space-y-4 md:columns-3 md:gap-5 md:space-y-5 lg:columns-4">
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
          />
        ))}
      </div>
    </div>
  );
};

export default PhotoGrid;
