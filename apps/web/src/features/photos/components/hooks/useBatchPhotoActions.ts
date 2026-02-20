import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Photo } from "@/features/photos/types";

interface UseBatchPhotoActionsParams {
  photos: Photo[];
  isDeleteTokenConfigured: boolean;
  setFavoriteIdList: Dispatch<SetStateAction<string[]>>;
  setPhotoTags: Dispatch<SetStateAction<Record<string, string[]>>>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onDeleteTokenMissing: () => void;
  initialBatchMode?: boolean;
}

interface UseBatchPhotoActionsResult {
  isBatchMode: boolean;
  selectedIds: Set<string>;
  handleBatchSelectToggle: (photoId: string) => void;
  handleBatchDelete: () => Promise<void>;
  handleBatchFavorite: () => void;
  handleBatchDownload: () => void;
  handleBatchTag: () => void;
  handleToggleBatchMode: () => void;
  handleSelectAllVisible: () => void;
  handleClearSelection: () => void;
}

export const useBatchPhotoActions = ({
  photos,
  isDeleteTokenConfigured,
  setFavoriteIdList,
  setPhotoTags,
  onDeletePhoto,
  onDeleteTokenMissing,
  initialBatchMode = false,
}: UseBatchPhotoActionsParams): UseBatchPhotoActionsResult => {
  const [isBatchMode, setIsBatchMode] = useState(initialBatchMode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set<string>());

  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(photos.map((photo) => photo.id));
      const prevIds = Array.from<string>(prev);
      return new Set<string>(prevIds.filter((id) => visible.has(id)));
    });
  }, [photos]);

  const handleBatchSelectToggle = useCallback((photoId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  const handleBatchDelete = useCallback(async (): Promise<void> => {
    if (selectedIds.size === 0) return;
    if (!isDeleteTokenConfigured) {
      onDeleteTokenMissing();
      window.alert("Missing upload_token. Batch delete is unavailable.");
      return;
    }
    const confirmed = window.confirm(
      `Delete ${selectedIds.size} selected photos? This action cannot be undone.`
    );
    if (!confirmed) return;
    for (const id of selectedIds) {
      await onDeletePhoto(id);
    }
    setSelectedIds(new Set<string>());
  }, [isDeleteTokenConfigured, onDeletePhoto, onDeleteTokenMissing, selectedIds]);

  const handleBatchFavorite = useCallback((): void => {
    setFavoriteIdList((prev) => {
      const next = new Set(prev);
      for (const id of selectedIds) {
        next.add(id);
      }
      return Array.from(next);
    });
  }, [selectedIds, setFavoriteIdList]);

  const handleBatchDownload = useCallback((): void => {
    const targets = photos.filter((photo) => selectedIds.has(photo.id));
    for (const photo of targets) {
      const link = document.createElement("a");
      link.href = photo.url;
      link.download = photo.filename || `${photo.id}.jpg`;
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
    }
  }, [photos, selectedIds]);

  const handleBatchTag = useCallback((): void => {
    if (selectedIds.size === 0) return;
    const tag = window.prompt("Enter a tag to add to selected photos", "");
    const normalized = tag?.trim();
    if (!normalized) return;
    setPhotoTags((prev) => {
      const next: Record<string, string[]> = { ...prev };
      for (const id of selectedIds) {
        const oldTags = next[id] ?? [];
        if (!oldTags.includes(normalized)) {
          next[id] = [...oldTags, normalized];
        }
      }
      return next;
    });
  }, [selectedIds, setPhotoTags]);

  const handleToggleBatchMode = useCallback((): void => {
    setIsBatchMode((prev) => !prev);
    setSelectedIds(new Set<string>());
  }, []);

  const handleSelectAllVisible = useCallback((): void => {
    setSelectedIds(new Set(photos.map((photo) => photo.id)));
  }, [photos]);

  const handleClearSelection = useCallback((): void => {
    setSelectedIds(new Set<string>());
  }, []);

  return {
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
  };
};
