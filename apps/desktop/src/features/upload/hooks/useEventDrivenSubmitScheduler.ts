import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { UploadQueueItem, ImageMetadata } from "@/types/photo";
import { uploadService } from "@/services/uploadService";
import { mergeAndValidateMetadata, startBatchUploadWithEvents, type PreparedUploadItem } from "@/lib/tauri/image";
import { useUploadEventListeners } from "@/hooks/useUploadEventListeners";
import type { MutableRefObject } from "react";

interface ParsedPaths {
  originalPath: string;
  thumbPath: string;
  thumbVariantPaths?: Partial<Record<"400" | "800" | "1600", string>>;
}

interface UseEventDrivenSubmitSchedulerParams {
  queue: UploadQueueItem[];
  updateItemById: (id: string, updates: Partial<UploadQueueItem>) => void;
  parsedPathsRef: MutableRefObject<Map<string, ParsedPaths>>;
  onUploadCompleted?: (successCount: number) => void;
}

interface UseEventDrivenSubmitSchedulerResult {
  isSubmitting: boolean;
  canSubmit: boolean;
  submitWorkers: number;
  handleSubmitAll: () => Promise<void>;
}

/** 每个已准备上传项的 finalize 所需信息 */
interface PreparedItemEntry {
  queueId: string;
  metadata: ImageMetadata;
}

/**
 * 事件驱动的上传调度器 Hook
 * 相比 useSubmitScheduler 减少 15-25% 的 IPC 往返
 * 优势：
 * - Rust 后台批量处理，不受 3 worker 限制
 * - 事件驱动，更好的响应性
 * - 减少主线程阻塞
 */
