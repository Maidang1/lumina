import { useEffect, useRef } from 'react';
import { UnlistenFn } from '@tauri-apps/api/event';
import {
  setupUploadEventListeners,
  removeAllUploadEventListeners,
  type UploadEventListeners,
} from '@/lib/tauri/events';

/**
 * Hook: 监听上传事件
 * 自动处理监听器的设置和清理
 *
 * 使用 useRef 存储回调，避免每次渲染重新注册监听器。
 * 监听器只在组件挂载时注册一次，卸载时清理。
 */
export function useUploadEventListeners(
  listeners: UploadEventListeners
): void {
  const unlistenersRef = useRef<UnlistenFn[]>([]);
  const listenersRef = useRef<UploadEventListeners>(listeners);

  // 每次渲染时更新回调引用（不触发副作用重新运行）
  listenersRef.current = listeners;

  useEffect(() => {
    let mounted = true;

    // 用 stable 包装函数，内部始终调用最新的回调
    const stableListeners: UploadEventListeners = {
      onUploadStarted: (payload) => listenersRef.current.onUploadStarted?.(payload),
      onUploadProgress: (payload) => listenersRef.current.onUploadProgress?.(payload),
      onUploadCompleted: (payload) => listenersRef.current.onUploadCompleted?.(payload),
      onBatchUploadStarted: (payload) => listenersRef.current.onBatchUploadStarted?.(payload),
      onBatchUploadStats: (payload) => listenersRef.current.onBatchUploadStats?.(payload),
      onBatchUploadCompleted: (payload) => listenersRef.current.onBatchUploadCompleted?.(payload),
    };

    // 异步设置监听器（只在挂载时注册一次）
    setupUploadEventListeners(stableListeners)
      .then((unlisteners) => {
        if (mounted) {
          unlistenersRef.current = unlisteners;
        } else {
          // 如果组件已卸载，立即清理
          removeAllUploadEventListeners(unlisteners);
        }
      })
      .catch((error) => {
        console.error('Failed to setup upload event listeners:', error);
      });

    return () => {
      mounted = false;
      // 清理所有监听器
      removeAllUploadEventListeners(unlistenersRef.current);
      unlistenersRef.current = [];
    };
  }, []); // 空依赖：只注册一次，通过 ref 获取最新回调
}
