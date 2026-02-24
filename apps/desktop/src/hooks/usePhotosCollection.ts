import { useCallback, useEffect, useState } from "react";
import type { Photo } from "@/types/photo";
import { metadataToPhoto } from "@/services/photoMapper";
import { uploadService } from "@/services/uploadService";
import { tauriStorage } from "@/lib/tauri/storage";

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
      const [githubOwner, githubRepo, githubBranch] = await Promise.all([
        tauriStorage.getItem("lumina.github_owner"),
        tauriStorage.getItem("lumina.github_repo"),
        tauriStorage.getItem("lumina.github_branch"),
      ]);
      const images = await uploadService.listAllImages(50);
      setPhotos(
        images.map((image) =>
          metadataToPhoto(image, {
            owner: githubOwner || undefined,
            repo: githubRepo || undefined,
            branch: githubBranch || undefined,
          }),
        ),
      );
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
