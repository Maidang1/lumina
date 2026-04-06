import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Check, ImageOff } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { FolderImage } from "@/features/upload/hooks/useFolderBrowserStore";

interface FolderImageCardProps {
  image: FolderImage;
  isSelected: boolean;
  isInQueue: boolean;
  onCardClick: (path: string, e: React.MouseEvent) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FolderImageCard: React.FC<FolderImageCardProps> = memo(({
  image,
  isSelected,
  isInQueue,
  onCardClick,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [image.previewUrl]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isInQueue) return;
      onCardClick(image.path, e);
    },
    [isInQueue, onCardClick, image.path],
  );

  const showPreview = isVisible && image.previewUrl && !image.isPreviewLoading;

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border transition-colors duration-150",
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/40"
          : "border-[var(--lumina-border-subtle)] hover:border-white/20",
        isInQueue && "cursor-not-allowed opacity-50",
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}
      onClick={handleClick}
      role="button"
      tabIndex={isInQueue ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
    >
      {/* Image preview */}
      <div className="relative aspect-square w-full bg-[var(--lumina-surface)]">
        {showPreview && !hasError ? (
          <img
            src={image.previewUrl}
            alt={image.name}
            className={cn(
              "h-full w-full object-cover",
              isLoaded ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            loading="lazy"
            decoding="async"
          />
        ) : null}

        {/* Loading/error/unsupported placeholder */}
        {(!showPreview || hasError) && isVisible && (
          <div className="flex h-full w-full items-center justify-center">
            {image.isPreviewLoading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--lumina-muted)] border-t-transparent" />
            ) : (
              <ImageOff
                size={24}
                className="text-[var(--lumina-muted)]"
              />
            )}
          </div>
        )}

        {/* Selection checkbox */}
        {!isInQueue && (
          <div
            className={cn(
              "absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border",
              isSelected
                ? "border-blue-500 bg-blue-500"
                : "border-white/40 bg-black/40 opacity-0 group-hover:opacity-100",
            )}
          >
            {isSelected && <Check size={12} className="text-white" />}
          </div>
        )}

        {/* "Already in queue" badge */}
        {isInQueue && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <span className="rounded-md bg-[var(--lumina-surface)] px-2 py-1 text-xs font-medium text-[var(--lumina-muted)]">
              已添加
            </span>
          </div>
        )}
      </div>

      {/* File info */}
      <div className="px-2 py-1.5">
        <p className="truncate text-xs text-[var(--lumina-text)]">
          {image.name}
        </p>
        <p className="text-[10px] text-[var(--lumina-muted)]">
          {formatFileSize(image.sizeBytes)}
        </p>
      </div>
    </div>
  );
});

FolderImageCard.displayName = "FolderImageCard";

export default FolderImageCard;
