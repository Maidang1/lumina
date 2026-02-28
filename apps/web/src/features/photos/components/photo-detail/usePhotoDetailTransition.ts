import { useCallback, useEffect, useRef, useState } from "react";
import { Photo, PhotoOpenTransition } from "@/features/photos/types";

const CLOSE_FALLBACK_DELAY_MS = 280;

interface UsePhotoDetailTransitionParams {
  photo: Photo;
  openingTransition: PhotoOpenTransition | null;
  onClose: () => void;
  stopVideo: () => void;
}

interface UsePhotoDetailTransitionResult {
  transitionState: "idle" | "opening" | "closing";
  isClosing: boolean;
  controlsDelay: number;
  infoPanelDelay: number;
  handleRequestClose: () => void;
}

export const usePhotoDetailTransition = ({
  photo,
  openingTransition,
  onClose,
  stopVideo,
}: UsePhotoDetailTransitionParams): UsePhotoDetailTransitionResult => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [transitionState, setTransitionState] = useState<
    "idle" | "opening" | "closing"
  >("opening");
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };
    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMotionChange);
    return () => mediaQuery.removeEventListener("change", handleMotionChange);
  }, []);

  useEffect(() => {
    setTransitionState("opening");
    const timeout = window.setTimeout(() => {
      setTransitionState("idle");
    }, prefersReducedMotion ? 0 : 220);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [photo.id, openingTransition, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleRequestClose = useCallback(() => {
    if (transitionState === "closing") return;

    stopVideo();
    if (prefersReducedMotion) {
      onClose();
      return;
    }

    setTransitionState("closing");
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, CLOSE_FALLBACK_DELAY_MS);
  }, [onClose, prefersReducedMotion, stopVideo, transitionState]);

  return {
    transitionState,
    isClosing: transitionState === "closing",
    controlsDelay: prefersReducedMotion ? 0 : 0.05,
    infoPanelDelay: prefersReducedMotion ? 0 : 0.08,
    handleRequestClose,
  };
};
