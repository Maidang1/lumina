import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { uploadService } from "@/services/uploadService";
import UploadDropzone from "@/features/upload/components/UploadDropzone";
import UploadQueuePanel from "@/features/upload/components/UploadQueuePanel";
import UploadConfirmHeader from "@/features/upload/components/UploadConfirmHeader";
import { useUploadQueueStore } from "@/features/upload/hooks/useUploadQueueStore";
import { useParseScheduler } from "@/features/upload/hooks/useParseScheduler";
import { useSubmitScheduler } from "@/features/upload/hooks/useSubmitScheduler";
import { selectFiles } from "@/lib/tauri/dialog";
import { getFileInfo } from "@/lib/tauri/fs";

interface UploadWorkspaceProps {
  onUploadCompleted?: (successCount: number) => void;
}

const UploadWorkspace: React.FC<UploadWorkspaceProps> = ({
  onUploadCompleted,
}) => {
  const [isTokenConfigured, setIsTokenConfigured] = useState(false);

  useEffect(() => {
    uploadService.hasUploadToken().then(setIsTokenConfigured);
  }, []);

  const {
    queue,
    normalizedOriginalRef,
    thumbBlobRef,
    thumbVariantBlobRef,
    enqueuePathFiles,
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
    normalizedOriginalRef,
    thumbBlobRef,
    thumbVariantBlobRef,
  });

  const { isSubmitting, canSubmit, submitWorkers, handleSubmitAll } =
    useSubmitScheduler({
    queue,
    updateItemById,
    normalizedOriginalRef,
    thumbBlobRef,
    thumbVariantBlobRef,
      onUploadCompleted,
    });

  const handleSelectFilesFromDialog = useCallback(async () => {
    if (!isTokenConfigured) {
      return;
    }

    const selections = await selectFiles();
    if (!selections || selections.length === 0) {
      return;
    }

    const enriched = await Promise.all(
      selections.map(async (selection) => {
        const info = await getFileInfo(selection.path);
        return {
          path: selection.path,
          name: selection.name,
          size: Number(info.size || 0),
          modified: Number(info.modified || Math.floor(Date.now() / 1000)),
        };
      }),
    );

    enqueuePathFiles(enriched);
  }, [enqueuePathFiles, isTokenConfigured]);

  const handleSubmit = useCallback(() => {
    if (!isTokenConfigured) {
      return;
    }
    void handleSubmitAll();
  }, [handleSubmitAll, isTokenConfigured]);

  if (!isTokenConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800 max-w-md">
          <h3 className="text-xl font-semibold mb-2">未配置上传 Token</h3>
          <p className="text-zinc-400 mb-4">
            请先在设置页面配置 Upload Token 后再使用上传功能
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                    await uploadService.updateImageMetadata(
                      item.result.image_id,
                      { category },
                    );
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
                    await uploadService.updateImageMetadata(
                      item.result.image_id,
                      { description },
                    );
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
          isTokenConfigured={isTokenConfigured}
          onSelectFilesFromDialog={() => {
            void handleSelectFilesFromDialog();
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
