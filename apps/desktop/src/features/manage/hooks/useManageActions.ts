import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import { uploadService } from "@/services/uploadService";

const TAG_STORAGE_KEY = "lumina.photo_tags";

interface UseManageActionsParams {
  removePhotoById: (id: string) => void;
}

interface UseManageActionsResult {
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  photoTags: Record<string, string[]>;
  setPhotoTags: Dispatch<SetStateAction<Record<string, string[]>>>;
  isDeleteTokenConfigured: boolean;
  deletingPhotoId: string | null;
  handleDeletePhoto: (photoId: string) => Promise<boolean>;
  markDeleteTokenMissing: () => void;
}

export const useManageActions = ({
  removePhotoById,
}: UseManageActionsParams): UseManageActionsResult => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [photoTags, setPhotoTags] = useState<Record<string, string[]>>({});
  const [isDeleteTokenConfigured, setIsDeleteTokenConfigured] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  useEffect(() => {
    const refreshDeleteTokenState = async (): Promise<void> => {
      const hasToken = await uploadService.hasRepoPath();
      setIsDeleteTokenConfigured(hasToken);
    };

    void refreshDeleteTokenState();
    const handleFocus = (): void => {
      void refreshDeleteTokenState();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleDeletePhoto = useCallback(
    async (photoId: string): Promise<boolean> => {
      if (deletingPhotoId === photoId) {
        return false;
      }

      const hasToken = await uploadService.hasRepoPath();
      if (!hasToken) {
        setIsDeleteTokenConfigured(false);
        return false;
      }

      try {
        setDeletingPhotoId(photoId);
        await uploadService.deleteImage(photoId);
        removePhotoById(photoId);
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        console.error(message);
        return false;
      } finally {
        setDeletingPhotoId((prev) => (prev === photoId ? null : prev));
        const hasTokenAfter = await uploadService.hasRepoPath();
        setIsDeleteTokenConfigured(hasTokenAfter);
      }
    },
    [deletingPhotoId, removePhotoById],
  );

  const markDeleteTokenMissing = useCallback((): void => {
    setIsDeleteTokenConfigured(false);
  }, []);

  return {
    viewMode,
    setViewMode,
    photoTags,
    setPhotoTags,
    isDeleteTokenConfigured,
    deletingPhotoId,
    handleDeletePhoto,
    markDeleteTokenMissing,
  };
};
