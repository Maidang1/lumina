import { MutableRefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Photo } from "@/features/photos/types";

export type PhotoDetailLoadState = "idle" | "loading" | "loaded" | "error";

interface UsePhotoDetailMediaResult {
  loadState: PhotoDetailLoadState;
  isOriginalLoaded: boolean;
  loadProgress: number;
  thumbnailImageRef: MutableRefObject<HTMLImageElement | null>;
  imageContainerRef: MutableRefObject<HTMLDivElement | null>;
  handleOriginalLoaded: () => void;
  handleOriginalError: () => void;
}

export const usePhotoDetailMedia = (photo: Photo): UsePhotoDetailMediaResult => {
  const [loadState, setLoadState] = useState<PhotoDetailLoadState>("idle");
  const [isOriginalLoaded, setIsOriginalLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const thumbnailImageRef = useRef<HTMLImageElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    clearProgressTimer();
    clearRevealTimer();
    setLoadState("loading");
    setIsOriginalLoaded(false);
    setLoadProgress(18);
    progressTimerRef.current = window.setInterval(() => {
      setLoadProgress((current) => {
        if (current >= 80) {
          return current;
        }
        return Math.min(current + 7, 80);
      });
    }, 140);
    return () => {
      clearProgressTimer();
      clearRevealTimer();
    };
  }, [clearProgressTimer, clearRevealTimer, photo.id]);

  const handleOriginalLoaded = useCallback(() => {
    clearProgressTimer();
    setLoadState("loaded");
    setLoadProgress(100);
    revealTimerRef.current = window.setTimeout(() => {
      setIsOriginalLoaded(true);
      revealTimerRef.current = null;
    }, 50);
  }, [clearProgressTimer]);

  const handleOriginalError = useCallback(() => {
    clearProgressTimer();
    clearRevealTimer();
    setIsOriginalLoaded(false);
    setLoadState("error");
  }, [clearProgressTimer, clearRevealTimer]);

  useEffect(() => {
    return () => {
      clearProgressTimer();
      clearRevealTimer();
    };
  }, [clearProgressTimer, clearRevealTimer]);

  return {
    loadState,
    isOriginalLoaded,
    loadProgress,
    thumbnailImageRef,
    imageContainerRef,
    handleOriginalLoaded,
    handleOriginalError,
  };
};
