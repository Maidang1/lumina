import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpring } from "@react-spring/web";
import { Photo, PhotoOpenTransition } from "@/features/photos/types";
import { ImageRect } from "@/features/photos/components/photo-detail/types";

const OPENING_STATE_MS = 320;
const CLOSE_MAIN_DURATION_MS = 220;
const CLOSE_OVERLAY_DURATION_MS = 180;
const CLOSE_CONTROLS_DURATION_MS = 140;
const CLOSE_INFO_PANEL_DURATION_MS = 160;
const CLOSE_FALLBACK_DELAY_MS = 300;

const matchedOpenSpring = { mass: 0.85, tension: 320, friction: 30 };
const gentleOpenSpring = { mass: 1, tension: 230, friction: 28 };

interface UsePhotoDetailTransitionParams {
  photo: Photo;
  openingTransition: PhotoOpenTransition | null;
  onClose: () => void;
  stopVideo: () => void;
  isOriginalLoaded: boolean;
}

interface UsePhotoDetailTransitionResult {
  transitionState: "idle" | "opening" | "closing";
  overlaySpring: { opacity: import("@react-spring/web").SpringValue<number> };
  imageSpring: { opacity: import("@react-spring/web").SpringValue<number> };
  controlsSpring: {
    opacity: import("@react-spring/web").SpringValue<number>;
    transform: import("@react-spring/web").SpringValue<string>;
  };
  infoPanelSpring: {
    opacity: import("@react-spring/web").SpringValue<number>;
    transform: import("@react-spring/web").SpringValue<string>;
  };
  spring: {
    x: import("@react-spring/web").SpringValue<number>;
    y: import("@react-spring/web").SpringValue<number>;
    width: import("@react-spring/web").SpringValue<number>;
    height: import("@react-spring/web").SpringValue<number>;
    borderRadius: import("@react-spring/web").SpringValue<number>;
  };
  useAnimation: boolean;
  handleRequestClose: () => void;
}

