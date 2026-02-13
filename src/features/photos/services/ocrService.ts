import Tesseract from "tesseract.js";
import { OcrInfo } from "@/features/photos/types";

export interface OcrOptions {
  lang: string;
  maxChars: number;
}

export interface OcrProgress {
  status: string;
  progress: number;
}

type ProgressCallback = (progress: OcrProgress) => void;

const DEFAULT_OPTIONS: OcrOptions = {
  lang: "eng+chi_sim",
  maxChars: 2000,
};

export async function performOcr(
  file: File | Blob,
  options: Partial<OcrOptions> = {},
  onProgress?: ProgressCallback
): Promise<OcrInfo> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    if (onProgress) {
      onProgress({ status: "initializing", progress: 0 });
    }

    const result = await Tesseract.recognize(file, opts.lang, {
      logger: (m) => {
        if (onProgress && m.progress !== undefined) {
          onProgress({
            status: m.status,
            progress: m.progress,
          });
        }
      },
    });

    const text = (result.data.text || "").trim();

    if (!text) {
      return {
        status: "skipped",
        lang: opts.lang,
        summary: "",
      };
    }

    return {
      status: "ok",
      lang: opts.lang,
      summary: text.slice(0, opts.maxChars),
    };
  } catch (error) {
    console.warn("OCR failed:", error);
    return {
      status: "failed",
      lang: opts.lang,
    };
  }
}
