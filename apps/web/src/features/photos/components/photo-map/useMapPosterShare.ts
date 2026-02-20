import { useCallback, useEffect, useRef, useState } from "react";
import { RegionAggregate } from "@/features/photos/types/map";
import { buildMapSharePoster } from "@/features/photos/services/mapSharePoster";

interface UseMapPosterShareParams {
  visiblePointsCount: number;
  regionAggregates: RegionAggregate[];
  timeRangeLabel: string;
  captureCurrentMapCanvas: () => Promise<HTMLCanvasElement>;
}

interface UseMapPosterShareResult {
  isSharing: boolean;
  isPosterPreviewOpen: boolean;
  posterPreviewUrl: string | null;
  isPosterActionRunning: boolean;
  handleShareMap: () => Promise<void>;
  handleDownloadPoster: () => void;
  handleCopyPoster: () => Promise<void>;
  closePosterPreview: () => void;
}

export const useMapPosterShare = ({
  visiblePointsCount,
  regionAggregates,
  timeRangeLabel,
  captureCurrentMapCanvas,
}: UseMapPosterShareParams): UseMapPosterShareResult => {
  const [isSharing, setIsSharing] = useState(false);
  const [isPosterPreviewOpen, setIsPosterPreviewOpen] = useState(false);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const [posterFileName, setPosterFileName] = useState<string>("lumina-footprint.png");
  const [isPosterActionRunning, setIsPosterActionRunning] = useState(false);
  const posterBlobRef = useRef<Blob | null>(null);

  const closePosterPreview = useCallback((): void => {
    setIsPosterPreviewOpen(false);
    posterBlobRef.current = null;
    if (posterPreviewUrl) {
      URL.revokeObjectURL(posterPreviewUrl);
      setPosterPreviewUrl(null);
    }
  }, [posterPreviewUrl]);

  useEffect(() => {
    return () => {
      if (posterPreviewUrl) {
        URL.revokeObjectURL(posterPreviewUrl);
      }
    };
  }, [posterPreviewUrl]);

  const handleShareMap = useCallback(async (): Promise<void> => {
    if (visiblePointsCount === 0) {
      window.alert("No map points available to share.");
      return;
    }

    setIsSharing(true);
    try {
      const mapCanvas = await captureCurrentMapCanvas();
      const { blob, filename } = await buildMapSharePoster({
        mapCanvas,
        regionAggregates,
        visiblePointsCount,
        timeRangeLabel,
      });
      if (posterPreviewUrl) {
        URL.revokeObjectURL(posterPreviewUrl);
      }

      const previewUrl = URL.createObjectURL(blob);
      posterBlobRef.current = blob;
      setPosterFileName(filename);
      setPosterPreviewUrl(previewUrl);
      setIsPosterPreviewOpen(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to generate share poster");
    } finally {
      setIsSharing(false);
    }
  }, [captureCurrentMapCanvas, posterPreviewUrl, regionAggregates, timeRangeLabel, visiblePointsCount]);

  const handleDownloadPoster = useCallback((): void => {
    const blob = posterBlobRef.current;
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = posterFileName;
    link.click();
    URL.revokeObjectURL(url);
  }, [posterFileName]);

  const handleCopyPoster = useCallback(async (): Promise<void> => {
    const blob = posterBlobRef.current;
    if (!blob) return;
    if (!("clipboard" in navigator) || !("write" in navigator.clipboard)) {
      window.alert("Your browser does not support image copy. Please download instead.");
      return;
    }

    setIsPosterActionRunning(true);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
      window.alert("Poster copied to clipboard.");
    } catch {
      window.alert("Copy failed. Please download instead.");
    } finally {
      setIsPosterActionRunning(false);
    }
  }, []);

  return {
    isSharing,
    isPosterPreviewOpen,
    posterPreviewUrl,
    isPosterActionRunning,
    handleShareMap,
    handleDownloadPoster,
    handleCopyPoster,
    closePosterPreview,
  };
};
