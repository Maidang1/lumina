import React from "react";
import { animated } from "@react-spring/web";
import { Photo } from "@/features/photos/types";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import PhotoDetailInfoPanel from "@/features/photos/components/photo-detail/PhotoDetailInfoPanel";
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
    overlaySpring,
    controlsSpring,
    infoPanelSpring,
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
        <PhotoDetailOverlay
          thumbnailUrl={photo.thumbnail}
          opacity={overlaySpring.opacity}
        />

        <PhotoDetailControls
          canPrev={canPrev}
          canNext={canNext}
          onClose={handleRequestClose}
          onPrev={onPrev}
          onNext={onNext}
          controlsOpacity={controlsSpring.opacity}
          controlsTransform={controlsSpring.transform}
          isClosing={transitionState === "closing"}
        />

        <animated.div
          className={`absolute inset-0 flex h-full w-full overflow-hidden ${transitionState === "closing" ? "pointer-events-none" : ""}`}
          style={{ opacity: overlaySpring.opacity }}
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

          <animated.div
            className="h-full w-[340px] shrink-0 border-l border-white/10 bg-black/40 backdrop-blur-xl will-change-transform md:w-[360px] lg:w-[420px]"
            style={{
              opacity: infoPanelSpring.opacity,
              transform: infoPanelSpring.transform,
            }}
          >
            <PhotoDetailInfoPanel
              photo={photo}
              tags={tags}
            />
          </animated.div>
        </animated.div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoDetail;