export const usePhotoDetailTransition = ({
  photo,
  openingTransition,
  onClose,
  stopVideo,
  isOriginalLoaded,
}: UsePhotoDetailTransitionParams): UsePhotoDetailTransitionResult => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [transitionState, setTransitionState] = useState<"idle" | "opening" | "closing">("idle");
  const [closingToRect, setClosingToRect] = useState<ImageRect | null>(null);
  const closeCompletedRef = useRef(false);
  const closeFallbackTimerRef = useRef<number | null>(null);
  const transitionStateRef = useRef<"idle" | "opening" | "closing">("idle");

  const finishClose = useCallback(() => {
    if (closeCompletedRef.current) return;
    closeCompletedRef.current = true;

    if (closeFallbackTimerRef.current !== null) {
      window.clearTimeout(closeFallbackTimerRef.current);
      closeFallbackTimerRef.current = null;
    }

    onClose();
  }, [onClose]);

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
    const handleResize = (): void => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const calculateTargetRect = useCallback((): ImageRect => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const isDesktop = vw >= 768;
    const isLargeDesktop = vw >= 1024;
    const infoPanelWidth = isLargeDesktop ? 360 : 320;
    const availableWidth = isDesktop ? vw - infoPanelWidth : vw;
    const availableHeight = isDesktop ? vh : vh * 0.45;

    const imageAspect = photo.width / photo.height;
    const containerAspect = availableWidth / availableHeight;

    let targetWidth: number;
    let targetHeight: number;

    if (imageAspect > containerAspect) {
      targetWidth = availableWidth - 48;
      targetHeight = targetWidth / imageAspect;
    } else {
      targetHeight = availableHeight - 48;
      targetWidth = targetHeight * imageAspect;
    }

    return {
      left: (availableWidth - targetWidth) / 2,
      top: (availableHeight - targetHeight) / 2,
      width: targetWidth,
      height: targetHeight,
    };
  }, [photo.height, photo.width]);

  const targetRect = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return calculateTargetRect();
  }, [calculateTargetRect, windowSize]);

  const hasMatchingSource = useMemo(
    () => Boolean(openingTransition && openingTransition.photoId === photo.id),
    [openingTransition, photo.id]
  );

  const canUseMatchedTransition = useMemo(
    () => Boolean(!prefersReducedMotion && hasMatchingSource && targetRect),
    [hasMatchingSource, prefersReducedMotion, targetRect]
  );

  useEffect(() => {
    if (!canUseMatchedTransition) {
      setTransitionState("idle");
      return;
    }

    setClosingToRect(null);
    setTransitionState("opening");
    const timeout = window.setTimeout(() => {
      setTransitionState("idle");
    }, OPENING_STATE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [canUseMatchedTransition]);

  useEffect(() => {
    closeCompletedRef.current = false;
    if (closeFallbackTimerRef.current !== null) {
      window.clearTimeout(closeFallbackTimerRef.current);
      closeFallbackTimerRef.current = null;
    }

    return () => {
      if (closeFallbackTimerRef.current !== null) {
        window.clearTimeout(closeFallbackTimerRef.current);
        closeFallbackTimerRef.current = null;
      }
    };
  }, [photo.id]);

  useEffect(() => {
    transitionStateRef.current = transitionState;
  }, [transitionState]);

  const isValidClosingTarget = useCallback((rect: ImageRect): boolean => {
    if (rect.width <= 8 || rect.height <= 8) {
      return false;
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rectRight = rect.left + rect.width;
    const rectBottom = rect.top + rect.height;
    return rectRight > 0 && rectBottom > 0 && rect.left < viewportWidth && rect.top < viewportHeight;
  }, []);

  const defaultRect = useMemo<ImageRect>(() => {
    if (targetRect) return targetRect;
    return {
      left: window.innerWidth * 0.5 - 40,
      top: window.innerHeight * 0.5 - 40,
      width: 80,
      height: 80,
    };
  }, [targetRect]);

  const spring = useSpring({
    immediate: !canUseMatchedTransition,
    from:
      canUseMatchedTransition && openingTransition
      ? {
          x: openingTransition.left,
          y: openingTransition.top,
          width: openingTransition.width,
          height: openingTransition.height,
          borderRadius: openingTransition.borderRadius,
        }
      : { x: defaultRect.left, y: defaultRect.top, width: defaultRect.width, height: defaultRect.height, borderRadius: 0 },
    to:
      transitionState === "closing" && closingToRect
        ? {
            x: closingToRect.left,
            y: closingToRect.top,
            width: closingToRect.width,
            height: closingToRect.height,
            borderRadius: openingTransition?.borderRadius || 0,
          }
        : targetRect
          ? {
              x: targetRect.left,
              y: targetRect.top,
              width: targetRect.width,
              height: targetRect.height,
              borderRadius: 0,
            }
          : { x: defaultRect.left, y: defaultRect.top, width: defaultRect.width, height: defaultRect.height, borderRadius: 0 },
    config: transitionState === "closing" ? { duration: CLOSE_MAIN_DURATION_MS } : matchedOpenSpring,
    onRest: () => {
      if (transitionStateRef.current === "closing") {
        finishClose();
      }
    },
  });

  const overlaySpring = useSpring({
    opacity: transitionState === "closing" ? 0 : 1,
    config: transitionState === "closing" ? { duration: CLOSE_OVERLAY_DURATION_MS } : { tension: 280, friction: 34 },
  });

  const imageSpring = useSpring({
    opacity: isOriginalLoaded ? 1 : 0,
    config: { tension: 180, friction: 28 },
  });

  const controlsSpring = useSpring({
    opacity: transitionState === "closing" ? 0 : 1,
    transform: transitionState === "closing" ? "translateY(-8px)" : "translateY(0px)",
    delay: prefersReducedMotion ? 0 : transitionState === "opening" ? 70 : 0,
    config: prefersReducedMotion
      ? { duration: 0 }
      : transitionState === "closing"
        ? { duration: CLOSE_CONTROLS_DURATION_MS }
        : gentleOpenSpring,
  });

  const infoPanelSpring = useSpring({
    opacity: transitionState === "closing" ? 0 : 1,
    transform: transitionState === "closing" ? "translateX(24px)" : "translateX(0px)",
    delay: prefersReducedMotion ? 0 : transitionState === "opening" ? 40 : 0,
    config: prefersReducedMotion
      ? { duration: 0 }
      : transitionState === "closing"
        ? { duration: CLOSE_INFO_PANEL_DURATION_MS }
        : gentleOpenSpring,
  });

  const handleRequestClose = useCallback(() => {
    if (transitionState === "closing") return;
    stopVideo();

    if (prefersReducedMotion) {
      finishClose();
      return;
    }

    if (hasMatchingSource && openingTransition) {
      const nextClosingRect = {
        left: openingTransition.left,
        top: openingTransition.top,
        width: openingTransition.width,
        height: openingTransition.height,
      };
      setClosingToRect(isValidClosingTarget(nextClosingRect) ? nextClosingRect : null);
    } else {
      setClosingToRect(null);
    }

    setTransitionState("closing");
    closeFallbackTimerRef.current = window.setTimeout(() => {
      finishClose();
    }, CLOSE_FALLBACK_DELAY_MS);
  }, [finishClose, hasMatchingSource, isValidClosingTarget, openingTransition, prefersReducedMotion, stopVideo, transitionState]);

  const useAnimation = Boolean(
    canUseMatchedTransition &&
      (transitionState === "opening" || (transitionState === "closing" && Boolean(closingToRect)))
  );

  return {
    transitionState,
    overlaySpring,
    imageSpring,
    controlsSpring,
    infoPanelSpring,
    spring,
    useAnimation,
    handleRequestClose,
  };
};
