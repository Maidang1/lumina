import React from 'react';
import { Photo } from '../types';
import PhotoCard from './PhotoCard';

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, onPhotoClick }) => {
  return (
    <div className="container mx-auto px-4 md:px-8 py-12">
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
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
