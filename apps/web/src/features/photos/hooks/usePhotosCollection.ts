import { useCallback, useEffect, useState } from "react";
import type { Photo } from "@/features/photos/types";
import { metadataToPhoto } from "@/features/photos/services/photoMapper";
import { uploadService } from "@/features/photos/services/uploadService";

interface UsePhotosCollectionResult {
  photos: Photo[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  removePhotoById: (photoId: string) => void;
}

export const usePhotosCollection = (): UsePhotosCollectionResult => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const images = await uploadService.listAllImages(50);
      setPhotos(images.map(metadataToPhoto));
    } catch (error) {
      console.error("Failed to load images:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const removePhotoById = useCallback((photoId: string): void => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
  }, []);

  return {
    photos,
    isLoading,
    refresh,
    removePhotoById,
  };
};
