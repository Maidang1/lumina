import { useCallback, useEffect, useRef } from "react";

type LivePhotoControlMode = "hover" | "long-press";

interface UseLivePhotoControlsOptions {
  mode: LivePhotoControlMode;
  enabled: boolean;
  isPlaying: boolean;
  isVideoReady: boolean;
  onPlay: () => void;
  onStop: () => void;
  delayMs?: number;
  disableHover?: boolean;
}

function isMobileDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}

export function useLivePhotoControls({
  mode,
  enabled,
  isPlaying,
  isVideoReady,
  onPlay,
  onStop,
  delayMs = 200,
  disableHover = false,
}: UseLivePhotoControlsOptions): {
  handleStart: () => void;
  handleEnd: () => void;
} {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(() => {
    const isMobile = isMobileDevice();
    if (mode === "hover" && (isMobile || disableHover)) {
      return;
    }
    if (!enabled || !isVideoReady || isPlaying) {
      return;
    }
    clearTimer();
    timerRef.current = setTimeout(() => {
      onPlay();
    }, delayMs);
  }, [clearTimer, delayMs, disableHover, enabled, isPlaying, isVideoReady, mode, onPlay]);

  const handleEnd = useCallback(() => {
    const isMobile = isMobileDevice();
    if (mode === "hover" && (isMobile || disableHover)) {
      return;
    }
    clearTimer();
    if (isPlaying) {
      onStop();
    }
  }, [clearTimer, disableHover, isPlaying, mode, onStop]);

  useEffect(() => clearTimer, [clearTimer]);

  return { handleStart, handleEnd };
}