export const useEventDrivenSubmitScheduler = ({
  queue,
  updateItemById,
  parsedPathsRef,
  onUploadCompleted,
}: UseEventDrivenSubmitSchedulerParams): UseEventDrivenSubmitSchedulerResult => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  // 用 ref 保持对最新回调的引用，解决事件回调中的 stale closure 问题
  const updateItemByIdRef = useRef(updateItemById);
  const onUploadCompletedRef = useRef(onUploadCompleted);
  updateItemByIdRef.current = updateItemById;
  onUploadCompletedRef.current = onUploadCompleted;

  // ========== 独立于 React 状态的跟踪数据 ==========
  // metadata.image_id (SHA256) → { queueId, metadata } 的映射
  // 在 prepareUploadItems 时建立，finalize 时使用
  const preparedItemsRef = useRef<Map<string, PreparedItemEntry>>(new Map());

  // 成功上传的 image_id 集合（由 upload_completed 事件填充）
  const successfulIdsRef = useRef<Set<string>>(new Set());

  // 根据 metadata image_id 查找 queue item id
  const resolveQueueId = useCallback((metadataImageId: string): string => {
    return preparedItemsRef.current.get(metadataImageId)?.queueId ?? metadataImageId;
  }, []);

  // 准备上传项
  const prepareUploadItems = useCallback(
    async (): Promise<PreparedUploadItem[] | null> => {
      const candidates = queue.filter(
        (item) =>
          item.status === "parsed" ||
          item.status === "ready_to_upload" ||
          item.status === "upload_failed",
      );

      if (candidates.length === 0) {
        return null;
      }

      const preparedItems: PreparedUploadItem[] = [];
      // 清空旧的跟踪数据
      preparedItemsRef.current.clear();
      successfulIdsRef.current.clear();

      for (const item of candidates) {
        const parsedPaths = parsedPathsRef.current.get(item.id);
        if (!item.metadata || !parsedPaths) {
          updateItemById(item.id, {
            status: "upload_failed",
            uploadError: "Missing parsed result (paths not found)",
          });
          continue;
        }

        // 使用 Rust 进行元数据合并和验证
        try {
          const mergeResult = await mergeAndValidateMetadata({
            metadata: item.metadata,
            edit_draft: {
              description: item.editDraft?.description,
              original_filename: item.editDraft?.original_filename,
              category: item.editDraft?.category,
            },
          });

          const finalMetadata = mergeResult.metadata;

          if (mergeResult.validation_warnings.length > 0) {
            console.warn(
              `[Metadata Validation] Image ${item.id}:`,
              mergeResult.validation_warnings
            );
          }

          // 保存 image_id → { queueId, metadata } 映射，供事件回调和 finalize 使用
          preparedItemsRef.current.set(finalMetadata.image_id, {
            queueId: item.id,
            metadata: finalMetadata,
          });

          // 标记为上传中
          updateItemById(item.id, {
            metadata: finalMetadata,
            status: "uploading",
            progress: 0,
            uploadError: undefined,
            error: undefined,
          });

          preparedItems.push({
            image_id: finalMetadata.image_id,
            original_path: parsedPaths.originalPath,
            original_mime: finalMetadata.files.original.mime,
            thumb_path: parsedPaths.thumbPath,
            thumb_variants: parsedPaths.thumbVariantPaths || {},
            metadata: JSON.stringify(finalMetadata),
          });
        } catch (error) {
          updateItemById(item.id, {
            status: "upload_failed",
            uploadError: error instanceof Error ? error.message : "Metadata validation failed",
            error: error instanceof Error ? error.message : "Metadata validation failed",
          });
        }
      }

      return preparedItems.length > 0 ? preparedItems : null;
    },
    [queue, updateItemById, parsedPathsRef]
  );

  // 设置事件监听（通过 ref 获取最新 state，避免 stale closure）
  useUploadEventListeners({
    onUploadStarted: (payload) => {
      const queueId = resolveQueueId(payload.image_id);
      console.log(`[Upload] Started: ${payload.image_id} (queue: ${queueId})`);
      updateItemByIdRef.current(queueId, {
        progress: 5,
      });
    },

    onUploadProgress: (payload) => {
      const queueId = resolveQueueId(payload.image_id);
      console.log(
        `[Upload] Progress: ${payload.image_id} - ${payload.progress}%`
      );
      updateItemByIdRef.current(queueId, {
        progress: Math.min(payload.progress, 95),
      });
    },

    onUploadCompleted: (payload) => {
      const queueId = resolveQueueId(payload.image_id);
      if (payload.success) {
        console.log(`[Upload] Completed: ${payload.image_id} (queue: ${queueId})`);
        // 记录成功的 image_id（同步写入 ref，不依赖 React 状态更新）
        successfulIdsRef.current.add(payload.image_id);
        updateItemByIdRef.current(queueId, {
          progress: 100,
          status: "upload_completed",
          uploadError: undefined,
          error: undefined,
        });
      } else {
        console.error(
          `[Upload] Failed: ${payload.image_id} - ${payload.message}`
        );
        updateItemByIdRef.current(queueId, {
          status: "upload_failed",
          uploadError: payload.message,
          error: payload.message,
        });
      }
    },

    onBatchUploadStarted: (payload) => {
      console.log(
        `[Batch Upload] Started: batch_id=${payload.batch_id}, items=${payload.total_items}`
      );
    },

    onBatchUploadStats: (payload) => {
      console.log(
        `[Batch Upload] Stats: completed=${payload.completed}, failed=${payload.failed}, progress=${payload.overall_progress}%`
      );
    },

    onBatchUploadCompleted: (payload) => {
      console.log(
        `[Batch Upload] Completed: successful=${payload.successful_items}, failed=${payload.failed_items}, duration=${payload.total_duration_ms}ms`
      );

      // 完成后进行 finalize
      handleBatchFinalizeRef.current();
    },
  });

  const handleBatchFinalize = useCallback(
    async () => {
      const currentUpdateItemById = updateItemByIdRef.current;

      // 从 ref 中收集成功项的 finalize 数据（不依赖 React queue 状态）
      const finalizeCandidates: PreparedItemEntry[] = [];
      for (const imageId of successfulIdsRef.current) {
        const entry = preparedItemsRef.current.get(imageId);
        if (entry) {
          finalizeCandidates.push(entry);
        }
      }

      console.log(
        `[Batch Finalize] Candidates: ${finalizeCandidates.length} (successful: ${successfulIdsRef.current.size})`
      );

      if (finalizeCandidates.length > 0) {
        try {
          const finalizeResult =
            await uploadService.finalizeImageBatch(
              finalizeCandidates.map((entry) => entry.metadata)
            );

          const failedIds = new Set(
            finalizeResult.failed_items?.map(
              (item: any) => item.image_id
            ) || []
          );

          let successCount = 0;
          finalizeCandidates.forEach(({ queueId, metadata }) => {
            if (failedIds.has(metadata.image_id)) {
              const failure = finalizeResult.failed_items?.find(
                (item: any) => item.image_id === metadata.image_id
              );
              currentUpdateItemById(queueId, {
                status: "upload_failed",
                uploadError: failure?.reason || "Finalize failed",
                error: failure?.reason || "Finalize failed",
              });
              return;
            }
            successCount += 1;
            currentUpdateItemById(queueId, {
              status: "upload_completed",
              progress: 100,
              uploadError: undefined,
              error: undefined,
            });
          });

          onUploadCompletedRef.current?.(successCount);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Batch finalize failed";
          finalizeCandidates.forEach(({ queueId }) => {
            currentUpdateItemById(queueId, {
              status: "upload_failed",
              uploadError: message,
              error: message,
            });
          });
        }
      }

      setIsSubmitting(false);
    },
    [] // 无依赖：通过 ref 获取最新状态
  );

  // 用 ref 存储 handleBatchFinalize，供事件回调使用
  const handleBatchFinalizeRef = useRef(handleBatchFinalize);
  handleBatchFinalizeRef.current = handleBatchFinalize;

  const handleSubmitAll = useCallback(async (): Promise<void> => {
    setIsSubmitting(true);

    try {
      const preparedItems = await prepareUploadItems();
      if (!preparedItems || preparedItems.length === 0) {
        setIsSubmitting(false);
        return;
      }

      // 启动后台批量上传
      const batchId = await startBatchUploadWithEvents(preparedItems);
      setCurrentBatchId(batchId);
      console.log(
        `[Event-Driven Upload] Batch started with ID: ${batchId}, items: ${preparedItems.length}`
      );
    } catch (error) {
      console.error("[Event-Driven Upload] Failed to start batch:", error);
      setIsSubmitting(false);
    }
  }, [prepareUploadItems]);

  const canSubmit = useMemo(() => {
    return (
      !isSubmitting &&
      queue.some(
        (item) =>
          item.status === "parsed" ||
          item.status === "ready_to_upload" ||
          item.status === "upload_failed"
      )
    );
  }, [queue, isSubmitting]);

  return {
    isSubmitting,
    canSubmit,
    submitWorkers: 0,  // 事件驱动模式不再使用 workers 限制
    handleSubmitAll,
  };
};
