import React, { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { uploadService } from "@/services/uploadService";
import UploadDropzone from "@/features/upload/components/UploadDropzone";
import UploadQueuePanel from "@/features/upload/components/UploadQueuePanel";
import UploadConfirmHeader from "@/features/upload/components/UploadConfirmHeader";
import { useUploadQueueStore } from "@/features/upload/hooks/useUploadQueueStore";
import { useParseScheduler } from "@/features/upload/hooks/useParseScheduler";
import { useSubmitScheduler } from "@/features/upload/hooks/useSubmitScheduler";
import { useEventDrivenSubmitScheduler } from "@/features/upload/hooks/useEventDrivenSubmitScheduler";
import { selectFiles } from "@/lib/tauri/dialog";
import { getFileInfo } from "@/lib/tauri/fs";
import { tauriStorage } from "@/lib/tauri/storage";
import { DEFAULT_UPLOAD_CONFIG, UploadParseProfile } from "@/types/photo";

const USE_EVENT_DRIVEN_UPLOAD = true;

interface UploadWorkspaceProps {
  onUploadCompleted?: (successCount: number) => void;
  onNavigateToSettings?: () => void;
}

const UploadWorkspace: React.FC<UploadWorkspaceProps> = ({
  onUploadCompleted,
  onNavigateToSettings,
}) => {
  const [isRepoConfigured, setIsRepoConfigured] = useState(false);
  const [parseProfile, setParseProfile] = useState<UploadParseProfile>(
    DEFAULT_UPLOAD_CONFIG.parseProfile,
  );

  useEffect(() => {
    const refreshRepoState = async (): Promise<void> => {
      const configured = await uploadService.hasRepoPath();
      setIsRepoConfigured(configured);
    };
    void refreshRepoState();
  }, []);

  useEffect(() => {
    const loadParseProfile = async (): Promise<void> => {
      const raw = await tauriStorage.getItem("lumina.parse_profile");
      if (raw === "quality" || raw === "turbo") {
        setParseProfile(raw);
      }
    };
    void loadParseProfile();
  }, []);

  const {
    queue,
    parsedPathsRef,
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
    isTokenConfigured: isRepoConfigured,
    parseProfile,
    updateItemById,
    updateStageById,
    parsedPathsRef,
  });

  const schedulerHook = USE_EVENT_DRIVEN_UPLOAD
    ? useEventDrivenSubmitScheduler
    : useSubmitScheduler;

  const { isSubmitting, canSubmit, submitWorkers, handleSubmitAll } =
    schedulerHook({
      queue,
      updateItemById,
      parsedPathsRef,
      onUploadCompleted,
    });

  const handleSelectFilesFromDialog = useCallback(async () => {
    if (!isRepoConfigured) return;

    const selections = await selectFiles();
    if (!selections || selections.length === 0) return;

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
  }, [enqueuePathFiles, isRepoConfigured]);

  const handleSubmit = useCallback(() => {
    if (!isRepoConfigured) return;
    void handleSubmitAll();
  }, [handleSubmitAll, isRepoConfigured]);

  if (!isRepoConfigured) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--lumina-border-subtle)] text-[var(--lumina-muted)]">
            <Link2 size={40} strokeWidth={1.5} />
          </div>

          <h2 className="mb-2 text-lg font-medium text-[var(--lumina-text)]">
            先连接 GitHub 仓库
          </h2>
          <p className="mb-6 text-sm text-[var(--lumina-muted)]">
            请在设置页输入 GitHub 仓库链接，应用会自动克隆到缓存目录并维护同步。
          </p>

          {onNavigateToSettings && (
            <button
              type="button"
              onClick={onNavigateToSettings}
              className="rounded-lg bg-[var(--lumina-text)] px-6 py-2.5 text-sm font-medium text-[var(--lumina-bg)] transition-all hover:opacity-90"
            >
              前往设置连接仓库
            </button>
          )}
        </div>
      </div>
    );
  }

  if (queue.length > 0) {
    return (
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
    );
  }

  return (
    <UploadDropzone
      isRepoConfigured={isRepoConfigured}
      onSelectFilesFromDialog={() => void handleSelectFilesFromDialog()}
    />
  );
};

export default UploadWorkspace;
