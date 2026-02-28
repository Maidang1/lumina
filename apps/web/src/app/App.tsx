import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BlurFade } from "@/shared/magicui/blur-fade";
import { NumberTicker } from "@/shared/magicui/number-ticker";
import { ScrollProgress } from "@/shared/magicui/scroll-progress";
import { AnimatedGridPattern } from "@/shared/magicui/animated-grid-pattern";
import {
  Navigate,
  Route,
  Routes,
  useSearchParams,
} from "react-router-dom";
import PhotoGrid from "@/features/photos/components/PhotoGrid";
import PhotoDetail from "@/features/photos/components/PhotoDetail";
import { usePhotosCollection } from "@/features/photos/hooks/usePhotosCollection";
import { useLocalStorageState } from "@/shared/lib/useLocalStorageState";
import { PhotoOpenTransition } from "@/features/photos/types";
import { imagePrefetchService } from "@/features/photos/services/imagePrefetchService";

const TAG_STORAGE_KEY = "lumina.photo_tags";
type GalleryTab = "gallery" | "map";
const LazyPhotoMapView = lazy(
  () => import("@/features/photos/components/PhotoMapView"),
);

const GalleryShell: React.FC = () => {
  const {
    photos,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  } = usePhotosCollection();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [openTransition, setOpenTransition] =
    useState<PhotoOpenTransition | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const viewMode: GalleryTab = tabParam === "map" ? "map" : "gallery";
  const [photoTags] = useLocalStorageState<Record<string, string[]>>(
    TAG_STORAGE_KEY,
    {},
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tabParam === "gallery" || tabParam === "map" || tabParam === null) {
      return;
    }
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("tab", "gallery");
    setSearchParams(nextSearchParams, { replace: true });
  }, [searchParams, setSearchParams, tabParam]);

  const closeDetail = useCallback((): void => {
    setSelectedPhotoId(null);
    setOpenTransition(null);
  }, []);

  const selectedPhoto = useMemo(() => {
    if (!selectedPhotoId) return null;
    return photos.find((photo) => photo.id === selectedPhotoId) ?? null;
  }, [photos, selectedPhotoId]);

  const selectedPhotoIndex = useMemo(() => {
    if (!selectedPhoto) return -1;
    return photos.findIndex((photo) => photo.id === selectedPhoto.id);
  }, [photos, selectedPhoto]);

  useEffect(() => {
    if (!selectedPhoto || selectedPhotoIndex < 0) return;
    imagePrefetchService.prefetch(selectedPhoto.url, { priority: "high" });

    const prevPhoto = photos[selectedPhotoIndex - 1];
    const nextPhoto = photos[selectedPhotoIndex + 1];
    if (prevPhoto) {
      imagePrefetchService.prefetch(prevPhoto.url, { priority: "low" });
    }
    if (nextPhoto) {
      imagePrefetchService.prefetch(nextPhoto.url, { priority: "low" });
    }
  }, [photos, selectedPhoto, selectedPhotoIndex]);

  useEffect(() => {
    if (
      viewMode !== "gallery" ||
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
  }, [hasMore, isLoading, isLoadingMore, loadMore, viewMode, photos.length]);

  const handleTabChange = useCallback(
    (nextTab: GalleryTab): void => {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("tab", nextTab);
      setSearchParams(nextSearchParams);
    },
    [searchParams, setSearchParams],
  );

  return (
    <div className="relative min-h-screen bg-lumina-bg text-lumina-text">
      <ScrollProgress />
      <div className="pointer-events-none fixed inset-0 z-0">
        <AnimatedGridPattern
          className="opacity-25"
          numSquares={35}
          maxOpacity={0.35}
          duration={5}
          repeatDelay={1}
        />
      </div>

      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1720px] px-2 sm:px-4">
        <div className="mx-auto mt-2 flex h-16 items-center justify-between rounded-xl border border-white/[0.12] bg-[#080b10]/82 px-4 shadow-[var(--shadow-elevation-3)] backdrop-blur-xl sm:mt-3 sm:h-20 sm:px-8">
          <div className="flex items-center gap-3 sm:gap-6">
            <span className="font-display text-2xl tracking-tight text-lumina-text sm:text-3xl">
              Lumina
            </span>
            <div className="hidden h-3 w-px bg-lumina-border sm:block" />
            <span className="hidden pt-0.5 font-mono text-xs tracking-wider text-lumina-muted uppercase sm:inline">
              Portfolio
            </span>
          </div>

          <div className="flex items-center gap-4 sm:gap-8">
            <div className="hidden items-center gap-3 text-xs text-lumina-text-secondary sm:flex">
              <span className="uppercase">Photos</span>
              <NumberTicker value={photos.length} className="text-sm text-lumina-text" />
            </div>
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 text-sm font-medium sm:gap-1">
              <button
                type="button"
                className={`cursor-pointer rounded-md px-3 py-1.5 transition-colors duration-200 ${viewMode === "gallery" ? "bg-white/12 text-white" : "text-white/45 hover:text-white/75"}`}
                onClick={() => handleTabChange("gallery")}
              >
                Gallery
              </button>
              <button
                type="button"
                className={`cursor-pointer rounded-md px-3 py-1.5 transition-colors duration-200 ${viewMode === "map" ? "bg-white/12 text-white" : "text-white/45 hover:text-white/75"}`}
                onClick={() => handleTabChange("map")}
              >
                Map
              </button>
            </div>
          </div>
        </div>
      </header>

      <main
        className={
          viewMode === "map"
            ? "mx-auto h-[calc(100svh-72px)] w-full max-w-[1720px] flex-grow overflow-hidden px-2 sm:h-[calc(100svh-96px)] sm:px-4"
            : "mx-auto w-full max-w-[1720px] flex-grow px-2 pt-2 sm:px-4 sm:pt-4"
        }
      >
        {isLoading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/[0.06] border-t-[#c9a962]/60" />
            </div>
            <p className="text-xs font-light tracking-wide text-zinc-400">
              Loading gallery...
            </p>
          </div>
        ) : error && photos.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => {
                void refresh();
              }}
              className="rounded-md border border-white/20 px-4 py-2 text-xs tracking-wide text-white transition-colors hover:bg-white/10"
            >
              Retry
            </button>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-zinc-300">No photos yet.</p>
            <p className="text-xs text-zinc-500">
              Run Desktop or CLI upload first, then refresh this page.
            </p>
          </div>
        ) : (
          <>
            {viewMode === "gallery" ? (
              <>
                <BlurFade inView>
                  <PhotoGrid
                    photos={photos}
                    onPhotoClick={(photo, transitionSource) => {
                      imagePrefetchService.prefetch(photo.url, { priority: "high" });
                      setOpenTransition(transitionSource);
                      setSelectedPhotoId(photo.id);
                    }}
                  />
                </BlurFade>
                <div
                  ref={loadMoreRef}
                  className="flex min-h-16 items-center justify-center"
                >
                  {isLoadingMore ? (
                    <p className="text-xs text-zinc-500">Loading more...</p>
                  ) : hasMore ? (
                    <p className="text-xs text-zinc-600">Scroll to load more</p>
                  ) : (
                    <p className="text-xs text-zinc-600">No more photos</p>
                  )}
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
                  onPhotoClick={(photo) => {
                    imagePrefetchService.prefetch(photo.url, { priority: "high" });
                    setOpenTransition(null);
                    setSelectedPhotoId(photo.id);
                  }}
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
            selectedPhotoIndex >= 0 && selectedPhotoIndex < photos.length - 1
          }
          onPrev={() => {
            if (selectedPhotoIndex <= 0) return;
            setOpenTransition(null);
            setSelectedPhotoId(photos[selectedPhotoIndex - 1].id);
          }}
          onNext={() => {
            if (
              selectedPhotoIndex < 0 ||
              selectedPhotoIndex >= photos.length - 1
            )
              return;
            setOpenTransition(null);
            setSelectedPhotoId(photos[selectedPhotoIndex + 1].id);
          }}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<GalleryShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
