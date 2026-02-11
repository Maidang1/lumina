import React from 'react';
import { Photo } from '../types';
import PhotoCard from './PhotoCard';

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, onPhotoClick }) => {
  return (
    <div className="w-full px-1 py-1">
      <div className="columns-2 md:columns-3 lg:columns-4 gap-1 space-y-1">
        {photos.map((photo) => (
          <PhotoCard 
            key={photo.id} 
            photo={photo} 
            onClick={onPhotoClick}
          />
        ))}
      </div>
    </div>
  );
};

export default PhotoGrid;
