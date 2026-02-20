import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Photo } from "@/features/photos/types";
import PhotoGrid from "@/features/photos/components/PhotoGrid";
import PhotoDetail from "@/features/photos/components/PhotoDetail";
import PhotoMapView from "@/features/photos/components/PhotoMapView";
import UploadButton from "@/features/photos/components/UploadButton";
import { useBatchPhotoActions } from "@/features/photos/components/hooks/useBatchPhotoActions";
import { uploadService } from "@/features/photos/services/uploadService";
import { metadataToPhoto } from "@/features/photos/services/photoMapper";
import { useLocalStorageState } from "@/shared/lib/useLocalStorageState";
import UploadPage from "@/features/photos/pages/UploadPage";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

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

const GalleryShell: React.FC = () => {
  const navigate = useNavigate();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteTokenConfigured, setIsDeleteTokenConfigured] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [openTransition, setOpenTransition] = useState<PhotoOpenTransition | null>(null);
  const [favoriteIdList, setFavoriteIdList] = useLocalStorageState<string[]>(FAVORITE_STORAGE_KEY, []);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [photoTags, setPhotoTags] = useLocalStorageState<Record<string, string[]>>(TAG_STORAGE_KEY, {});

  const favoriteIds = useMemo(() => new Set(favoriteIdList), [favoriteIdList]);

  const closeDetail = useCallback((): void => {
    setSelectedPhotoId(null);
    setOpenTransition(null);
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
    if (!selectedPhotoId) return null;
    return photos.find((photo) => photo.id === selectedPhotoId) ?? null;
  }, [photos, selectedPhotoId]);

  const selectedPhotoIndex = useMemo(() => {
    if (!selectedPhoto) return -1;
    return photos.findIndex((photo) => photo.id === selectedPhoto.id);
  }, [photos, selectedPhoto]);

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
      if (selectedPhotoId === photoId) {
        setSelectedPhotoId(null);
        setOpenTransition(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      window.alert(message);
    } finally {
      setDeletingPhotoId((prev) => (prev === photoId ? null : prev));
      setIsDeleteTokenConfigured(uploadService.hasUploadToken());
    }
  }, [deletingPhotoId, selectedPhotoId]);

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
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1720px]">
        <div className="mx-auto flex h-20 items-center justify-between border-b border-white/[0.08] bg-[#080808]/90 px-5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-6">
            <span className="font-serif text-3xl tracking-tight text-lumina-text">
              Lumina
            </span>
            <div className="h-3 w-px bg-lumina-border" />
            <span className="pt-0.5 font-mono text-xs tracking-wider text-lumina-muted uppercase">
              Portfolio
            </span>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-6 text-sm font-medium">
              <button
                type="button"
                className={`cursor-pointer transition-colors duration-200 ${viewMode === "grid" ? "text-white" : "text-white/40 hover:text-white/75"}`}
                onClick={() => setViewMode("grid")}
              >
                Gallery
              </button>
              <button
                type="button"
                className={`cursor-pointer transition-colors duration-200 ${viewMode === "map" ? "text-white" : "text-white/40 hover:text-white/75"}`}
                onClick={() => setViewMode("map")}
              >
                Map
              </button>
              {isDeleteTokenConfigured && (
                <button
                  type="button"
                  className={`cursor-pointer transition-colors duration-200 ${isBatchMode ? "text-white" : "text-white/40 hover:text-white/75"}`}
                  onClick={handleToggleBatchMode}
                >
                  Manage
                </button>
              )}
            </div>
            
            <div className="h-4 w-px bg-lumina-border-subtle" />
            
            <UploadButton onClick={() => navigate("/upload")} />
          </div>
        </div>
      </header>

      <main
        className={
          viewMode === "map"
            ? "mx-auto h-[calc(100svh-80px)] w-full max-w-[1720px] flex-grow overflow-hidden border-t border-white/[0.06] bg-black"
            : "mx-auto w-full max-w-[1720px] flex-grow"
        }
      >
        {isBatchMode && (
          <div className='mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-zinc-300 shadow-[0_14px_40px_rgba(0,0,0,0.4)] backdrop-blur-md'>
            <span className='mr-2 text-zinc-400'>已选 {selectedIds.size}</span>
            <button
              type='button'
              className='cursor-pointer rounded-md border border-white/[0.14] px-2 py-1 transition-colors duration-200 hover:bg-white/[0.09]'
              onClick={handleSelectAllVisible}
            >
              全选当前结果
            </button>
            <button
              type='button'
              className='cursor-pointer rounded-md border border-white/[0.14] px-2 py-1 transition-colors duration-200 hover:bg-white/[0.09]'
              onClick={handleClearSelection}
            >
              清空
            </button>
            <button
              type='button'
              className='cursor-pointer rounded-md border border-white/[0.14] px-2 py-1 transition-colors duration-200 hover:bg-white/[0.09]'
              onClick={handleBatchFavorite}
            >
              批量收藏
            </button>
            <button
              type='button'
              className='cursor-pointer rounded-md border border-white/[0.14] px-2 py-1 transition-colors duration-200 hover:bg-white/[0.09]'
              onClick={handleBatchTag}
            >
              批量标签
            </button>
            <button
              type='button'
              className='cursor-pointer rounded-md border border-white/[0.14] px-2 py-1 transition-colors duration-200 hover:bg-white/[0.09]'
              onClick={handleBatchDownload}
            >
              批量下载
            </button>
            <button
              type='button'
              className='cursor-pointer rounded-md border border-rose-300/40 px-2 py-1 text-rose-200 transition-colors duration-200 hover:bg-rose-500/20'
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
                  setSelectedPhotoId(photo.id);
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
            setSelectedPhotoId(photos[selectedPhotoIndex - 1].id);
          }}
          onNext={() => {
            if (selectedPhotoIndex < 0 || selectedPhotoIndex >= photos.length - 1) return;
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
      <Route path="/upload" element={<UploadPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
