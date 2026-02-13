import React from 'react';
import { Photo } from '@/features/photos/types';
import PhotoCard from './PhotoCard';

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, onPhotoClick }) => {
  return (
    <div className="w-full py-1">
      <div className="columns-2 gap-2 space-y-2 md:columns-3 md:gap-3 md:space-y-3 lg:columns-4">
        {photos.map((photo, index) => (
          <PhotoCard 
            key={photo.id} 
            photo={photo} 
            index={index}
            onClick={onPhotoClick}
          />
        ))}
      </div>
    </div>
  );
};

export default PhotoGrid;
