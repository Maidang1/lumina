import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { CloneProgress } from '@/lib/tauri/clone';

interface UseCloneProgressResult {
  progress: CloneProgress | null;
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  reset: () => void;
}

export function useCloneProgress(): UseCloneProgressResult {
  const [progress, setProgress] = useState<CloneProgress | null>(null);
  const [isListening, setIsListening] = useState(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const stopListening = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    stopListening();
    setProgress(null);

    try {
      const unlisten = await listen<CloneProgress>('clone-progress', (event) => {
        setProgress(event.payload);
      });
      unlistenRef.current = unlisten;
      setIsListening(true);
    } catch (error) {
      console.error('Failed to setup clone progress listener:', error);
      throw error;
    }
  }, [stopListening]);

  const reset = useCallback(() => {
    stopListening();
    setProgress(null);
  }, [stopListening]);

  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  return {
    progress,
    isListening,
    startListening,
    stopListening,
    reset,
  };
}
