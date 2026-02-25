import { MutableRefObject, useCallback, useMemo, useState } from "react";
import { UploadQueueItem } from "@/types/photo";
import { submitUploadItem } from "@/features/upload/lib/processUploadItem";
import { uploadService } from "@/services/uploadService";
import { mergeAndValidateMetadata } from "@/lib/tauri/image";

const SUBMIT_WORKERS = 3;

interface ParsedPaths {
  originalPath: string;
  thumbPath: string;
  thumbVariantPaths?: Partial<Record<"400" | "800" | "1600", string>>;
}

interface UseSubmitSchedulerParams {
  queue: UploadQueueItem[];
  updateItemById: (id: string, updates: Partial<UploadQueueItem>) => void;
  parsedPathsRef: MutableRefObject<Map<string, ParsedPaths>>;
  onUploadCompleted?: (successCount: number) => void;
}

interface UseSubmitSchedulerResult {
  isSubmitting: boolean;
  canSubmit: boolean;
  submitWorkers: number;
  handleSubmitAll: () => Promise<void>;
}

export const useSubmitScheduler = ({
  queue,
  updateItemById,
  parsedPathsRef,
  onUploadCompleted,
}: UseSubmitSchedulerParams): UseSubmitSchedulerResult => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const doSubmitItem = useCallback(
    async (
      item: UploadQueueItem,
    ): Promise<
      | { ok: true; queueId: string; metadata: UploadQueueItem["metadata"] }
      | { ok: false }
    > => {
      const parsedPaths = parsedPathsRef.current.get(item.id);
      if (!item.metadata || !parsedPaths) {
        updateItemById(item.id, {
          status: "upload_failed",
          uploadError: "Missing parsed result (paths not found)",
        });
        return { ok: false };
      }

      // 使用 Rust 进行元数据合并和验证
      let finalMetadata: UploadQueueItem["metadata"];
      try {
        const mergeResult = await mergeAndValidateMetadata({
          metadata: item.metadata,
          edit_draft: {
            description: item.editDraft?.description,
            original_filename: item.editDraft?.original_filename,
            category: item.editDraft?.category,
          },
        });

        finalMetadata = mergeResult.metadata;

        // 如果有验证警告，记录到控制台
        if (mergeResult.validation_warnings.length > 0) {
          console.warn(
            `[Metadata Validation] Image ${item.id}:`,
            mergeResult.validation_warnings
          );
        }
      } catch (error) {
        updateItemById(item.id, {
          status: "upload_failed",
          uploadError: error instanceof Error ? error.message : "Metadata validation failed",
          error: error instanceof Error ? error.message : "Metadata validation failed",
        });
        return { ok: false };
      }

      updateItemById(item.id, {
        metadata: finalMetadata,
        status: "uploading",
        progress: 0,
        uploadError: undefined,
        error: undefined,
      });

      try {
        const result = await submitUploadItem({
          imageId: finalMetadata.image_id,
          originalPath: parsedPaths.originalPath,
          originalMime: finalMetadata.files.original.mime,
          thumbPath: parsedPaths.thumbPath,
          metadata: finalMetadata,
          thumbVariantPaths: parsedPaths.thumbVariantPaths,
          deferFinalize: true,
          onProgress: (progress) => updateItemById(item.id, { progress }),
        });

        updateItemById(item.id, {
          progress: 95,
          result,
        });
        return {
          ok: true,
          queueId: item.id,
          metadata: finalMetadata,
        };
      } catch (error) {
        updateItemById(item.id, {
          status: "upload_failed",
          uploadError: error instanceof Error ? error.message : "Upload failed",
          error: error instanceof Error ? error.message : "Upload failed",
        });
        return { ok: false };
      }
    },
    [parsedPathsRef, updateItemById],
  );

  const handleSubmitAll = useCallback(async (): Promise<void> => {
    const candidates = queue.filter(
      (item) =>
        item.status === "parsed" ||
        item.status === "ready_to_upload" ||
        item.status === "upload_failed",
    );

    if (candidates.length === 0) {
      return;
    }

    setIsSubmitting(true);
    let nextIndex = 0;
    const finalizeCandidates: Array<{
      queueId: string;
      metadata: UploadQueueItem["metadata"];
    }> = [];

    const workerTotal = Math.min(SUBMIT_WORKERS, candidates.length);
    const workers = Array.from({ length: workerTotal }, async () => {
      while (nextIndex < candidates.length) {
        const current = candidates[nextIndex];
        nextIndex += 1;
        if (!current) {
          return;
        }
        const submitResult = await doSubmitItem(current);
        if (submitResult.ok) {
          finalizeCandidates.push({
            queueId: submitResult.queueId,
            metadata: submitResult.metadata,
          });
        }
      }
    });

    await Promise.all(workers);

    let successCount = 0;
    if (finalizeCandidates.length > 0) {
      try {
        const metadatas = finalizeCandidates.flatMap((entry) =>
          entry.metadata ? [entry.metadata] : [],
        );
        const finalizeResult =
          await uploadService.finalizeImageBatch(metadatas);
        const failedIds = new Set(
          finalizeResult.failed_items?.map((item: any) => item.image_id) || [],
        );

        finalizeCandidates.forEach(({ queueId, metadata }) => {
          if (!metadata) {
            return;
          }
          if (failedIds.has(metadata.image_id)) {
            const failure = finalizeResult.failed_items?.find(
              (item: any) => item.image_id === metadata.image_id,
            );
            updateItemById(queueId, {
              status: "upload_failed",
              uploadError: failure?.reason || "Finalize failed",
              error: failure?.reason || "Finalize failed",
            });
            return;
          }
          successCount += 1;
          updateItemById(queueId, {
            status: "upload_completed",
            progress: 100,
            error: undefined,
            uploadError: undefined,
          });
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Batch submit failed";
        finalizeCandidates.forEach(({ queueId }) => {
          updateItemById(queueId, {
            status: "upload_failed",
            uploadError: message,
            error: message,
          });
        });
      }
    }

    setIsSubmitting(false);

    if (successCount > 0) {
      setTimeout(() => {
        onUploadCompleted?.(successCount);
      }, 500);
    }
  }, [doSubmitItem, onUploadCompleted, queue]);

  const canSubmit = useMemo(() => {
    const isParseDone =
      queue.length > 0 &&
      queue.every(
        (item) => item.status !== "queued_parse" && item.status !== "parsing",
      );
    const parsedCount = queue.filter(
      (item) => item.status === "parsed" || item.status === "ready_to_upload",
    ).length;

    return isParseDone && parsedCount > 0 && !isSubmitting;
  }, [isSubmitting, queue]);

  return {
    isSubmitting,
    canSubmit,
    submitWorkers: SUBMIT_WORKERS,
    handleSubmitAll,
  };
};
