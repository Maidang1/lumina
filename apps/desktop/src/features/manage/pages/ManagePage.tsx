import React from "react";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoList from "@/components/PhotoList";
import { useBatchPhotoActions } from "@/hooks/useBatchPhotoActions";
import { usePhotosCollection } from "@/hooks/usePhotosCollection";
import ManageBatchActions from "@/features/manage/components/ManageBatchActions";
import ManageHeader from "@/features/manage/components/ManageHeader";
import ManageToolbar from "@/features/manage/components/ManageToolbar";
import { useManageActions } from "@/features/manage/hooks/useManageActions";

const ManagePage: React.FC = () => {
  const { photos, isLoading, removePhotoById } = usePhotosCollection();
  const {
    viewMode,
    setViewMode,
    photoTags,
    setPhotoTags,
    isDeleteTokenConfigured,
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
    handleToggleBatchMode,
    handleSelectAllVisible,
    handleClearSelection,
  } = useBatchPhotoActions({
    photos,
    isDeleteTokenConfigured,
    setPhotoTags,
    onDeletePhoto: handleDeletePhoto,
    onDeleteTokenMissing: markDeleteTokenMissing,
    initialBatchMode: false,
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="p-8 max-w-6xl mx-auto">
      <ManageHeader />

      <main className="space-y-6">
        <ManageToolbar
          viewMode={viewMode}
          isBatchMode={isBatchMode}
          selectedCount={selectedIds.size}
          onSelectAllVisible={handleSelectAllVisible}
          onChangeViewMode={setViewMode}
          onToggleBatchMode={handleToggleBatchMode}
        />

        <div className="flex flex-col gap-6">
          <ManageBatchActions
            selectedCount={selectedIds.size}
            batchResult={batchResult}
            onClearBatchResult={clearBatchResult}
            onClearSelection={handleClearSelection}
            onBatchTag={(tag) => handleBatchTag(tag)}
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
                加载照片库...
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
    </div>
  );
};

export default ManagePage;
