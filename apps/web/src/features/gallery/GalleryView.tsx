import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { BlurFade } from "@/shared/magicui/blur-fade";
import PhotoGrid from "@/features/photos/components/PhotoGrid";
import PhotoDetail from "@/features/photos/components/PhotoDetail";
import { LoadingSpinner, EmptyState, ErrorState } from "@/shared/components";
import { useLocalStorageState } from "@/shared/lib/useLocalStorageState";
import { imagePrefetchService } from "@/features/photos/services/imagePrefetchService";
import { useGalleryFilters } from "./hooks/useGalleryFilters";
import FilterBar from "./components/FilterBar";
import ViewModeToggle from "./components/ViewModeToggle";
import PhotoListView from "./components/PhotoListView";
import PhotoGridView from "./components/PhotoGridView";
import type { Photo, PhotoOpenTransition } from "@/features/photos/types";

const TAG_STORAGE_KEY = "lumina.photo_tags";

const LazyPhotoMapView = lazy(
  () => import("@/features/photos/components/PhotoMapView"),
);

type PageViewMode = "gallery" | "map";

interface GalleryViewProps {
  photos: Photo[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  viewMode?: PageViewMode;
}

const GalleryView: React.FC<GalleryViewProps> = ({
  photos,
  isLoading,
  isLoadingMore,
  error,
  hasMore,
  loadMore,
  refresh,
  viewMode: pageViewMode = "gallery",
}) => {
  const { photoId } = useParams<{ photoId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [openTransition, setOpenTransition] =
    useState<PhotoOpenTransition | null>(null);
  const [photoTags] = useLocalStorageState<Record<string, string[]>>(
    TAG_STORAGE_KEY,
    {},
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const {
    filters,
    setFilters,
    clearFilters,
    availableFilters,
    filteredPhotos,
    totalCount,
    hasActiveFilters,
  } = useGalleryFilters(photos);

  const displayPhotos = pageViewMode === "gallery" ? filteredPhotos : photos;

  const selectedPhoto = useMemo(() => {
    if (!photoId) return null;
    return photos.find((photo) => photo.id === photoId) ?? null;
  }, [photos, photoId]);

  const selectedPhotoIndex = useMemo(() => {
    if (!selectedPhoto) return -1;
    return displayPhotos.findIndex((photo) => photo.id === selectedPhoto.id);
  }, [displayPhotos, selectedPhoto]);

  useEffect(() => {
    if (!selectedPhoto || selectedPhotoIndex < 0) return;
    imagePrefetchService.prefetch(selectedPhoto.url, { priority: "high" });

    const prevPhoto = displayPhotos[selectedPhotoIndex - 1];
    const nextPhoto = displayPhotos[selectedPhotoIndex + 1];
    if (prevPhoto) {
      imagePrefetchService.prefetch(prevPhoto.url, { priority: "low" });
    }
    if (nextPhoto) {
      imagePrefetchService.prefetch(nextPhoto.url, { priority: "low" });
    }
  }, [displayPhotos, selectedPhoto, selectedPhotoIndex]);

  useEffect(() => {
    if (
      pageViewMode !== "gallery" ||
      isLoading ||
      isLoadingMore ||
      !hasMore ||
      !loadMoreRef.current
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore, pageViewMode, displayPhotos.length]);

  const closeDetail = useCallback((): void => {
    const basePath = pageViewMode === "map" ? "/map" : "/gallery";
    const query = searchParams.toString();
    navigate(query ? `${basePath}?${query}` : basePath);
    setOpenTransition(null);
  }, [navigate, searchParams, pageViewMode]);

  const handlePhotoClick = useCallback(
    (photo: Photo, transitionSource?: PhotoOpenTransition) => {
      imagePrefetchService.prefetch(photo.url, { priority: "high" });
      if (transitionSource) {
        setOpenTransition(transitionSource);
      }
      const basePath = pageViewMode === "map" ? "/map" : "/gallery";
      const query = searchParams.toString();
      navigate(
        query
          ? `${basePath}/${photo.id}?${query}`
          : `${basePath}/${photo.id}`,
      );
    },
    [navigate, searchParams, pageViewMode],
  );

  const handlePrev = useCallback(() => {
    if (selectedPhotoIndex <= 0) return;
    const prevPhoto = displayPhotos[selectedPhotoIndex - 1];
    setOpenTransition(null);
    const basePath = pageViewMode === "map" ? "/map" : "/gallery";
    const query = searchParams.toString();
    navigate(
      query
        ? `${basePath}/${prevPhoto.id}?${query}`
        : `${basePath}/${prevPhoto.id}`,
    );
  }, [selectedPhotoIndex, displayPhotos, pageViewMode, searchParams, navigate]);

  const handleNext = useCallback(() => {
    if (selectedPhotoIndex < 0 || selectedPhotoIndex >= displayPhotos.length - 1)
      return;
    const nextPhoto = displayPhotos[selectedPhotoIndex + 1];
    setOpenTransition(null);
    const basePath = pageViewMode === "map" ? "/map" : "/gallery";
    const query = searchParams.toString();
    navigate(
      query
        ? `${basePath}/${nextPhoto.id}?${query}`
        : `${basePath}/${nextPhoto.id}`,
    );
  }, [selectedPhotoIndex, displayPhotos, pageViewMode, searchParams, navigate]);

  const mainClass =
    pageViewMode === "map"
      ? "mx-auto h-[calc(100svh-72px)] w-full max-w-[1720px] flex-grow overflow-hidden px-2 sm:h-[calc(100svh-96px)] sm:px-4"
      : "mx-auto w-full max-w-[1720px] flex-grow px-2 pt-2 sm:px-4 sm:pt-4";

  const renderPhotoContent = () => {
    switch (filters.viewMode) {
      case "list":
        return (
          <PhotoListView
            photos={displayPhotos}
            onPhotoClick={handlePhotoClick}
          />
        );
      case "grid":
        return (
          <PhotoGridView
            photos={displayPhotos}
            onPhotoClick={handlePhotoClick}
          />
        );
      case "masonry":
      default:
        return (
          <PhotoGrid photos={displayPhotos} onPhotoClick={handlePhotoClick} />
        );
    }
  };

  return (
    <>
      <main className={mainClass}>
        {isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <LoadingSpinner text="Loading gallery..." />
          </div>
        ) : error && photos.length === 0 ? (
          <ErrorState message={error} onRetry={() => void refresh()} />
        ) : photos.length === 0 ? (
          <EmptyState
            title="No photos yet."
            description="Run Desktop or CLI upload first, then refresh this page."
          />
        ) : (
          <>
            {pageViewMode === "gallery" ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <FilterBar
                    filters={filters}
                    availableFilters={availableFilters}
                    onFiltersChange={setFilters}
                    onClearFilters={clearFilters}
                    hasActiveFilters={hasActiveFilters}
                    filteredCount={filteredPhotos.length}
                    totalCount={totalCount}
                  />
                </div>

                <div className="mb-4 flex items-center justify-between">
                  <ViewModeToggle
                    viewMode={filters.viewMode}
                    onChange={(mode) => setFilters({ viewMode: mode })}
                  />
                </div>

                <BlurFade inView>{renderPhotoContent()}</BlurFade>

                <div
                  ref={loadMoreRef}
                  className="flex min-h-16 items-center justify-center"
                >
                  {isLoadingMore ? (
                    <p className="text-xs text-zinc-500">Loading more...</p>
                  ) : hasMore ? (
                    <p className="text-xs text-zinc-600">Scroll to load more</p>
                  ) : filteredPhotos.length > 0 ? (
                    <p className="text-xs text-zinc-600">No more photos</p>
                  ) : null}
                </div>
              </>
            ) : (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                    Loading map...
                  </div>
                }
              >
                <LazyPhotoMapView
                  photos={photos}
                  onPhotoClick={(photo) => handlePhotoClick(photo)}
                />
              </Suspense>
            )}
          </>
        )}
      </main>

      {selectedPhoto && (
        <PhotoDetail
          photo={selectedPhoto}
          onClose={closeDetail}
          openingTransition={
            openTransition && openTransition.photoId === selectedPhoto.id
              ? openTransition
              : null
          }
          tags={photoTags[selectedPhoto.id] ?? []}
          canPrev={selectedPhotoIndex > 0}
          canNext={
            selectedPhotoIndex >= 0 && selectedPhotoIndex < displayPhotos.length - 1
          }
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </>
  );
};

export default GalleryView;
