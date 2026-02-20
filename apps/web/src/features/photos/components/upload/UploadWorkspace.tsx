import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { uploadService } from "@/features/photos/services/uploadService";
import UploadDropzone from "@/features/photos/components/upload/UploadDropzone";
import UploadQueuePanel from "@/features/photos/components/upload/UploadQueuePanel";
import UploadSettingsPopover from "@/features/photos/components/upload/UploadSettingsPopover";
import UploadConfirmHeader from "@/features/photos/components/upload/workspace/UploadConfirmHeader";
import UploadTokenAlert from "@/features/photos/components/upload/workspace/UploadTokenAlert";
import { useUploadTokenState } from "@/features/photos/components/upload/workspace/useUploadTokenState";
import { useUploadQueueStore } from "@/features/photos/components/upload/workspace/useUploadQueueStore";
import { useParseScheduler } from "@/features/photos/components/upload/workspace/useParseScheduler";
import { useSubmitScheduler } from "@/features/photos/components/upload/workspace/useSubmitScheduler";

interface UploadWorkspaceProps {
  onUploadCompleted?: (successCount: number) => void;
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
}

const UploadWorkspace: React.FC<UploadWorkspaceProps> = ({
  onUploadCompleted,
  initialFiles,
  onInitialFilesConsumed,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    uploadToken,
    tokenError,
    isTokenConfigured,
    clearTokenError,
    setTokenError,
    updateUploadToken,
  } = useUploadTokenState();

  const {
    queue,
    thumbBlobRef,
    enqueueStaticFiles,
    updateItemById,
    updateStageById,
    applyDraftField,
    removeItem,
    retryItem,
    stats,
  } = useUploadQueueStore();

  const { parseWorkerCount } = useParseScheduler({
    queue,
    isTokenConfigured,
    updateItemById,
    updateStageById,
    thumbBlobRef,
  });

  const { isSubmitting, canSubmit, submitWorkers, handleSubmitAll } = useSubmitScheduler({
    queue,
    updateItemById,
    thumbBlobRef,
    onUploadCompleted,
  });

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (!uploadService.getUploadToken()) {
        setTokenError("Please configure UPLOAD_TOKEN first.");
        return;
      }
      clearTokenError();
      enqueueStaticFiles(files);
    },
    [clearTokenError, enqueueStaticFiles, setTokenError]
  );

  useEffect(() => {
    if (!initialFiles || initialFiles.length === 0) {
      return;
    }
    handleFiles(initialFiles);
    onInitialFilesConsumed?.();
  }, [handleFiles, initialFiles, onInitialFilesConsumed]);

  const handleSubmit = useCallback(() => {
    if (!uploadService.getUploadToken()) {
      setTokenError("Please configure UPLOAD_TOKEN before uploading.");
      return;
    }
    void handleSubmitAll();
  }, [handleSubmitAll, setTokenError]);

  return (
    <div className="space-y-6">
      <UploadSettingsPopover
        uploadToken={uploadToken}
        tokenError={tokenError}
        isTokenConfigured={isTokenConfigured}
        panelTitle="Settings"
        iconSize={16}
        buttonClassName="hidden"
        onChangeToken={updateUploadToken}
      />

      {!isTokenConfigured && (
        <UploadTokenAlert uploadToken={uploadToken} onChange={updateUploadToken} />
      )}

      {queue.length > 0 ? (
        <div className="space-y-4">
          <UploadConfirmHeader
            queueLength={queue.length}
            totalBytes={stats.totalBytes}
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
          <UploadQueuePanel
            queue={queue}
            totalBytes={stats.totalBytes}
            failedCount={stats.parseFailedCount + stats.uploadFailedCount}
            workerCount={isSubmitting ? submitWorkers : parseWorkerCount}
            activeWorkers={stats.parseActiveCount + stats.uploadActiveCount}
            onRemoveItem={removeItem}
            onRetryItem={retryItem}
            onEditItem={() => {}}
            isEditEnabled={false}
            onUpdateCategory={async (id, category, save) => {
              applyDraftField(id, "category", category);
              if (save) {
                const item = queue.find((i) => i.id === id);
                if (item?.result?.image_id) {
                  try {
                    await uploadService.updateImageMetadata(item.result.image_id, { category });
                  } catch (e) {
                    console.error("Failed to save category", e);
                  }
                }
              }
            }}
            onUpdateDescription={async (id, description, save) => {
              applyDraftField(id, "description", description);
              if (save) {
                const item = queue.find((i) => i.id === id);
                if (item?.result?.image_id) {
                  try {
                    await uploadService.updateImageMetadata(item.result.image_id, { description });
                  } catch (e) {
                    console.error("Failed to save description", e);
                  }
                }
              }
            }}
          />
        </div>
      ) : (
        <UploadDropzone
          isDragging={isDragging}
          uploadMode="static"
          isTokenConfigured={isTokenConfigured}
          fileInputRef={fileInputRef}
          onChangeMode={() => {}}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onFileSelect={(event) => {
            if (event.target.files) {
              handleFiles(event.target.files);
            }
            event.target.value = "";
          }}
        />
      )}

      {queue.length === 0 && isTokenConfigured && (
        <div className="flex h-40 flex-col items-center justify-center text-zinc-500">
          <Loader2 className="mb-2 animate-spin" />
          <p>Waiting for file selection...</p>
        </div>
      )}
    </div>
  );
};

export default UploadWorkspace;
