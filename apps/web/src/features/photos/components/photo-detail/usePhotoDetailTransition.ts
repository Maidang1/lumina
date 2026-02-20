import { useCallback, useEffect, useMemo, useState } from "react";
import { config, useSpring } from "@react-spring/web";
import { Photo } from "@/features/photos/types";
import { ImageRect, PhotoOpenTransition } from "@/features/photos/components/photo-detail/types";

const appleSpring = { mass: 0.8, tension: 280, friction: 28 };
const appleSpringGentle = { mass: 1, tension: 200, friction: 26 };

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

  useEffect(() => {
    if (prefersReducedMotion || !openingTransition || openingTransition.photoId !== photo.id) {
      setTransitionState("idle");
      return;
    }

    setTransitionState("opening");
    const timeout = window.setTimeout(() => {
      setTransitionState("idle");
    }, 450);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [openingTransition, photo.id, prefersReducedMotion]);

  const spring = useSpring({
    immediate:
      prefersReducedMotion ||
      !openingTransition ||
      openingTransition.photoId !== photo.id ||
      !targetRect,
    from: openingTransition
      ? {
          x: openingTransition.left,
          y: openingTransition.top,
          width: openingTransition.width,
          height: openingTransition.height,
          borderRadius: openingTransition.borderRadius,
        }
      : { x: 0, y: 0, width: 100, height: 100, borderRadius: 0 },
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
          : { x: 0, y: 0, width: 100, height: 100, borderRadius: 0 },
    config: transitionState === "closing" ? appleSpringGentle : appleSpring,
    onRest: () => {
      if (transitionState === "closing") {
        onClose();
      }
    },
  });

  const overlaySpring = useSpring({
    opacity: transitionState === "closing" ? 0 : 1,
    config: { tension: 300, friction: 30 },
  });

  const imageSpring = useSpring({
    opacity: isOriginalLoaded ? 1 : 0,
    config: { tension: 180, friction: 28 },
  });

  const controlsSpring = useSpring({
    opacity: transitionState === "closing" ? 0 : 1,
    transform: transitionState === "closing" ? "translateY(-10px)" : "translateY(0px)",
    delay: prefersReducedMotion ? 0 : transitionState === "opening" ? 100 : 0,
    config: prefersReducedMotion ? { duration: 0 } : appleSpringGentle,
  });

  const infoPanelSpring = useSpring({
    opacity: transitionState === "closing" ? 0 : 1,
    transform: transitionState === "closing" ? "translateX(20px)" : "translateX(0px)",
    config: prefersReducedMotion ? { duration: 0 } : appleSpringGentle,
  });

  const handleRequestClose = useCallback(() => {
    if (transitionState === "closing") return;
    stopVideo();

    if (prefersReducedMotion || !openingTransition || openingTransition.photoId !== photo.id) {
      onClose();
      return;
    }

    setClosingToRect({
      left: openingTransition.left,
      top: openingTransition.top,
      width: openingTransition.width,
      height: openingTransition.height,
    });
    setTransitionState("closing");
  }, [onClose, openingTransition, photo.id, prefersReducedMotion, stopVideo, transitionState]);

  const useAnimation = Boolean(
    openingTransition && openingTransition.photoId === photo.id && transitionState !== "idle"
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
