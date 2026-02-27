import { useCallback, useEffect, useState } from "react";
import type { Photo } from "@/features/photos/types";
import { metadataToPhoto } from "@/features/photos/services/photoMapper";
import { galleryApi } from "@/features/photos/services/galleryApi";

interface UsePhotosCollectionResult {
  photos: Photo[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  removePhotoById: (photoId: string) => void;
}

export const usePhotosCollection = (): UsePhotosCollectionResult => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 50;

  const upsertPhotos = useCallback((incoming: Photo[], replace: boolean): void => {
    setPhotos((previous) => {
      if (replace) {
        return incoming;
      }
      const next = new Map(previous.map((photo) => [photo.id, photo]));
      for (const photo of incoming) {
        next.set(photo.id, photo);
      }
      return Array.from(next.values());
    });
  }, []);

  const fetchPage = useCallback(async (cursor?: string, replace: boolean = false): Promise<void> => {
    try {
      setError(null);
      const page = await galleryApi.listImages(cursor, PAGE_SIZE);
      const mapped = page.images.map(metadataToPhoto);
      upsertPhotos(mapped, replace);
      setNextCursor(page.next_cursor);
      setHasMore(Boolean(page.next_cursor));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load images";
      setError(message);
      setHasMore(false);
      setNextCursor(undefined);
    } finally {
      if (replace) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [upsertPhotos]);

  useEffect(() => {
    void fetchPage(undefined, true);
  }, [fetchPage]);

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setIsLoadingMore(false);
    setHasMore(true);
    setNextCursor(undefined);
    await fetchPage(undefined, true);
  }, [fetchPage]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (isLoading || isLoadingMore || !hasMore || !nextCursor) {
      return;
    }
    setIsLoadingMore(true);
    await fetchPage(nextCursor, false);
  }, [fetchPage, hasMore, isLoading, isLoadingMore, nextCursor]);

  const removePhotoById = useCallback((photoId: string): void => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
  }, []);

  return {
    photos,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    removePhotoById,
  };
};
