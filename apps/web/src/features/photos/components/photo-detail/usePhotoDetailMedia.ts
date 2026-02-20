import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { Photo } from "@/features/photos/types";
import { useLivePhotoControls } from "@/features/photos/components/hooks/useLivePhotoControls";
import { videoLoaderManager } from "@/features/photos/services/videoLoaderManager";

interface UsePhotoDetailMediaResult {
  hasVideo: boolean;
  isOriginalLoaded: boolean;
  loadProgress: number;
  isLivePlaying: boolean;
  isVideoReady: boolean;
  isConvertingVideo: boolean;
  livePlaybackError: string | null;
  liveFrameSize: { width: number; height: number } | null;
  liveVideoRef: MutableRefObject<HTMLVideoElement | null>;
  thumbnailImageRef: MutableRefObject<HTMLImageElement | null>;
  imageContainerRef: MutableRefObject<HTMLDivElement | null>;
  setIsOriginalLoaded: (loaded: boolean) => void;
  handleLongPressStart: () => void;
  handleLongPressEnd: () => void;
  stopVideo: () => void;
}

export const usePhotoDetailMedia = (photo: Photo): UsePhotoDetailMediaResult => {
  const [isOriginalLoaded, setIsOriginalLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLivePlaying, setIsLivePlaying] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isConvertingVideo, setIsConvertingVideo] = useState(false);
  const [livePlaybackError, setLivePlaybackError] = useState<string | null>(null);
  const [liveFrameSize, setLiveFrameSize] = useState<{ width: number; height: number } | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const thumbnailImageRef = useRef<HTMLImageElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  const hasVideo = photo.videoSource?.type === "live-photo";

  useEffect(() => {
    setIsOriginalLoaded(false);
    setLoadProgress(0);
  }, [photo.id]);

  useEffect(() => {
    let cancelled = false;

    const loadImageWithProgress = async (): Promise<void> => {
      if (cancelled) return;
      setLoadProgress(0);

      try {
        const response = await fetch(photo.url, { mode: "cors" });
        if (!response.ok || !response.body) {
          throw new Error("Failed to fetch image");
        }

        const reader = response.body.getReader();
        const contentLength = response.headers.get("content-length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let received = 0;

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          received += value.length;
          if (total > 0) {
            setLoadProgress(Math.round((received / total) * 100));
          }
        }

        if (!cancelled) {
          setLoadProgress(100);
        }
      } catch {
        if (!cancelled) {
          setLoadProgress(100);
        }
      }
    };

    void loadImageWithProgress();

    return () => {
      cancelled = true;
    };
  }, [photo.id, photo.url]);

  const stopVideo = useCallback(() => {
    const video = liveVideoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setIsLivePlaying(false);
  }, []);

  const playVideo = useCallback(() => {
    const video = liveVideoRef.current;
    if (!video || !isVideoReady || isConvertingVideo) return;
    setLivePlaybackError(null);
    setIsLivePlaying(true);
    video.currentTime = 0;
    video.play().catch(() => {
      setIsLivePlaying(false);
      setLivePlaybackError(
        "Live photo playback failed. Your browser may not support this codec. Try downloading and opening with a system player."
      );
    });
  }, [isConvertingVideo, isVideoReady]);

  const { handleStart: handleLongPressStart, handleEnd: handleLongPressEnd } = useLivePhotoControls({
    mode: "long-press",
    enabled: hasVideo,
    isPlaying: isLivePlaying,
    isVideoReady,
    onPlay: playVideo,
    onStop: stopVideo,
    delayMs: 200,
  });

  useEffect(() => {
    setIsLivePlaying(false);
    setLivePlaybackError(null);
    setIsVideoReady(false);
    setIsConvertingVideo(false);
    setLiveFrameSize(null);
  }, [photo.id]);

  useEffect(() => {
    const image = thumbnailImageRef.current;
    if (!image) return;

    const updateLiveFrameSize = (): void => {
      const rect = image.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setLiveFrameSize({ width: rect.width, height: rect.height });
    };

    updateLiveFrameSize();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateLiveFrameSize();
          })
        : null;

    observer?.observe(image);
    window.addEventListener("resize", updateLiveFrameSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateLiveFrameSize);
    };
  }, [photo.id, isOriginalLoaded]);

  useEffect(() => {
    if (!hasVideo || !liveVideoRef.current || isVideoReady || !photo.videoSource) {
      return;
    }

    let cancelled = false;
    void videoLoaderManager
      .processVideo(photo.videoSource, liveVideoRef.current, {
        onLoadingStateUpdate: (state) => {
          if (!cancelled) {
            setIsConvertingVideo(Boolean(state.isConverting));
          }
        },
      })
      .then(() => {
        if (!cancelled) {
          setIsVideoReady(true);
          setLivePlaybackError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLivePlaybackError(
            "Failed to load live video. The browser may not support MOV/HEVC, or the source is temporarily unavailable."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsConvertingVideo(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasVideo, isVideoReady, photo.videoSource]);

  useEffect(() => {
    return () => {
      stopVideo();
    };
  }, [stopVideo]);

  return {
    hasVideo,
    isOriginalLoaded,
    loadProgress,
    isLivePlaying,
    isVideoReady,
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
  };
};
