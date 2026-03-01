import React from "react";
import { motion } from "motion/react";
import { Photo } from "@/features/photos/types";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { InfoPanel } from "@/features/photos/components/photo-detail/InfoPanel";
import PhotoDetailOverlay from "@/features/photos/components/photo-detail/PhotoDetailOverlay";
import PhotoDetailControls from "@/features/photos/components/photo-detail/PhotoDetailControls";
import PhotoDetailMediaStage from "@/features/photos/components/photo-detail/PhotoDetailMediaStage";
import { usePhotoDetailMedia } from "@/features/photos/components/photo-detail/usePhotoDetailMedia";
import { usePhotoDetailKeyboardNav } from "@/features/photos/components/photo-detail/usePhotoDetailKeyboardNav";
import { usePhotoDetailTransition } from "@/features/photos/components/photo-detail/usePhotoDetailTransition";
import type { PhotoOpenTransition } from "@/features/photos/types";

interface PhotoDetailProps {
  photo: Photo;
  onClose: () => void;
  tags?: string[];
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  openingTransition?: PhotoOpenTransition | null;
}

const PhotoDetail: React.FC<PhotoDetailProps> = ({
  photo,
  onClose,
  tags = [],
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
  openingTransition = null,
}) => {
  const {
    loadState,
    isOriginalLoaded,
    loadProgress,
    thumbnailImageRef,
    imageContainerRef,
    handleOriginalLoaded,
    handleOriginalError,
  } = usePhotoDetailMedia(photo);

  const {
    transitionState,
    isClosing,
    controlsDelay,
    infoPanelDelay,
    handleRequestClose,
  } = usePhotoDetailTransition({
    photo,
    openingTransition,
    onClose,
    stopVideo: () => undefined,
  });

  usePhotoDetailKeyboardNav({
    canPrev,
    canNext,
    onPrev,
    onNext,
    disabled: transitionState === "closing",
  });

  // FLIP morph: compute initial transform from source card position
  const hasFlipSource = openingTransition != null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

  // Calculate the info panel width to determine the media stage target area
  const infoPanelWidth = vw >= 1024 ? 420 : vw >= 768 ? 360 : 0;
  const mediaTargetWidth = vw - infoPanelWidth;
  const mediaTargetHeight = vh;

  // Calculate initial scale and offset for the morph
  const flipInitial = hasFlipSource
    ? {
        // Scale the entire media stage from the card's size
        scaleX: openingTransition.width / mediaTargetWidth,
        scaleY: openingTransition.height / mediaTargetHeight,
        // Position offset: card center vs media stage center
        x:
          openingTransition.left +
          openingTransition.width / 2 -
          mediaTargetWidth / 2,
        y:
          openingTransition.top +
          openingTransition.height / 2 -
          mediaTargetHeight / 2,
        borderRadius: openingTransition.borderRadius,
      }
    : null;

  const springTransition = {
    type: "spring" as const,
    stiffness: 340,
    damping: 36,
    mass: 0.8,
  };

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          handleRequestClose();
        }
      }}
    >
      <DialogContent className="h-screen w-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0 [&>button]:hidden">
        <PhotoDetailOverlay thumbnailUrl={photo.thumbnail} isClosing={isClosing} />

        <PhotoDetailControls
          canPrev={canPrev}
          canNext={canNext}
          onClose={handleRequestClose}
          onPrev={onPrev}
          onNext={onNext}
          isClosing={isClosing}
          delay={controlsDelay}
        />

        <motion.div
          className={`absolute inset-0 flex h-full w-full overflow-hidden will-change-transform ${
            transitionState === "closing" ? "pointer-events-none" : ""
          }`}
          initial={
            flipInitial
              ? {
                  opacity: 0.85,
                  scaleX: flipInitial.scaleX,
                  scaleY: flipInitial.scaleY,
                  x: flipInitial.x,
                  y: flipInitial.y,
                  borderRadius: flipInitial.borderRadius,
                }
              : { opacity: 0 }
          }
          animate={
            isClosing
              ? flipInitial
                ? {
                    opacity: 0,
                    scaleX: flipInitial.scaleX * 0.85,
                    scaleY: flipInitial.scaleY * 0.85,
                    x: flipInitial.x,
                    y: flipInitial.y,
                    borderRadius: flipInitial.borderRadius,
                  }
                : { opacity: 0 }
              : {
                  opacity: 1,
                  scaleX: 1,
                  scaleY: 1,
                  x: 0,
                  y: 0,
                  borderRadius: 0,
                }
          }
          transition={
            flipInitial
              ? springTransition
              : { duration: 0.2 }
          }
        >
          <PhotoDetailMediaStage
            photo={photo}
            loadState={loadState}
            isOriginalLoaded={isOriginalLoaded}
            loadProgress={loadProgress}
            thumbnailImageRef={thumbnailImageRef}
            imageContainerRef={imageContainerRef}
            onOriginalLoaded={handleOriginalLoaded}
            onOriginalError={handleOriginalError}
          />

          <motion.div
            className="absolute inset-x-0 bottom-0 h-[44svh] w-full shrink-0 border-t border-white/10 bg-black/70 backdrop-blur-md will-change-transform md:static md:h-full md:w-[360px] md:border-t-0 md:border-l md:bg-black/40 lg:w-[420px]"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: isClosing ? 0 : 1, x: isClosing ? 24 : 0 }}
            transition={{ duration: 0.2, delay: infoPanelDelay }}
          >
            <InfoPanel photo={photo} tags={tags} />
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoDetail;
