import React, { useCallback, useEffect, useState } from "react";
import { uploadService } from "@/services/uploadService";
import UploadDropzone from "@/features/upload/components/UploadDropzone";
import UploadQueuePanel from "@/features/upload/components/UploadQueuePanel";
import UploadConfirmHeader from "@/features/upload/components/UploadConfirmHeader";
import { useUploadQueueStore } from "@/features/upload/hooks/useUploadQueueStore";
import { useParseScheduler } from "@/features/upload/hooks/useParseScheduler";
import { useSubmitScheduler } from "@/features/upload/hooks/useSubmitScheduler";
import { useEventDrivenSubmitScheduler } from "@/features/upload/hooks/useEventDrivenSubmitScheduler";
import { selectDirectory, selectFiles } from "@/lib/tauri/dialog";
import { getFileInfo } from "@/lib/tauri/fs";
import { tauriStorage } from "@/lib/tauri/storage";
import { DEFAULT_UPLOAD_CONFIG, UploadParseProfile } from "@/types/photo";

// 功能标志：启用事件驱动上传（性能优化）
const USE_EVENT_DRIVEN_UPLOAD = true;

interface UploadWorkspaceProps {
  onUploadCompleted?: (successCount: number) => void;
}

const UploadWorkspace: React.FC<UploadWorkspaceProps> = ({
  onUploadCompleted,
}) => {
  const [isRepoConfigured, setIsRepoConfigured] = useState(false);
  const [repoHint, setRepoHint] = useState("");
  const [parseProfile, setParseProfile] = useState<UploadParseProfile>(
    DEFAULT_UPLOAD_CONFIG.parseProfile,
  );

  useEffect(() => {
    const refreshRepoState = async (): Promise<void> => {
      const configured = await uploadService.hasRepoPath();
      setIsRepoConfigured(configured);
      if (configured) {
        try {
          const status = await uploadService.getRepoStatus();
          setRepoHint(`${status.owner}/${status.repo}@${status.branch}`);
        } catch {
          setRepoHint("");
        }
      } else {
        setRepoHint("");
      }
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

  // 使用事件驱动的提交调度器（性能优化）
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
    if (!isRepoConfigured) {
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
  }, [enqueuePathFiles, isRepoConfigured]);

  const handleSubmit = useCallback(() => {
    if (!isRepoConfigured) {
      return;
    }
    void handleSubmitAll();
  }, [handleSubmitAll, isRepoConfigured]);

  if (!isRepoConfigured) {
    const handleChooseRepo = async (): Promise<void> => {
      const selected = await selectDirectory();
      if (!selected) {
        return;
      }
      await tauriStorage.setItem("lumina.git_repo_path", selected);
      const ready = await uploadService.hasRepoPath();
      setIsRepoConfigured(ready);
      if (ready) {
        try {
          const status = await uploadService.getRepoStatus();
          setRepoHint(`${status.owner}/${status.repo}@${status.branch}`);
        } catch {
          setRepoHint("");
        }
      }
    };

    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800 max-w-md">
          <h3 className="text-xl font-semibold mb-2">未配置仓库</h3>
          <p className="text-zinc-400 mb-4">
            先选择一个本地 Git 仓库。上传操作会把文件写入该仓库的 `objects/` 目录。
          </p>
          <button
            type="button"
            onClick={() => void handleChooseRepo()}
            className="px-4 py-2 rounded-md bg-sky-600 text-white text-sm hover:bg-sky-500 transition-colors"
          >
            立即选择仓库
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {repoHint && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          当前仓库: <span className="font-medium">{repoHint}</span>。上传后请点击左侧 `Commit & Push` 完成同步。
        </div>
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
          isRepoConfigured={isRepoConfigured}
          onSelectFilesFromDialog={() => {
            void handleSelectFilesFromDialog();
          }}
        />
      )}

      {queue.length === 0 && isRepoConfigured && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
          建议流程: 1) 选择照片并写入仓库 2) 在管理页确认结果 3) 点击左侧 `Commit & Push` 推送远端。
        </div>
      )}
    </div>
  );
};

export default UploadWorkspace;
