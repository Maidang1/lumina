import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { animated, to, useSpring } from "@react-spring/web";
import { Photo, PhotoOpenTransition } from "@/types/photo";
import { thumbhashToDataUrl } from "@/services/thumbhash";
import { imagePrefetchService } from "@/services/imagePrefetchService";

interface PhotoCardProps {
  photo: Photo;
  index: number;
  onClick?: (photo: Photo, transitionSource: PhotoOpenTransition) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (photoId: string) => void;
  interactionMode?: "detail" | "selectionOnly" | "none";
  compact?: boolean;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  index,
  onClick,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  interactionMode = "detail",
  compact = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverPrefetchTimerRef = useRef<number | null>(null);
  const thumbhashDataUrl = useMemo(
    () => thumbhashToDataUrl(photo.metadata?.thumbhash),
    [photo.metadata?.thumbhash],
  );

  const enterSpring = useSpring({
    from: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 24,
      scale: prefersReducedMotion ? 1 : 0.97,
    },
    to: {
      opacity: isVisible ? 1 : 0,
      y: isVisible ? 0 : prefersReducedMotion ? 0 : 12,
      scale: isVisible ? 1 : prefersReducedMotion ? 1 : 0.97,
    },
    delay: prefersReducedMotion ? 0 : Math.min(index, 20) * 50,
    config: { tension: 200, friction: 28 },
  });

  const hoverSpring = useSpring({
    to: {
      scale: isHovered && !prefersReducedMotion ? 1.008 : 1,
      overlayOpacity: isHovered ? 1 : 0,
      overlayY: isHovered && !prefersReducedMotion ? 0 : 16,
    },
    config: { tension: 280, friction: 32 },
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };
    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMotionChange);
    return () => mediaQuery.removeEventListener("change", handleMotionChange);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "200px",
      },
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (hoverPrefetchTimerRef.current !== null) {
        window.clearTimeout(hoverPrefetchTimerRef.current);
        hoverPrefetchTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setIsLoaded(false);
  }, [photo.id, photo.thumbnail]);

  const getTransitionSource = useCallback((): PhotoOpenTransition => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) {
      return {
        photoId: photo.id,
        left: window.innerWidth / 2,
        top: window.innerHeight / 2,
        width: 1,
        height: 1,
        borderRadius: 16,
        sourceScale: window.visualViewport?.scale ?? 1,
        sourceViewportWidth: window.innerWidth,
        sourceViewportHeight: window.innerHeight,
        capturedAt: Date.now(),
      };
    }

    const computed = cardRef.current
      ? window.getComputedStyle(cardRef.current)
      : null;
    const parsedRadius = computed
      ? Number.parseFloat(computed.borderTopLeftRadius || "16")
      : 16;
    const borderRadius = Number.isFinite(parsedRadius) ? parsedRadius : 16;

    return {
      photoId: photo.id,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      borderRadius,
      sourceScale: window.visualViewport?.scale ?? 1,
      sourceViewportWidth: window.innerWidth,
      sourceViewportHeight: window.innerHeight,
      capturedAt: Date.now(),
    };
  }, [photo.id]);

  const canSelect =
    selectionMode && interactionMode !== "none" && Boolean(onToggleSelect);
  const canOpenDetail = interactionMode === "detail" && Boolean(onClick);
  const canActivate = canSelect || canOpenDetail;
  const cardAspectRatio = compact
    ? "4 / 3"
    : `${photo.width} / ${photo.height}`;

  const handleActivate = useCallback(() => {
    if (canSelect) {
      onToggleSelect?.(photo.id);
      return;
    }
    if (canOpenDetail && onClick) {
      imagePrefetchService.prefetch(photo.url, { priority: "high" });
      onClick(photo, getTransitionSource());
    }
  }, [
    canOpenDetail,
    canSelect,
    getTransitionSource,
    onClick,
    onToggleSelect,
    photo,
  ]);

  return (
    <animated.div
      ref={cardRef}
      className={`group relative mb-0 break-inside-avoid overflow-hidden bg-[#060606] transition-colors duration-200 ${canActivate ? "cursor-pointer" : "cursor-default"}`}
      role={canActivate ? "button" : undefined}
      tabIndex={canActivate ? 0 : -1}
      aria-label={
        canOpenDetail
          ? `View photo ${photo.title}`
          : canSelect
            ? `Select photo ${photo.title}`
            : undefined
      }
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (!canActivate) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate();
        }
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        if (hoverPrefetchTimerRef.current !== null) {
          window.clearTimeout(hoverPrefetchTimerRef.current);
        }
        hoverPrefetchTimerRef.current = window.setTimeout(() => {
          imagePrefetchService.prefetch(photo.url, { priority: "low" });
          hoverPrefetchTimerRef.current = null;
        }, 120);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (hoverPrefetchTimerRef.current !== null) {
          window.clearTimeout(hoverPrefetchTimerRef.current);
          hoverPrefetchTimerRef.current = null;
        }
      }}
      style={{
        aspectRatio: cardAspectRatio,
      }}
    >
      {!compact && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-black/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
      )}

      {selectionMode && (
        <span
          className={`absolute left-3 top-3 z-20 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
            isSelected
              ? "border-white bg-white text-black"
              : "border-white/50 bg-black/45"
          }`}
        >
          {isSelected && (
            <span className="block h-2 w-2 bg-black rounded-full" />
          )}
        </span>
      )}

      <animated.div
        className="h-full w-full will-change-transform"
        style={{
          opacity: enterSpring.opacity,
          transform: to(
            [enterSpring.y, hoverSpring.scale],
            (y, scale) => `translate3d(0, ${y}px, 0) scale(${scale})`,
          ),
        }}
      >
        {isVisible && thumbhashDataUrl && (
          <img
            src={thumbhashDataUrl}
            alt=""
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover blur-sm transition-opacity duration-300 ${isLoaded ? "opacity-0" : "opacity-100"}`}
          />
        )}
        {isVisible && (
          <img
            src={photo.thumbnail}
            srcSet={photo.thumbnailSrcSet}
            sizes={photo.thumbnailSizes}
            alt={photo.title}
            className={`h-full w-full object-cover transition-all duration-500 ease-out ${isLoaded ? "opacity-100" : "opacity-0"} ${compact ? "" : "group-hover:scale-[1.03]"}`}
            onLoad={() => setIsLoaded(true)}
          />
        )}
      </animated.div>

      {!compact && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex translate-y-2 flex-col justify-end p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 sm:p-5">
          {(photo.location || photo.category) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {photo.location && (
                <div className="flex items-center gap-1.5 rounded-md border border-white/20 bg-black/60 px-3 py-1 backdrop-blur-sm">
                  <span className="text-xs font-medium text-white">
                    {photo.location}
                  </span>
                </div>
              )}
              {photo.category && (
                <div className="flex items-center gap-1.5 rounded-md border border-white/20 bg-black/60 px-3 py-1 backdrop-blur-sm">
                  <span className="text-xs font-medium text-white">
                    {photo.category}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-[10px] font-medium tracking-[0.22em] text-white/65 uppercase">
            <span>
              {photo.width} × {photo.height}
            </span>
            {photo.format && (
              <>
                <span className="h-0.5 w-0.5 rounded-full bg-white/40" />
                <span>{photo.format}</span>
              </>
            )}
          </div>
        </div>
      )}
    </animated.div>
  );
};

export default PhotoCard;
