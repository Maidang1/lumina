import {
  ChangeEvent,
  Dispatch,
  RefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { uploadService } from "@/features/photos/services/uploadService";
import { useLocalStorageState } from "@/shared/lib/useLocalStorageState";

const FAVORITE_STORAGE_KEY = "lumina.photo_favorites";
const TAG_STORAGE_KEY = "lumina.photo_tags";

interface UseManageActionsParams {
  removePhotoById: (id: string) => void;
}

interface UseManageActionsResult {
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  uploadFileInputRef: RefObject<HTMLInputElement | null>;
  isUploadModalOpen: boolean;
  setIsUploadModalOpen: (open: boolean) => void;
  pendingUploadFiles: File[];
  setPendingUploadFiles: (files: File[]) => void;
  favoriteIds: Set<string>;
  photoTags: Record<string, string[]>;
  setPhotoTags: Dispatch<SetStateAction<Record<string, string[]>>>;
  setFavoriteIdList: Dispatch<SetStateAction<string[]>>;
  isDeleteTokenConfigured: boolean;
  deletingPhotoId: string | null;
  handleOpenUpload: () => void;
  handleUploadFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  handleToggleFavorite: (photoId: string) => void;
  handleDeletePhoto: (photoId: string) => Promise<void>;
  markDeleteTokenMissing: () => void;
}

export const useManageActions = ({ removePhotoById }: UseManageActionsParams): UseManageActionsResult => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const [favoriteIdList, setFavoriteIdList] = useLocalStorageState<string[]>(FAVORITE_STORAGE_KEY, []);
  const [photoTags, setPhotoTags] = useLocalStorageState<Record<string, string[]>>(TAG_STORAGE_KEY, {});
  const [isDeleteTokenConfigured, setIsDeleteTokenConfigured] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const favoriteIds = useMemo(() => new Set(favoriteIdList), [favoriteIdList]);

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

  const handleOpenUpload = useCallback((): void => {
    uploadFileInputRef.current?.click();
  }, []);

  const handleUploadFileSelected = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setPendingUploadFiles(files);
    setIsUploadModalOpen(true);
  }, []);

  const handleDeletePhoto = useCallback(async (photoId: string): Promise<void> => {
    if (deletingPhotoId === photoId) {
      return;
    }

    if (!uploadService.hasUploadToken()) {
      setIsDeleteTokenConfigured(false);
      window.alert("Missing upload_token. Delete is unavailable.");
      return;
    }

    try {
      setDeletingPhotoId(photoId);
      await uploadService.deleteImage(photoId);
      removePhotoById(photoId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed";
      window.alert(message);
    } finally {
      setDeletingPhotoId((prev) => (prev === photoId ? null : prev));
      setIsDeleteTokenConfigured(uploadService.hasUploadToken());
    }
  }, [deletingPhotoId, removePhotoById]);

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

  const markDeleteTokenMissing = useCallback((): void => {
    setIsDeleteTokenConfigured(false);
  }, []);

  return {
    viewMode,
    setViewMode,
    uploadFileInputRef,
    isUploadModalOpen,
    setIsUploadModalOpen,
    pendingUploadFiles,
    setPendingUploadFiles,
    favoriteIds,
    photoTags,
    setPhotoTags,
    setFavoriteIdList,
    isDeleteTokenConfigured,
    deletingPhotoId,
    handleOpenUpload,
    handleUploadFileSelected,
    handleToggleFavorite,
    handleDeletePhoto,
    markDeleteTokenMissing,
  };
};
