import React from "react";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoList from "@/components/PhotoList";
import { useBatchPhotoActions } from "@/hooks/useBatchPhotoActions";
import { usePhotosCollection } from "@/hooks/usePhotosCollection";
import ManageBatchActions from "@/features/manage/components/ManageBatchActions";
import ManageHeader from "@/features/manage/components/ManageHeader";
import ManageToolbar from "@/features/manage/components/ManageToolbar";
import ManageUploadDialog from "@/features/manage/components/ManageUploadDialog";
import { useManageActions } from "@/features/manage/hooks/useManageActions";

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
    photoTags,
    setPhotoTags,
    isDeleteTokenConfigured,
    handleOpenUpload,
    handleUploadFileSelected,
    handleDeletePhoto,
    markDeleteTokenMissing,
  } = useManageActions({ removePhotoById });

  const {
    isBatchMode,
    selectedIds,
    batchResult,
    clearBatchResult,
    handleBatchSelectToggle,
    handleBatchDelete,
    handleBatchDownload,
    handleBatchTag,
    handleSelectAllVisible,
    handleClearSelection,
  } = useBatchPhotoActions({
    photos,
    isDeleteTokenConfigured,
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
            batchResult={batchResult}
            onClearBatchResult={clearBatchResult}
            onClearSelection={handleClearSelection}
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
              <p className="text-xs font-light tracking-wide text-lumina-text-secondary">
                Loading gallery...
              </p>
            </div>
          ) : viewMode === "list" ? (
            <PhotoList
              photos={photos}
              selectionMode={isBatchMode}
              selectedIds={selectedIds}
              onToggleSelect={handleBatchSelectToggle}
            />
          ) : (
            <PhotoGrid
              photos={photos}
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
