import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Photo, ImageMetadata } from "@/features/photos/types";
import PhotoGrid from "@/features/photos/components/PhotoGrid";
import PhotoDetail from "@/features/photos/components/PhotoDetail";
import PhotoMapView from "@/features/photos/components/PhotoMapView";
import UploadButton from "@/features/photos/components/UploadButton";
import UploadModal from "@/features/photos/components/UploadModal";
import { useBatchPhotoActions } from "@/features/photos/components/hooks/useBatchPhotoActions";
import { Aperture } from "lucide-react";
import { uploadService } from "@/features/photos/services/uploadService";
import { metadataToPhoto } from "@/features/photos/services/photoMapper";
import { Badge } from "@/shared/ui/badge";
import { useLocalStorageState } from "@/shared/lib/useLocalStorageState";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";

interface GalleryShellProps {
  routePhotoId: string | null;
}

interface PhotoOpenTransition {
  photoId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: number;
}

const FAVORITE_STORAGE_KEY = "lumina.photo_favorites";
const TAG_STORAGE_KEY = "lumina.photo_tags";

const getModeButtonClass = (isActive: boolean): string =>
  `inline-flex h-9 items-center rounded-lg border px-3 text-xs transition ${
    isActive
      ? "border-[#c9a962]/35 bg-[#c9a962]/15 text-[#e8d19a]"
      : "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/[0.14]"
  }`;

