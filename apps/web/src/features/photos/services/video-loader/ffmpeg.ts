import { FFMPEG_CORE_JS_URL, FFMPEG_CORE_WASM_URL } from "./types";

let ffmpegPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;
let ffmpegProgressConsumer: ((progress: number) => void) | null = null;

export async function getFfmpegInstance(): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  if (ffmpegPromise) {
    return ffmpegPromise;
  }

  ffmpegPromise = (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);
    const ffmpeg = new FFmpeg();
    const coreURL = await toBlobURL(FFMPEG_CORE_JS_URL, "text/javascript");
    const wasmURL = await toBlobURL(FFMPEG_CORE_WASM_URL, "application/wasm");

    ffmpeg.on("progress", ({ progress }: { progress: number }) => {
      if (ffmpegProgressConsumer) {
        ffmpegProgressConsumer(Math.max(0, Math.min(100, Math.round(progress * 100))));
      }
    });

    await ffmpeg.load({ coreURL, wasmURL });
    return ffmpeg;
  })();

  return ffmpegPromise;
}

export function setFfmpegProgressConsumer(
  consumer: ((progress: number) => void) | null
): void {
  ffmpegProgressConsumer = consumer;
}
