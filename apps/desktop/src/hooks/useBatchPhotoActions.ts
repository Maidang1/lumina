import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Photo } from "@/types/photo";

interface UseBatchPhotoActionsParams {
  photos: Photo[];
  isDeleteTokenConfigured: boolean;
  setPhotoTags: Dispatch<SetStateAction<Record<string, string[]>>>;
  onDeletePhoto: (photoId: string) => Promise<boolean>;
  onDeleteTokenMissing: () => void;
  initialBatchMode?: boolean;
}

export interface BatchActionResult {
  action: "delete" | "download" | "tag";
  total: number;
  success: number;
  failed: number;
  at: number;
}

interface UseBatchPhotoActionsResult {
  isBatchMode: boolean;
  selectedIds: Set<string>;
  batchResult: BatchActionResult | null;
  clearBatchResult: () => void;
  handleBatchSelectToggle: (photoId: string) => void;
  handleBatchDelete: () => Promise<void>;
  handleBatchDownload: () => void;
  handleBatchTag: () => void;
  handleToggleBatchMode: () => void;
  handleSelectAllVisible: () => void;
  handleClearSelection: () => void;
}

export const useBatchPhotoActions = ({
  photos,
  isDeleteTokenConfigured,
  setPhotoTags,
  onDeletePhoto,
  onDeleteTokenMissing,
  initialBatchMode = false,
}: UseBatchPhotoActionsParams): UseBatchPhotoActionsResult => {
  const [isBatchMode, setIsBatchMode] = useState(initialBatchMode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set<string>(),
  );
  const [batchResult, setBatchResult] = useState<BatchActionResult | null>(
    null,
  );

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
      `Delete ${selectedIds.size} selected photos? This action cannot be undone.`,
    );
    if (!confirmed) return;
    let success = 0;
    let failed = 0;
    const targetIds = Array.from(selectedIds);
    for (const id of targetIds) {
      const ok = await onDeletePhoto(id);
      if (ok) {
        success += 1;
      } else {
        failed += 1;
      }
    }
    setSelectedIds(new Set<string>());
    setBatchResult({
      action: "delete",
      total: targetIds.length,
      success,
      failed,
      at: Date.now(),
    });
  }, [
    isDeleteTokenConfigured,
    onDeletePhoto,
    onDeleteTokenMissing,
    selectedIds,
  ]);

  const handleBatchDownload = useCallback((): void => {
    const targets = photos.filter((photo) => selectedIds.has(photo.id));
    let success = 0;
    for (const photo of targets) {
      const link = document.createElement("a");
      link.href = photo.url;
      link.download = photo.filename || `${photo.id}.jpg`;
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
      success += 1;
    }
    setBatchResult({
      action: "download",
      total: targets.length,
      success,
      failed: Math.max(0, targets.length - success),
      at: Date.now(),
    });
  }, [photos, selectedIds]);

  const handleBatchTag = useCallback((): void => {
    if (selectedIds.size === 0) return;
    const tag = window.prompt("Enter a tag to add to selected photos", "");
    const normalized = tag?.trim();
    if (!normalized) return;
    let success = 0;
    setPhotoTags((prev) => {
      const next: Record<string, string[]> = { ...prev };
      for (const id of selectedIds) {
        const oldTags = next[id] ?? [];
        if (!oldTags.includes(normalized)) {
          next[id] = [...oldTags, normalized];
          success += 1;
        }
      }
      return next;
    });
    setBatchResult({
      action: "tag",
      total: selectedIds.size,
      success,
      failed: Math.max(0, selectedIds.size - success),
      at: Date.now(),
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

  const clearBatchResult = useCallback((): void => {
    setBatchResult(null);
  }, []);

  return {
    isBatchMode,
    selectedIds,
    batchResult,
    clearBatchResult,
    handleBatchSelectToggle,
    handleBatchDelete,
    handleBatchDownload,
    handleBatchTag,
    handleToggleBatchMode,
    handleSelectAllVisible,
    handleClearSelection,
  };
};