const GalleryShell: React.FC<GalleryShellProps> = ({ routePhotoId }) => {
  const [routePhoto, setRoutePhoto] = useState<Photo | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteTokenConfigured, setIsDeleteTokenConfigured] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [openTransition, setOpenTransition] = useState<PhotoOpenTransition | null>(null);
  const [favoriteIdList, setFavoriteIdList] = useLocalStorageState<string[]>(FAVORITE_STORAGE_KEY, []);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [photoTags, setPhotoTags] = useLocalStorageState<Record<string, string[]>>(TAG_STORAGE_KEY, {});
  const navigate = useNavigate();

  const favoriteIds = useMemo(() => new Set(favoriteIdList), [favoriteIdList]);

  const navigateToPhoto = useCallback((photoId: string): void => {
    navigate(`/photos/${encodeURIComponent(photoId)}`);
  }, [navigate]);

  const closeDetailRoute = useCallback((): void => {
    setOpenTransition(null);
    navigate("/", { replace: true });
  }, [navigate]);

  const handleUploadComplete = useCallback((metadata: ImageMetadata) => {
    const newPhoto = metadataToPhoto(metadata);
    setPhotos((prev) => [newPhoto, ...prev.filter((photo) => photo.id !== metadata.image_id)]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPhotos = async (): Promise<void> => {
      try {
        const images = await uploadService.listAllImages(50);
        if (!cancelled && images.length > 0) {
          setPhotos(images.map(metadataToPhoto));
        }
      } catch (error) {
        console.error("Failed to load images, fallback to mock data:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPhotos();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refreshDeleteTokenState = (): void => {
      setIsDeleteTokenConfigured(uploadService.hasUploadToken());
    };
    refreshDeleteTokenState();
    window.addEventListener("focus", refreshDeleteTokenState);
    return () => {
      window.removeEventListener("focus", refreshDeleteTokenState);
    };
  }, []);

  const selectedPhoto = useMemo(() => {
    if (!routePhotoId) return null;
    return photos.find((photo) => photo.id === routePhotoId) ?? routePhoto;
  }, [photos, routePhoto, routePhotoId]);

  const selectedPhotoIndex = useMemo(() => {
    if (!selectedPhoto) return -1;
    return photos.findIndex((photo) => photo.id === selectedPhoto.id);
  }, [photos, selectedPhoto]);

  useEffect(() => {
    if (!routePhotoId) {
      setRoutePhoto(null);
      setOpenTransition(null);
      return;
    }

    const existing = photos.find((photo) => photo.id === routePhotoId);
    if (existing) {
      setRoutePhoto(existing);
      return;
    }

    let cancelled = false;
    const loadRoutePhoto = async (): Promise<void> => {
      try {
        const metadata = await uploadService.getImage(routePhotoId);
        if (!cancelled) {
          setRoutePhoto(metadataToPhoto(metadata));
        }
      } catch (error) {
        console.error("Failed to load route photo:", error);
        if (!cancelled) {
          navigate("/", { replace: true });
        }
      }
    };

    void loadRoutePhoto();

    return () => {
      cancelled = true;
    };
  }, [navigate, photos, routePhotoId]);

  useEffect(() => {
    if (!selectedPhoto) return;
    setIsDeleteTokenConfigured(uploadService.hasUploadToken());
  }, [selectedPhoto]);

  const handleDeletePhoto = useCallback(async (photoId: string): Promise<void> => {
    if (deletingPhotoId === photoId) {
      return;
    }
    if (!uploadService.hasUploadToken()) {
      setIsDeleteTokenConfigured(false);
      window.alert("缺少 upload_token，无法删除。");
      return;
    }

    try {
      setDeletingPhotoId(photoId);
      await uploadService.deleteImage(photoId);
      setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
      if (routePhotoId === photoId) {
        navigate("/", { replace: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      window.alert(message);
    } finally {
      setDeletingPhotoId((prev) => (prev === photoId ? null : prev));
      setIsDeleteTokenConfigured(uploadService.hasUploadToken());
    }
  }, [deletingPhotoId, navigate, routePhotoId]);

  const handleToggleFavorite = useCallback((photoId: string): void => {
    setFavoriteIdList((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return Array.from(next);
    });
  }, [setFavoriteIdList]);

  const {
    isBatchMode,
    selectedIds,
    handleBatchSelectToggle,
    handleBatchDelete,
    handleBatchFavorite,
    handleBatchDownload,
    handleBatchTag,
    handleToggleBatchMode,
    handleSelectAllVisible,
    handleClearSelection,
  } = useBatchPhotoActions({
    photos,
    isDeleteTokenConfigured,
    setFavoriteIdList,
    setPhotoTags,
    onDeletePhoto: handleDeletePhoto,
    onDeleteTokenMissing: () => setIsDeleteTokenConfigured(false),
  });

  return (
    <div className="min-h-screen">
      <div className="app-background" aria-hidden="true" />
      <div className="app-vignette" aria-hidden="true" />
      <header className="sticky top-5 z-30 px-5 sm:px-8">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 text-sm shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-3xl sm:px-8">
          <div className="flex min-w-0 items-center gap-5 sm:gap-6">
            <div className="flex items-center gap-3.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#c9a962]/15 to-transparent">
                <div className="absolute inset-0 rounded-xl border border-[#c9a962]/20" />
                <Aperture size={16} className="text-[#c9a962]" strokeWidth={1.5} />
              </div>
              <span className="font-display text-lg tracking-wide text-white sm:text-xl">
                Lumina
              </span>
            </div>
            <div className="h-5 w-px bg-white/[0.06]" />
            <Badge variant="secondary" className="border-white/[0.04] bg-white/[0.02] font-mono text-[11px] font-normal tracking-wide text-zinc-300">
              {photos.length}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className={getModeButtonClass(viewMode === "grid")}
              onClick={() => setViewMode("grid")}
            >
              网格
            </button>
            <button
              type="button"
              className={getModeButtonClass(viewMode === "map")}
              onClick={() => setViewMode("map")}
            >
              地图
            </button>
            {isDeleteTokenConfigured && (
              <button
                type="button"
                className={getModeButtonClass(isBatchMode)}
                onClick={handleToggleBatchMode}
              >
                批量
              </button>
            )}
            <UploadButton onClick={() => setIsUploadModalOpen(true)} />
          </div>
        </div>
      </header>

      <main
        className={
          viewMode === "map"
            ? "mx-auto mt-4 h-[calc(100svh-128px)] w-full max-w-[1440px] flex-grow px-5 pb-4 sm:px-8 sm:pb-6"
            : "mx-auto mt-8 w-full max-w-[1440px] flex-grow px-5 pb-12 sm:px-8 sm:pb-16"
        }
      >
        {isBatchMode && (
          <div className='mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-zinc-300 shadow-[0_10px_40px_rgba(0,0,0,0.35)]'>
            <span className='mr-2 text-zinc-400'>已选 {selectedIds.size}</span>
            <button
              type='button'
              className='rounded-md border border-white/[0.12] px-2 py-1 hover:bg-white/[0.08]'
              onClick={handleSelectAllVisible}
            >
              全选当前结果
            </button>
            <button
              type='button'
              className='rounded-md border border-white/[0.12] px-2 py-1 hover:bg-white/[0.08]'
              onClick={handleClearSelection}
            >
              清空
            </button>
            <button
              type='button'
              className='rounded-md border border-white/[0.12] px-2 py-1 hover:bg-white/[0.08]'
              onClick={handleBatchFavorite}
            >
              批量收藏
            </button>
            <button
              type='button'
              className='rounded-md border border-white/[0.12] px-2 py-1 hover:bg-white/[0.08]'
              onClick={handleBatchTag}
            >
              批量标签
            </button>
            <button
              type='button'
              className='rounded-md border border-white/[0.12] px-2 py-1 hover:bg-white/[0.08]'
              onClick={handleBatchDownload}
            >
              批量下载
            </button>
            <button
              type='button'
              className='rounded-md border border-rose-300/40 px-2 py-1 text-rose-200 hover:bg-rose-500/20'
              onClick={() => {
                void handleBatchDelete();
              }}
            >
              批量删除
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/[0.06] border-t-[#c9a962]/60" />
            </div>
            <p className="text-xs font-light tracking-wide text-zinc-400">加载相册中...</p>
          </div>
        ) : (
          <>
            {viewMode === "grid" ? (
              <PhotoGrid
                photos={photos}
                onPhotoClick={(photo, transitionSource) => {
                  setOpenTransition(transitionSource);
                  navigateToPhoto(photo.id);
                }}
                favoriteIds={favoriteIds}
                onToggleFavorite={handleToggleFavorite}
                selectionMode={isBatchMode}
                selectedIds={selectedIds}
                onToggleSelect={handleBatchSelectToggle}
              />
            ) : (
              <PhotoMapView
                photos={photos}
                onPhotoClick={(photo) => {
                  setOpenTransition(null);
                  navigateToPhoto(photo.id);
                }}
              />
            )}
          </>
        )}
      </main>

      {selectedPhoto && (
        <PhotoDetail
          photo={selectedPhoto}
          onClose={closeDetailRoute}
          canDelete={isDeleteTokenConfigured}
          isDeleting={deletingPhotoId === selectedPhoto.id}
          onDelete={handleDeletePhoto}
          openingTransition={openTransition && openTransition.photoId === selectedPhoto.id ? openTransition : null}
          isFavorite={favoriteIds.has(selectedPhoto.id)}
          onToggleFavorite={handleToggleFavorite}
          tags={photoTags[selectedPhoto.id] ?? []}
          canPrev={selectedPhotoIndex > 0}
          canNext={selectedPhotoIndex >= 0 && selectedPhotoIndex < photos.length - 1}
          onPrev={() => {
            if (selectedPhotoIndex <= 0) return;
            setOpenTransition(null);
            navigateToPhoto(photos[selectedPhotoIndex - 1].id);
          }}
          onNext={() => {
            if (selectedPhotoIndex < 0 || selectedPhotoIndex >= photos.length - 1) return;
            setOpenTransition(null);
            navigateToPhoto(photos[selectedPhotoIndex + 1].id);
          }}
        />
      )}

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
};

const GalleryRoute: React.FC = () => {
  const { photoId } = useParams();
  return <GalleryShell routePhotoId={photoId ?? null} />;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<GalleryRoute />} />
      <Route path="/photos/:photoId" element={<GalleryRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
