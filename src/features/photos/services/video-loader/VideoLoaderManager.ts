import type { VideoSource } from "@/features/photos/types";
import {
  CachedVideo,
  MAX_VIDEO_CACHE_ENTRIES,
  VideoLoadCallbacks,
  VideoProcessResult,
} from "./types";
import { getExtensionFromUrl, guessMimeByUrl } from "./mime";
import { getFfmpegInstance, setFfmpegProgressConsumer } from "./ffmpeg";

export class VideoLoaderManager {
  private readonly cache = new Map<string, CachedVideo>();
  private conversionQueue: Promise<void> = Promise.resolve();

  private enqueueConversion<T>(task: () => Promise<T>): Promise<T> {
    const run = this.conversionQueue.then(task, task);
    this.conversionQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private touchCacheKey(cacheKey: string): void {
    const existing = this.cache.get(cacheKey);
    if (!existing) {
      return;
    }
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, existing);
  }

  private setCache(cacheKey: string, value: CachedVideo): void {
    if (this.cache.has(cacheKey)) {
      const previous = this.cache.get(cacheKey);
      if (previous?.objectUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previous.objectUrl);
      }
      this.cache.delete(cacheKey);
    }

    this.cache.set(cacheKey, value);
    while (this.cache.size > MAX_VIDEO_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      const oldest = this.cache.get(oldestKey);
      if (oldest?.objectUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(oldest.objectUrl);
      }
      this.cache.delete(oldestKey);
    }
  }

  private async checkCanPlayVideo(url: string, mime?: string): Promise<boolean> {
    const video = document.createElement("video");
    const mimeByUrl = guessMimeByUrl(url);
    const candidateMime = mime ?? mimeByUrl;

    if (candidateMime) {
      return video.canPlayType(candidateMime) !== "";
    }
    return video.canPlayType("video/mp4") !== "";
  }

  private async needsVideoConversion(videoUrl: string, mime?: string): Promise<boolean> {
    const mimeByUrl = guessMimeByUrl(videoUrl);
    const candidateMime = mime ?? mimeByUrl;
    const looksLikeMov = candidateMime === "video/quicktime" || getExtensionFromUrl(videoUrl) === "mov";
    if (!looksLikeMov) {
      return false;
    }
    const canPlay = await this.checkCanPlayVideo(videoUrl, candidateMime);
    return !canPlay;
  }

  async processVideo(
    videoSource: VideoSource,
    videoElement: HTMLVideoElement,
    callbacks: VideoLoadCallbacks = {}
  ): Promise<VideoProcessResult> {
    const { onLoadingStateUpdate } = callbacks;
    if (videoSource.type === "none") {
      throw new Error("No video source provided");
    }

    const cacheKey = videoSource.videoUrl;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.touchCacheKey(cacheKey);
      videoElement.src = cached.objectUrl;
      videoElement.load();
      await this.waitCanPlay(videoElement);
      return {
        convertedVideoUrl: cached.objectUrl,
        conversionMethod: cached.from === "converted" ? "mov-to-mp4" : "direct",
      };
    }

    const shouldConvert = await this.needsVideoConversion(videoSource.videoUrl, videoSource.mime);
    if (!shouldConvert) {
      videoElement.src = videoSource.videoUrl;
      videoElement.load();
      await this.waitCanPlay(videoElement);
      this.setCache(cacheKey, {
        objectUrl: videoSource.videoUrl,
        mime: videoSource.mime ?? guessMimeByUrl(videoSource.videoUrl) ?? "video/unknown",
        from: "direct",
      });
      return { conversionMethod: "direct" };
    }

    onLoadingStateUpdate?.({
      isConverting: true,
      loadingProgress: 0,
      conversionMessage: "正在转换实况视频...",
    });

    try {
      const convertedVideoUrl = await this.convertMovToMp4(videoSource.videoUrl, (progress) => {
        onLoadingStateUpdate?.({
          isConverting: true,
          loadingProgress: progress,
          conversionMessage: "正在转换实况视频...",
        });
      });

      videoElement.src = convertedVideoUrl;
      videoElement.load();
      await this.waitCanPlay(videoElement);
      this.setCache(cacheKey, {
        objectUrl: convertedVideoUrl,
        mime: "video/mp4",
        from: "converted",
      });
      onLoadingStateUpdate?.({
        isConverting: false,
        loadingProgress: 100,
      });
      return {
        convertedVideoUrl,
        conversionMethod: "mov-to-mp4",
      };
    } catch {
      videoElement.src = videoSource.videoUrl;
      videoElement.load();
      await this.waitCanPlay(videoElement);
      onLoadingStateUpdate?.({
        isConverting: false,
      });
      return { conversionMethod: "direct" };
    }
  }

  private async waitCanPlay(videoElement: HTMLVideoElement): Promise<void> {
    if (videoElement.readyState >= 3) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const handleCanPlay = () => {
        videoElement.removeEventListener("canplaythrough", handleCanPlay);
        videoElement.removeEventListener("error", handleError);
        resolve();
      };
      const handleError = () => {
        videoElement.removeEventListener("canplaythrough", handleCanPlay);
        videoElement.removeEventListener("error", handleError);
        reject(new Error("Video can not be played"));
      };
      videoElement.addEventListener("canplaythrough", handleCanPlay, { once: true });
      videoElement.addEventListener("error", handleError, { once: true });
    });
  }

  private async convertMovToMp4(
    videoUrl: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    return this.enqueueConversion(async () => {
      const ffmpeg = await getFfmpegInstance();
      const tag = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const inputName = `input_${tag}.mov`;
      const outputName = `output_${tag}.mp4`;

      setFfmpegProgressConsumer(onProgress);
      onProgress(1);

      try {
        const { fetchFile } = await import("@ffmpeg/util");
        const inputData = await fetchFile(videoUrl);
        await ffmpeg.writeFile(inputName, inputData);
        await ffmpeg.exec([
          "-i",
          inputName,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "-c:a",
          "aac",
          outputName,
        ]);

        const outputData = await ffmpeg.readFile(outputName);
        const outputBlob = new Blob([outputData], { type: "video/mp4" });
        if (outputBlob.size === 0) {
          throw new Error("MP4 conversion output is empty");
        }
        onProgress(100);
        return URL.createObjectURL(outputBlob);
      } finally {
        setFfmpegProgressConsumer(null);
        try {
          await ffmpeg.deleteFile(inputName);
        } catch {
          // ignore cleanup failure
        }
        try {
          await ffmpeg.deleteFile(outputName);
        } catch {
          // ignore cleanup failure
        }
      }
    });
  }

  clearVideoCache(): void {
    for (const item of this.cache.values()) {
      if (item.from === "converted" && item.objectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.objectUrl);
      }
    }
    this.cache.clear();
  }
}
