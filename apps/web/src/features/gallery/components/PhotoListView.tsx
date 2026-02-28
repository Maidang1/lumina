import React from "react";
import { motion } from "motion/react";
import { Calendar, MapPin, Camera } from "lucide-react";
import type { Photo, PhotoOpenTransition } from "@/features/photos/types";
import { thumbhashToDataUrl } from "@/features/photos/services/thumbhash";

interface PhotoListViewProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo, transitionSource: PhotoOpenTransition) => void;
}

const PhotoListView: React.FC<PhotoListViewProps> = ({
  photos,
  onPhotoClick,
}) => {
  return (
    <div className="space-y-2">
      {photos.map((photo, index) => (
        <PhotoListItem
          key={photo.id}
          photo={photo}
          index={index}
          onClick={onPhotoClick}
        />
      ))}
    </div>
  );
};

interface PhotoListItemProps {
  photo: Photo;
  index: number;
  onClick?: (photo: Photo, transitionSource: PhotoOpenTransition) => void;
}

const PhotoListItem: React.FC<PhotoListItemProps> = ({
  photo,
  index,
  onClick,
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const itemRef = React.useRef<HTMLDivElement>(null);
  const thumbhashDataUrl = React.useMemo(
    () => thumbhashToDataUrl(photo.metadata?.thumbhash),
    [photo.metadata?.thumbhash]
  );

  const getTransitionSource = (): PhotoOpenTransition => {
    const rect = itemRef.current?.getBoundingClientRect();
    if (!rect) {
      return {
        photoId: photo.id,
        left: window.innerWidth / 2,
        top: window.innerHeight / 2,
        width: 1,
        height: 1,
        borderRadius: 8,
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
      width: 80,
      height: 80,
      borderRadius: 8,
      sourceScale: 1,
      sourceViewportWidth: window.innerWidth,
      sourceViewportHeight: window.innerHeight,
      capturedAt: Date.now(),
    };
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "--";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "--";
    }
  };

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 20) * 0.02 }}
      className="group flex cursor-pointer items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
      onClick={() => onClick?.(photo, getTransitionSource())}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(photo, getTransitionSource());
        }
      }}
    >
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
        {thumbhashDataUrl && !isLoaded && (
          <img
            src={thumbhashDataUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover blur-sm"
          />
        )}
        <img
          src={photo.thumbnail}
          alt={photo.title}
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsLoaded(true)}
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-white">
          {photo.filename}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(photo.metadata?.timestamps?.created_at)}
          </span>
          {photo.location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {photo.location}
            </span>
          )}
          {photo.exif?.camera && (
            <span className="flex items-center gap-1">
              <Camera size={12} />
              {photo.exif.camera}
            </span>
          )}
        </div>
        {photo.visualDescription && (
          <p className="mt-1.5 line-clamp-1 text-xs text-white/40">
            {photo.visualDescription}
          </p>
        )}
      </div>

      <div className="hidden flex-shrink-0 text-right text-xs text-white/40 sm:block">
        <div>
          {photo.width} × {photo.height}
        </div>
        <div>{photo.size}</div>
      </div>
    </motion.div>
  );
};

export default PhotoListView;
