import React, { useState, useCallback, useEffect } from "react";
import { Photo, ImageMetadata } from "@/features/photos/types";
import PhotoGrid from "@/features/photos/components/PhotoGrid";
import PhotoDetail from "@/features/photos/components/PhotoDetail";
import UploadButton from "@/features/photos/components/UploadButton";
import UploadModal from "@/features/photos/components/UploadModal";
import { Aperture } from "lucide-react";
import { uploadService } from "@/features/photos/services/uploadService";
import { metadataToPhoto } from "@/features/photos/services/photoMapper";
import { Badge } from "@/shared/ui/badge";

const App: React.FC = () => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="min-h-screen text-gray-300">
      <header className="sticky top-3 z-30 px-3 sm:px-4">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between rounded-2xl border border-white/10 bg-black/55 px-3 text-sm shadow-[0_12px_30px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 font-medium text-white">
              <Aperture size={16} className="text-white" />
              <span className="truncate text-[13px] uppercase tracking-[0.18em] sm:text-sm">
                madinah's life
              </span>
            </div>
            <Badge variant="secondary" className="font-mono text-gray-300">
              {photos.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <UploadButton onClick={() => setIsUploadModalOpen(true)} />
          </div>
        </div>
      </header>

      <main className="mx-auto mt-4 w-full max-w-[1440px] flex-grow px-2 pb-4 sm:px-4 sm:pb-6">
        {isLoading ? (
          <div className="flex min-h-[40vh] h-full items-center justify-center text-sm text-gray-500">
            Loading photos...
          </div>
        ) : (
          <PhotoGrid photos={photos} onPhotoClick={setSelectedPhoto} />
        )}
      </main>

      {selectedPhoto && (
        <PhotoDetail
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
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

export default App;
