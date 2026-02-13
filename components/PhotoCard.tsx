import React, { useState, useEffect, useRef } from 'react';
import { Photo } from '../types';
import { Aperture, Timer, Disc } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface PhotoCardProps {
  photo: Photo;
  onClick: (photo: Photo) => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // When the element enters the viewport (or is close to it)
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Stop observing once visible
        }
      },
      { 
        rootMargin: '200px' // Start loading 200px before the element appears on screen
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={cardRef}
      className="relative mb-1 break-inside-avoid cursor-pointer overflow-hidden bg-[#1a1a1a] group"
      onClick={() => onClick(photo)}
      // Reserve space based on image aspect ratio to prevent layout shift
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      {isVisible && (
        <img
          src={photo.thumbnail}
          alt={photo.title}
          className={`w-full h-full object-cover transition-opacity duration-700 ease-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
        />
      )}
      
      {/* Dark placeholder with pulse effect while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#1a1a1a] animate-pulse" />
      )}

      {/* Hover Overlay - Replicating the screenshot style */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6">
        
        {/* Filename */}
        <h3 className="text-white font-bold text-2xl tracking-tight mb-1 font-sans">{photo.filename}</h3>
        
        {/* Tech Specs Line */}
        <p className="text-gray-300 text-sm font-medium mb-3 opacity-90">
          {photo.format} <span className="mx-1">•</span> {photo.width} × {photo.height} <span className="mx-1">•</span> {photo.size}
        </p>

        {/* Category Pill */}
        <div className="mb-6">
          <Badge className="rounded-full border border-white/10 bg-white/20 px-3 py-1 text-xs text-white backdrop-blur-md">
            {photo.category}
          </Badge>
        </div>

        {/* EXIF Data Grid */}
        <div className="grid grid-cols-2 gap-2">
            {/* Focal Length */}
            <Card className="border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm">
              <CardContent className="flex items-center gap-3 p-2">
                <Disc size={18} className="ml-1 text-white" />
                <span className="text-sm font-medium text-white flex items-center">{photo.exif.focalLength}</span>
              </CardContent>
            </Card>

             {/* Aperture */}
            <Card className="border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm">
              <CardContent className="flex items-center gap-3 p-2">
                <Aperture size={18} className="ml-1 text-white" />
                <span className="text-sm font-medium text-white flex items-center">{photo.exif.aperture}</span>
              </CardContent>
            </Card>

            {/* Shutter Speed */}
            <Card className="border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm">
              <CardContent className="flex items-center gap-3 p-2">
                <Timer size={18} className="ml-1 text-white" />
                <span className="text-sm font-medium text-white flex items-center">{photo.exif.shutter}</span>
              </CardContent>
            </Card>

            {/* ISO */}
            <Card className="border-white/5 bg-[#2a2a2a]/80 backdrop-blur-sm">
              <CardContent className="flex items-center gap-3 p-2">
                <div className="ml-1 flex h-4 items-center rounded-[3px] border border-white px-[2px] text-[9px] font-bold">ISO</div>
                <span className="text-sm font-medium text-white flex items-center">{photo.exif.iso}</span>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default PhotoCard;
