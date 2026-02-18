import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Photo, ImageMetadata } from "@/features/photos/types";
import PhotoGrid from "@/features/photos/components/PhotoGrid";
import PhotoDetail from "@/features/photos/components/PhotoDetail";
import UploadButton from "@/features/photos/components/UploadButton";
import UploadModal from "@/features/photos/components/UploadModal";
import { Aperture } from "lucide-react";
import { uploadService } from "@/features/photos/services/uploadService";
import { metadataToPhoto } from "@/features/photos/services/photoMapper";
import { Badge } from "@/shared/ui/badge";
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

const GalleryShell: React.FC<GalleryShellProps> = ({ routePhotoId }) => {
  const [routePhoto, setRoutePhoto] = useState<Photo | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteTokenConfigured, setIsDeleteTokenConfigured] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [openTransition, setOpenTransition] = useState<PhotoOpenTransition | null>(null);
  const navigate = useNavigate();

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
            <UploadButton onClick={() => setIsUploadModalOpen(true)} />
          </div>
        </div>
      </header>

      <main className="mx-auto mt-8 w-full max-w-[1440px] flex-grow px-5 pb-12 sm:px-8 sm:pb-16">
        {isLoading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/[0.06] border-t-[#c9a962]/60" />
            </div>
            <p className="text-xs font-light tracking-wide text-zinc-400">加载相册中...</p>
          </div>
        ) : (
          <PhotoGrid
            photos={photos}
            onPhotoClick={(photo, transitionSource) => {
              setOpenTransition(transitionSource);
              navigateToPhoto(photo.id);
            }}
          />
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
