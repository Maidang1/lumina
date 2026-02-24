import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useSearchParams,
} from "react-router-dom";
import PhotoGrid from "@/features/photos/components/PhotoGrid";
import PhotoDetail from "@/features/photos/components/PhotoDetail";
import PhotoMapView from "@/features/photos/components/PhotoMapView";
import UploadPage from "@/features/photos/pages/UploadPage";
import ManagePage from "@/features/photos/pages/ManagePage";
import { usePhotosCollection } from "@/features/photos/hooks/usePhotosCollection";
import { useLocalStorageState } from "@/shared/lib/useLocalStorageState";
import { PhotoOpenTransition } from "@/features/photos/types";
import { imagePrefetchService } from "@/features/photos/services/imagePrefetchService";

const TAG_STORAGE_KEY = "lumina.photo_tags";
type GalleryTab = "gallery" | "map";

const GalleryShell: React.FC = () => {
  const { photos, isLoading } = usePhotosCollection();
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

  const handleTabChange = useCallback(
    (nextTab: GalleryTab): void => {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("tab", nextTab);
      setSearchParams(nextSearchParams);
    },
    [searchParams, setSearchParams],
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1720px]">
        <div className="mx-auto flex h-16 items-center justify-between border-b border-white/[0.08] bg-[#080808]/90 px-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:h-20 sm:px-8">
          <div className="flex items-center gap-3 sm:gap-6">
            <span className="font-serif text-2xl tracking-tight text-lumina-text sm:text-3xl">
              Lumina
            </span>
            <div className="hidden h-3 w-px bg-lumina-border sm:block" />
            <span className="hidden pt-0.5 font-mono text-xs tracking-wider text-lumina-muted uppercase sm:inline">
              Portfolio
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-8">
            <div className="flex items-center gap-4 text-sm font-medium sm:gap-6">
              <button
                type="button"
                className={`cursor-pointer transition-colors duration-200 ${viewMode === "gallery" ? "text-white" : "text-white/40 hover:text-white/75"}`}
                onClick={() => handleTabChange("gallery")}
              >
                Gallery
              </button>
              <button
                type="button"
                className={`cursor-pointer transition-colors duration-200 ${viewMode === "map" ? "text-white" : "text-white/40 hover:text-white/75"}`}
                onClick={() => handleTabChange("map")}
              >
                Map
              </button>
            </div>

            <div className="h-4 w-px bg-lumina-border-subtle" />

            <Link
              to="/manage"
              className="text-sm font-medium text-white/40 transition-colors duration-200 hover:text-white/75"
            >
              Manage
            </Link>
          </div>
        </div>
      </header>

      <main
        className={
          viewMode === "map"
            ? "mx-auto h-[calc(100svh-64px)] w-full max-w-[1720px] flex-grow overflow-hidden border-t border-white/[0.06] bg-black sm:h-[calc(100svh-80px)]"
            : "mx-auto w-full max-w-[1720px] flex-grow"
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
        ) : (
          <>
            {viewMode === "gallery" ? (
              <PhotoGrid
                photos={photos}
                onPhotoClick={(photo, transitionSource) => {
                  imagePrefetchService.prefetch(photo.url, { priority: "high" });
                  setOpenTransition(transitionSource);
                  setSelectedPhotoId(photo.id);
                }}
              />
            ) : (
              <PhotoMapView
                photos={photos}
                onPhotoClick={(photo) => {
                  imagePrefetchService.prefetch(photo.url, { priority: "high" });
                  setOpenTransition(null);
                  setSelectedPhotoId(photo.id);
                }}
              />
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
      <Route path="/manage" element={<ManagePage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
