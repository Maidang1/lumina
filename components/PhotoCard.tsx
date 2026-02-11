import React, { useState } from 'react';
import { Photo } from '../types';
import { Maximize2, Camera } from 'lucide-react';

interface PhotoCardProps {
  photo: Photo;
  onClick: (photo: Photo) => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div 
      className="relative mb-6 break-inside-avoid group cursor-pointer overflow-hidden rounded-sm"
      onClick={() => onClick(photo)}
    >
      <div className={`transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0 bg-pro-gray h-64 animate-pulse'}`}>
        <img
          src={photo.thumbnail}
          alt={photo.title}
          className="w-full h-auto object-cover transform transition-transform duration-700 ease-out group-hover:scale-105 group-hover:filter group-hover:brightness-110"
          onLoad={() => setIsLoaded(true)}
        />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
        <h3 className="text-white font-serif text-xl tracking-wide transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
          {photo.title}
        </h3>
        <div className="flex items-center gap-2 mt-2 text-gray-300 text-xs uppercase tracking-widest transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
          <Camera size={12} />
          <span>{photo.exif.camera}</span>
        </div>
        
        <div className="absolute top-4 right-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
            <Maximize2 size={20} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
};

export default PhotoCard;
