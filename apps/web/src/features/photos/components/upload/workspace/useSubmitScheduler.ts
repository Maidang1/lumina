import { MutableRefObject, useCallback, useMemo, useState } from "react";
import { UploadQueueItem } from "@/features/photos/types";
import { submitUploadItem } from "@/features/photos/components/upload/processUploadItem";
import { uploadService } from "@/features/photos/services/uploadService";

const SUBMIT_WORKERS = 3;

interface UseSubmitSchedulerParams {
  queue: UploadQueueItem[];
  updateItemById: (id: string, updates: Partial<UploadQueueItem>) => void;
  thumbBlobRef: MutableRefObject<Map<string, Blob>>;
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
  thumbBlobRef,
  onUploadCompleted,
}: UseSubmitSchedulerParams): UseSubmitSchedulerResult => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const doSubmitItem = useCallback(
    async (
      item: UploadQueueItem
    ): Promise<{ ok: true; queueId: string; metadata: UploadQueueItem["metadata"] } | { ok: false }> => {
      const thumbBlob = thumbBlobRef.current.get(item.id);
      if (!item.metadata || !thumbBlob) {
        updateItemById(item.id, {
          status: "upload_failed",
          uploadError: "Missing parsed result",
        });
        return { ok: false };
      }

      const draft = item.editDraft;
      const description = draft?.description?.trim();
      const filenameDraft = draft?.original_filename?.trim();
      const categoryDraft = draft?.category?.trim();

      const finalMetadata = {
        ...item.metadata,
        ...(description !== undefined ? { description } : { description: "" }),
        ...(filenameDraft ? { original_filename: filenameDraft } : {}),
        ...(categoryDraft !== undefined ? { category: categoryDraft } : { category: "" }),
      };

      updateItemById(item.id, {
        metadata: finalMetadata,
        status: "uploading",
        progress: 0,
        uploadError: undefined,
        error: undefined,
      });

      try {
        const result = await submitUploadItem({
          item,
          metadata: finalMetadata,
          thumbBlob,
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
    [thumbBlobRef, updateItemById]
  );

  const handleSubmitAll = useCallback(async (): Promise<void> => {
    const candidates = queue.filter(
      (item) => item.status === "parsed" || item.status === "ready_to_upload" || item.status === "upload_failed"
    );

    if (candidates.length === 0) {
      return;
    }

    setIsSubmitting(true);
    let nextIndex = 0;
    const finalizeCandidates: Array<{ queueId: string; metadata: UploadQueueItem["metadata"] }> = [];

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
          entry.metadata ? [entry.metadata] : []
        );
        const finalizeResult = await uploadService.finalizeImageBatch(metadatas);
        const failedIds = new Set(finalizeResult.failed_items?.map((item) => item.image_id) || []);

        finalizeCandidates.forEach(({ queueId, metadata }) => {
          if (!metadata) {
            return;
          }
          if (failedIds.has(metadata.image_id)) {
            const failure = finalizeResult.failed_items?.find((item) => item.image_id === metadata.image_id);
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
        const message = error instanceof Error ? error.message : "Batch submit failed";
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
      queue.length > 0 && queue.every((item) => item.status !== "queued_parse" && item.status !== "parsing");
    const parsedCount = queue.filter(
      (item) => item.status === "parsed" || item.status === "ready_to_upload"
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
