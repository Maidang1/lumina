import React, { useState, useCallback, useEffect } from "react";
import { Photo, ImageMetadata } from "./types";
import PhotoGrid from "./components/PhotoGrid";
import PhotoDetail from "./components/PhotoDetail";
import UploadButton from "./components/UploadButton";
import UploadModal from "./components/UploadModal";
import { Aperture } from "lucide-react";
import { uploadService } from "./services/uploadService";
import { metadataToPhoto } from "./services/photoMapper";
import { Badge } from "./components/ui/badge";

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
    <div className="min-h-screen bg-[#0f0f0f] text-gray-300 flex flex-col">
      <header className="sticky top-0 z-30 bg-[#1a1a1a] border-b border-black/20 h-12 flex items-center justify-between px-4 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-medium text-white">
            <Aperture size={16} className="text-white" />
            <span>madinah's life</span>
          </div>
          <Badge variant="secondary" className="font-mono text-gray-400">
            {photos.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <UploadButton onClick={() => setIsUploadModalOpen(true)} />
        </div>
      </header>

      <main className="flex-grow">
        {isLoading ? (
          <div className="h-full min-h-[40vh] flex items-center justify-center text-sm text-gray-500">
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
