import React from "react";
import PhotoGrid from "@/features/photos/components/PhotoGrid";
import PhotoList from "@/features/photos/components/PhotoList";
import { useBatchPhotoActions } from "@/features/photos/components/hooks/useBatchPhotoActions";
import { usePhotosCollection } from "@/features/photos/hooks/usePhotosCollection";
import ManageBatchActions from "@/features/photos/pages/manage/ManageBatchActions";
import ManageHeader from "@/features/photos/pages/manage/ManageHeader";
import ManageToolbar from "@/features/photos/pages/manage/ManageToolbar";
import ManageUploadDialog from "@/features/photos/pages/manage/ManageUploadDialog";
import { useManageActions } from "@/features/photos/pages/manage/useManageActions";

const ManagePage: React.FC = () => {
  const { photos, isLoading, refresh, removePhotoById } = usePhotosCollection();
  const {
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
    handleOpenUpload,
    handleUploadFileSelected,
    handleToggleFavorite,
    handleDeletePhoto,
    markDeleteTokenMissing,
  } = useManageActions({ removePhotoById });

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
    onDeleteTokenMissing: markDeleteTokenMissing,
    initialBatchMode: true,
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <ManageHeader
        uploadFileInputRef={uploadFileInputRef}
        onUploadFileSelected={handleUploadFileSelected}
        onOpenUpload={handleOpenUpload}
      />

      <main className="mx-auto w-full max-w-[1720px] space-y-6 px-5 sm:px-8">
        <ManageToolbar
          viewMode={viewMode}
          selectedCount={selectedIds.size}
          onSelectAllVisible={handleSelectAllVisible}
          onChangeViewMode={setViewMode}
        />

        <ManageUploadDialog
          isOpen={isUploadModalOpen}
          initialFiles={pendingUploadFiles}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadCompleted={() => {
            void refresh();
            setIsUploadModalOpen(false);
          }}
          onInitialFilesConsumed={() => setPendingUploadFiles([])}
        />

        <div className="flex flex-col gap-6">
          <ManageBatchActions
            selectedCount={selectedIds.size}
            onClearSelection={handleClearSelection}
            onBatchFavorite={handleBatchFavorite}
            onBatchTag={handleBatchTag}
            onBatchDownload={handleBatchDownload}
            onBatchDelete={() => {
              void handleBatchDelete();
            }}
          />

          {isLoading ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/[0.06] border-t-[#c9a962]/60" />
              </div>
              <p className="text-xs font-light tracking-wide text-lumina-text-secondary">Loading gallery...</p>
            </div>
          ) : viewMode === "list" ? (
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
