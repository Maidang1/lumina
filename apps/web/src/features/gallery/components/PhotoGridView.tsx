import React from "react";
import { motion } from "motion/react";
import type { Photo, PhotoOpenTransition } from "@/features/photos/types";
import { thumbhashToDataUrl } from "@/features/photos/services/thumbhash";
import { imagePrefetchService } from "@/features/photos/services/imagePrefetchService";

interface PhotoGridViewProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo, transitionSource: PhotoOpenTransition) => void;
}

const PhotoGridView: React.FC<PhotoGridViewProps> = ({
  photos,
  onPhotoClick,
}) => {
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {photos.map((photo, index) => (
        <PhotoGridItem
          key={photo.id}
          photo={photo}
          index={index}
          onClick={onPhotoClick}
        />
      ))}
    </div>
  );
};

interface PhotoGridItemProps {
  photo: Photo;
  index: number;
  onClick?: (photo: Photo, transitionSource: PhotoOpenTransition) => void;
}

const PhotoGridItem: React.FC<PhotoGridItemProps> = ({
  photo,
  index,
  onClick,
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  const thumbhashDataUrl = React.useMemo(
    () => thumbhashToDataUrl(photo.metadata?.thumbhash),
    [photo.metadata?.thumbhash]
  );

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const getTransitionSource = (): PhotoOpenTransition => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) {
      return {
        photoId: photo.id,
        left: window.innerWidth / 2,
        top: window.innerHeight / 2,
        width: 1,
        height: 1,
        borderRadius: 4,
        sourceScale: 1,
        sourceViewportWidth: window.innerWidth,
        sourceViewportHeight: window.innerHeight,
        capturedAt: Date.now(),
      };
    }

    return {
      photoId: photo.id,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      borderRadius: 4,
      sourceScale: 1,
      sourceViewportWidth: window.innerWidth,
      sourceViewportHeight: window.innerHeight,
      capturedAt: Date.now(),
    };
  };

  const handleClick = () => {
    imagePrefetchService.prefetch(photo.url, { priority: "high" });
    onClick?.(photo, getTransitionSource());
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.95 }}
      transition={{ duration: 0.3, delay: Math.min(index, 20) * 0.02 }}
      className="group relative aspect-square cursor-pointer overflow-hidden bg-[#0a0a0a]"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {isVisible && thumbhashDataUrl && !isLoaded && (
        <img
          src={thumbhashDataUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-105 object-cover blur-sm"
        />
      )}
      {isVisible && (
        <img
          src={photo.thumbnail}
          alt={photo.title}
          className={`h-full w-full object-cover transition-all duration-300 group-hover:scale-105 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsLoaded(true)}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </motion.div>
  );
};

export default PhotoGridView;
