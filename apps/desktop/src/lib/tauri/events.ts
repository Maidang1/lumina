import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type {
  UploadStartedPayload,
  UploadProgressPayload,
  UploadCompletedPayload,
  BatchUploadStartedPayload,
  BatchUploadStatsPayload,
  BatchUploadCompletedPayload,
} from './image';

export interface UploadEventListeners {
  onUploadStarted?: (payload: UploadStartedPayload) => void;
  onUploadProgress?: (payload: UploadProgressPayload) => void;
  onUploadCompleted?: (payload: UploadCompletedPayload) => void;
  onBatchUploadStarted?: (payload: BatchUploadStartedPayload) => void;
  onBatchUploadStats?: (payload: BatchUploadStatsPayload) => void;
  onBatchUploadCompleted?: (payload: BatchUploadCompletedPayload) => void;
}

/**
 * 监听所有上传相关事件
 * 返回一个函数，调用它可以移除所有监听器
 */
export async function setupUploadEventListeners(
  listeners: UploadEventListeners
): Promise<UnlistenFn[]> {
  const unlisteners: UnlistenFn[] = [];

  try {
    if (listeners.onUploadStarted) {
      const unlisten = await listen<UploadStartedPayload>(
        'upload_started',
        (event) => listeners.onUploadStarted?.(event.payload)
      );
      unlisteners.push(unlisten);
    }

    if (listeners.onUploadProgress) {
      const unlisten = await listen<UploadProgressPayload>(
        'upload_progress',
        (event) => listeners.onUploadProgress?.(event.payload)
      );
      unlisteners.push(unlisten);
    }

    if (listeners.onUploadCompleted) {
      const unlisten = await listen<UploadCompletedPayload>(
        'upload_completed',
        (event) => listeners.onUploadCompleted?.(event.payload)
      );
      unlisteners.push(unlisten);
    }

    if (listeners.onBatchUploadStarted) {
      const unlisten = await listen<BatchUploadStartedPayload>(
        'batch_upload_started',
        (event) => listeners.onBatchUploadStarted?.(event.payload)
      );
      unlisteners.push(unlisten);
    }

    if (listeners.onBatchUploadStats) {
      const unlisten = await listen<BatchUploadStatsPayload>(
        'batch_upload_stats',
        (event) => listeners.onBatchUploadStats?.(event.payload)
      );
      unlisteners.push(unlisten);
    }

    if (listeners.onBatchUploadCompleted) {
      const unlisten = await listen<BatchUploadCompletedPayload>(
        'batch_upload_completed',
        (event) => listeners.onBatchUploadCompleted?.(event.payload)
      );
      unlisteners.push(unlisten);
    }
  } catch (error) {
    console.error('Failed to setup upload event listeners:', error);
    // 清理已成功设置的监听器
    unlisteners.forEach((unlisten) => unlisten());
    throw error;
  }

  return unlisteners;
}

/**
 * 移除所有上传事件监听器
 */
export function removeAllUploadEventListeners(unlisteners: UnlistenFn[]): void {
  unlisteners.forEach((unlisten) => {
    try {
      unlisten();
    } catch (error) {
      console.error('Error removing event listener:', error);
    }
  });
}
