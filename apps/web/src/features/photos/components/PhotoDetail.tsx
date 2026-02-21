import React, { useCallback, useState } from "react";
import { animated } from "@react-spring/web";
import { Photo } from "@/features/photos/types";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { uploadService } from "@/features/photos/services/uploadService";
import PhotoDetailInfoPanel from "@/features/photos/components/photo-detail/PhotoDetailInfoPanel";
import PhotoDetailOverlay from "@/features/photos/components/photo-detail/PhotoDetailOverlay";
import PhotoDetailControls from "@/features/photos/components/photo-detail/PhotoDetailControls";
import PhotoDetailMediaStage from "@/features/photos/components/photo-detail/PhotoDetailMediaStage";
import { usePhotoDetailMedia } from "@/features/photos/components/photo-detail/usePhotoDetailMedia";
import { usePhotoDetailKeyboardNav } from "@/features/photos/components/photo-detail/usePhotoDetailKeyboardNav";
import { usePhotoDetailTransition } from "@/features/photos/components/photo-detail/usePhotoDetailTransition";
import { PhotoOpenTransition } from "@/features/photos/components/photo-detail/types";

interface PhotoDetailProps {
  photo: Photo;
  onClose: () => void;
  canDelete?: boolean;
  isDeleting?: boolean;
  onDelete?: (photoId: string) => Promise<void>;
  isFavorite?: boolean;
  onToggleFavorite?: (photoId: string) => void;
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
  canDelete = false,
  isDeleting = false,
  onDelete,
  isFavorite = false,
  onToggleFavorite,
  tags = [],
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
  openingTransition = null,
}) => {
  const [shareMode, setShareMode] = useState<"private" | "public">("private");
  const [watermarkPreviewEnabled, setWatermarkPreviewEnabled] = useState(false);
  const [shareLink, setShareLink] = useState<string>("");

  const {
    hasVideo,
    isOriginalLoaded,
    loadProgress,
    isLivePlaying,
    isConvertingVideo,
    livePlaybackError,
    liveFrameSize,
    liveVideoRef,
    thumbnailImageRef,
    imageContainerRef,
    setIsOriginalLoaded,
    handleLongPressStart,
    handleLongPressEnd,
    stopVideo,
  } = usePhotoDetailMedia(photo);

  const {
    overlaySpring,
    imageSpring,
    controlsSpring,
    infoPanelSpring,
    spring,
    useAnimation,
    handleRequestClose,
  } = usePhotoDetailTransition({
    photo,
    openingTransition,
    onClose,
    stopVideo,
    isOriginalLoaded,
  });

  usePhotoDetailKeyboardNav({ canPrev, canNext, onPrev, onNext });

  const handleDelete = useCallback(async () => {
    if (!onDelete || isDeleting) return;
    const confirmed = window.confirm("Delete this photo? This action cannot be undone.");
    if (!confirmed) return;
    await onDelete(photo.id);
  }, [isDeleting, onDelete, photo.id]);

  const generateShareLink = useCallback(async () => {
    try {
      const shareType = photo.isLive && shareMode === "public" ? "live" : "original";
      const result = await uploadService.createSignedShareUrl(photo.id, shareType, 24 * 60 * 60);
      const link = result.url;
      setShareLink(link);
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // ignore clipboard failures
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate signed share URL";
      window.alert(message);
    }
  }, [photo.id, photo.isLive, shareMode]);

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          handleRequestClose();
        }
      }}
    >
      <DialogContent
        className="h-screen w-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0 [&>button]:hidden"
      >
        <PhotoDetailOverlay thumbnailUrl={photo.thumbnail} opacity={overlaySpring.opacity} />

        <PhotoDetailControls
          canPrev={canPrev}
          canNext={canNext}
          onClose={handleRequestClose}
          onPrev={onPrev}
          onNext={onNext}
          overlayOpacity={overlaySpring.opacity}
          controlsTransform={controlsSpring.transform}
        />

        <animated.div
          className="absolute inset-0 flex h-full w-full overflow-hidden"
          style={{ opacity: overlaySpring.opacity }}
        >
          <PhotoDetailMediaStage
            photo={photo}
            hasVideo={hasVideo}
            isOriginalLoaded={isOriginalLoaded}
            loadProgress={loadProgress}
            isLivePlaying={isLivePlaying}
            liveFrameSize={liveFrameSize}
            liveVideoRef={liveVideoRef}
            thumbnailImageRef={thumbnailImageRef}
            imageContainerRef={imageContainerRef}
            onOriginalLoaded={() => setIsOriginalLoaded(true)}
            onStopVideo={stopVideo}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
            useAnimation={useAnimation}
            animationSpring={spring}
            imageOpacity={imageSpring.opacity}
          />

          <animated.div
            className="h-full w-[340px] shrink-0 border-l border-white/10 bg-black/40 backdrop-blur-xl md:w-[360px] lg:w-[420px]"
            style={{
              opacity: infoPanelSpring.opacity,
              transform: infoPanelSpring.transform,
            }}
          >
            <PhotoDetailInfoPanel
              photo={photo}
              isFavorite={isFavorite}
              tags={tags}
              hasVideo={hasVideo}
              isConvertingVideo={isConvertingVideo}
              livePlaybackError={livePlaybackError}
              canDelete={canDelete}
              isDeleting={isDeleting}
              onDeleteClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                void handleDelete();
              }}
              onToggleFavorite={onToggleFavorite}
              shareMode={shareMode}
              onChangeShareMode={setShareMode}
              watermarkPreviewEnabled={watermarkPreviewEnabled}
              onToggleWatermarkPreview={setWatermarkPreviewEnabled}
              onGenerateShareLink={() => {
                void generateShareLink();
              }}
              shareLink={shareLink}
            />
          </animated.div>
        </animated.div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoDetail;
