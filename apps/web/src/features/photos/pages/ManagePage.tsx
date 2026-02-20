import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X, ArrowLeft, LayoutGrid, List } from "lucide-react";
import { Button } from "@/shared/ui/button";
import PhotoGrid from "@/features/photos/components/PhotoGrid";
import PhotoList from "@/features/photos/components/PhotoList";
import UploadWorkspace from "@/features/photos/components/upload/UploadWorkspace";
import { useBatchPhotoActions } from "@/features/photos/components/hooks/useBatchPhotoActions";
import { usePhotosCollection } from "@/features/photos/hooks/usePhotosCollection";
import { uploadService } from "@/features/photos/services/uploadService";
import { useLocalStorageState } from "@/shared/lib/useLocalStorageState";

const FAVORITE_STORAGE_KEY = "lumina.photo_favorites";
const TAG_STORAGE_KEY = "lumina.photo_tags";

const ManagePage: React.FC = () => {
  const { photos, isLoading, refresh, removePhotoById } = usePhotosCollection();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const [favoriteIdList, setFavoriteIdList] = useLocalStorageState<string[]>(FAVORITE_STORAGE_KEY, []);

  const handleOpenUpload = () => {
    uploadFileInputRef.current?.click();
  };

  const handleUploadFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length === 0) {
      return;
    }
    setPendingUploadFiles(files);
    setIsUploadModalOpen(true);
  };
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

  const handleDeletePhoto = useCallback(async (photoId: string): Promise<void> => {
    if (deletingPhotoId === photoId) {
      return;
    }
    if (!uploadService.hasUploadToken()) {
      setIsDeleteTokenConfigured(false);
      window.alert("缺少 upload_token，无法删除。");
      return;
    }

    try {
      setDeletingPhotoId(photoId);
      await uploadService.deleteImage(photoId);
      removePhotoById(photoId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
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

  const {
    isBatchMode,
    selectedIds,
    handleBatchSelectToggle,
    handleBatchDelete,
    handleBatchFavorite,
    handleBatchDownload,
    handleBatchTag,
    handleSelectAllVisible,
    handleClearSelection,
  } = useBatchPhotoActions({
    photos,
    isDeleteTokenConfigured,
    setFavoriteIdList,
    setPhotoTags,
    onDeletePhoto: handleDeletePhoto,
    onDeleteTokenMissing: () => setIsDeleteTokenConfigured(false),
    initialBatchMode: true,
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1720px]">
        <input
          ref={uploadFileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleUploadFileSelected}
        />
        <div className="mx-auto flex h-20 items-center justify-between border-b border-white/[0.08] bg-[#080808]/90 px-5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center text-white/40 transition-colors duration-200 hover:text-white/75">
              <ArrowLeft size={18} />
            </Link>
            <div className="h-3 w-px bg-lumina-border" />
            <span className="font-serif text-2xl tracking-tight text-lumina-text">
              照片库
            </span>
          </div>
          <div>
            <Button
              onClick={handleOpenUpload}
              className="h-9 rounded-md border border-white/[0.14] bg-white/[0.06] px-5 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
            >
              上传文件
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1720px] space-y-6 px-5 sm:px-8">
        <div className="flex items-center justify-between border-b border-white/[0.08] py-4">
          <h2 className="text-sm font-medium text-lumina-text-secondary">图库管理</h2>

          <div className="flex items-center gap-6 text-sm">
            <button className="flex items-center text-white/40 transition-colors hover:text-white/75">
              <span className="mr-1">↑</span> 按上传时间排序
            </button>
            <button className="flex items-center text-white/40 transition-colors hover:text-white/75">
              <span className="mr-1">↓</span> 最新在前
            </button>
            <button
              className="flex items-center text-white/40 transition-colors hover:text-white/75"
              onClick={handleSelectAllVisible}
            >
              <div className={`mr-2 h-4 w-4 rounded border transition-colors ${selectedIds.size > 0 ? 'border-lumina-accent bg-lumina-accent' : 'border-white/20'}`} />
              全选
            </button>
            <div className="ml-4 flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`rounded p-1.5 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white/[0.12] text-lumina-accent'
                    : 'text-white/40 hover:text-white/75'
                }`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`rounded p-1.5 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white/[0.12] text-lumina-accent'
                    : 'text-white/40 hover:text-white/75'
                }`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Removed "Upload" tab content section as it's now a modal triggered from header */}


      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300 ${
          isUploadModalOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
        onClick={() => setIsUploadModalOpen(false)}
      >
        <div
          className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-lumina-surface-elevated shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
            <h3 className="text-base font-medium text-lumina-text">文件上传</h3>
            <button
              onClick={() => setIsUploadModalOpen(false)}
              className="rounded-full p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <UploadWorkspace
              onUploadCompleted={() => {
                void refresh();
              }}
              initialFiles={pendingUploadFiles}
              onInitialFilesConsumed={() => setPendingUploadFiles([])}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Only show batch actions if items are selected */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-lumina-text shadow-[0_14px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <span className="mr-2 text-lumina-text-secondary">已选 {selectedIds.size}</span>
            <button
              type="button"
              className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
              onClick={handleClearSelection}
            >
              取消选择
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
              onClick={handleBatchFavorite}
            >
              批量收藏
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
              onClick={handleBatchTag}
            >
              批量标签
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-md border border-white/[0.14] bg-white/[0.03] px-3 py-1.5 transition-colors duration-200 hover:bg-white/[0.09]"
              onClick={handleBatchDownload}
            >
              批量下载
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-red-300 transition-colors duration-200 hover:bg-red-500/20"
              onClick={() => {
                void handleBatchDelete();
              }}
            >
              批量删除
            </button>
          </div>
        )}

        {isLoading ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/[0.06] border-t-[#c9a962]/60" />
              </div>
              <p className="text-xs font-light tracking-wide text-lumina-text-secondary">加载相册中...</p>
            </div>
          ) : viewMode === 'list' ? (
            <PhotoList
              photos={photos}
              favoriteIds={favoriteIds}
              onToggleFavorite={handleToggleFavorite}
              selectionMode={isBatchMode}
              selectedIds={selectedIds}
              onToggleSelect={handleBatchSelectToggle}
            />
          ) : (
            <PhotoGrid
              photos={photos}
              favoriteIds={favoriteIds}
              onToggleFavorite={handleToggleFavorite}
              selectionMode={isBatchMode}
              selectedIds={selectedIds}
              onToggleSelect={handleBatchSelectToggle}
              interactionMode="selectionOnly"
              compact
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default ManagePage;
