import React from 'react';
import { Photo } from '@/features/photos/types';
import PhotoCard from './PhotoCard';

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  canDelete?: boolean;
  deletingPhotoId?: string | null;
  onDeletePhoto?: (photoId: string) => Promise<void>;
}

const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  onPhotoClick,
  canDelete = false,
  deletingPhotoId = null,
  onDeletePhoto,
}) => {
  return (
    <div className="w-full py-1">
      <div className="columns-2 gap-2 space-y-2 md:columns-3 md:gap-3 md:space-y-3 lg:columns-4">
        {photos.map((photo, index) => (
          <PhotoCard 
            key={photo.id} 
            photo={photo} 
            index={index}
            onClick={onPhotoClick}
            canDelete={canDelete}
            isDeleting={deletingPhotoId === photo.id}
            onDelete={onDeletePhoto}
          />
        ))}
      </div>
    </div>
  );
};

export default PhotoGrid;
