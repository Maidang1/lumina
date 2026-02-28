import React, { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Photo } from "@/features/photos/types";
import { thumbhashToDataUrl } from "@/features/photos/services/thumbhash";

interface FilmstripProps {
  photos: Photo[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

const Filmstrip: React.FC<FilmstripProps> = ({
  photos,
  currentIndex,
  onSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (currentItemRef.current && containerRef.current) {
      const container = containerRef.current;
      const item = currentItemRef.current;
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      const itemCenter = itemRect.left + itemRect.width / 2;
      const containerCenter = containerRect.left + containerRect.width / 2;
      const scrollOffset = itemCenter - containerCenter;

      container.scrollBy({ left: scrollOffset, behavior: "smooth" });
    }
  }, [currentIndex]);

  const scroll = (direction: "left" | "right") => {
    if (!containerRef.current) return;
    const scrollAmount = direction === "left" ? -200 : 200;
    containerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center gap-2 bg-black/60 px-2 py-2 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => scroll("left")}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        aria-label="Scroll left"
      >
        <ChevronLeft size={16} />
      </button>

      <div
        ref={containerRef}
        className="flex flex-1 gap-1 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((photo, index) => (
          <FilmstripItem
            key={photo.id}
            photo={photo}
            isActive={index === currentIndex}
            onClick={() => onSelect(index)}
            ref={index === currentIndex ? currentItemRef : undefined}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => scroll("right")}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        aria-label="Scroll right"
      >
        <ChevronRight size={16} />
      </button>

      <div className="flex-shrink-0 text-xs text-white/50">
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  );
};

interface FilmstripItemProps {
  photo: Photo;
  isActive: boolean;
  onClick: () => void;
}

const FilmstripItem = React.forwardRef<HTMLButtonElement, FilmstripItemProps>(
  ({ photo, isActive, onClick }, ref) => {
    const [isLoaded, setIsLoaded] = React.useState(false);
    const thumbhashDataUrl = React.useMemo(
      () => thumbhashToDataUrl(photo.metadata?.thumbhash),
      [photo.metadata?.thumbhash]
    );

    return (
      <motion.button
        ref={ref}
        type="button"
        onClick={onClick}
        className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded transition-all ${
          isActive
            ? "ring-2 ring-[#c9a962] ring-offset-1 ring-offset-black"
            : "opacity-60 hover:opacity-100"
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
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
          className={`h-full w-full object-cover transition-opacity ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsLoaded(true)}
        />
      </motion.button>
    );
  }
);

FilmstripItem.displayName = "FilmstripItem";

export default Filmstrip;
