export interface ThumbnailResult {
  blob: Blob;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

export interface ImageProcessorOptions {
  maxThumbSize: number;
  thumbQuality: number;
  thumbMime: string;
  blurThreshold: number;
  colorSampleSize: number;
  blurSampleSize: number;
}

const DEFAULT_OPTIONS: ImageProcessorOptions = {
  maxThumbSize: 1024,
  thumbQuality: 0.85,
  thumbMime: "image/webp",
  blurThreshold: 100,
  colorSampleSize: 32,
  blurSampleSize: 128,
};

export async function createThumbnail(
  file: File | Blob,
  options: Partial<ImageProcessorOptions> = {}
): Promise<ThumbnailResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, opts.maxThumbSize / Math.max(bmp.width, bmp.height));
  const width = Math.max(1, Math.round(bmp.width * scale));
  const height = Math.max(1, Math.round(bmp.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: true,
  });

  if (!ctx) {
    throw new Error("Failed to get canvas 2d context");
  }

  ctx.drawImage(bmp, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("canvas.toBlob failed"));
      },
      opts.thumbMime,
      opts.thumbQuality
    );
  });

  bmp.close();
  return { blob, width, height, canvas };
}

export function getDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return createImageBitmap(file).then((bmp) => {
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close();
    return dims;
  });
}

export function extractDominantColor(
  canvas: HTMLCanvasElement,
  sampleSize: number = 32
): { hex: string } {
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = sampleSize;
  tmpCanvas.height = sampleSize;

  const ctx = tmpCanvas.getContext("2d", {
    alpha: false,
    willReadFrequently: true,
  });

  if (!ctx) {
    return { hex: "#808080" };
  }

  ctx.drawImage(canvas, 0, 0, sampleSize, sampleSize);
  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  const data = imageData.data;
  const hist = new Map<number, number>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] >> 4;
    const g = data[i + 1] >> 4;
    const b = data[i + 2] >> 4;
    const key = (r << 8) | (g << 4) | b;
    hist.set(key, (hist.get(key) || 0) + 1);
  }

  let bestKey = 0;
  let bestCount = -1;
  for (const [key, count] of hist.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }

  const r = ((bestKey >> 8) & 0xf) * 17;
  const g = ((bestKey >> 4) & 0xf) * 17;
  const b = (bestKey & 0xf) * 17;

  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`;

  return { hex };
}

export function detectBlur(
  canvas: HTMLCanvasElement,
  sampleSize: number = 128,
  threshold: number = 100
): { score: number; is_blurry: boolean; method: "variance_of_laplacian" } {
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = sampleSize;
  tmpCanvas.height = sampleSize;

  const ctx = tmpCanvas.getContext("2d", {
    alpha: false,
    willReadFrequently: true,
  });

  if (!ctx) {
    return {
      score: 0,
      is_blurry: true,
      method: "variance_of_laplacian",
    };
  }

  ctx.drawImage(canvas, 0, 0, sampleSize, sampleSize);
  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  const data = imageData.data;

  const gray = new Float32Array(sampleSize * sampleSize);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[p] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const laplacian = new Float32Array(sampleSize * sampleSize);
  const idx = (x: number, y: number) => y * sampleSize + x;

  for (let y = 1; y < sampleSize - 1; y++) {
    for (let x = 1; x < sampleSize - 1; x++) {
      laplacian[idx(x, y)] =
        gray[idx(x, y - 1)] +
        gray[idx(x - 1, y)] -
        4 * gray[idx(x, y)] +
        gray[idx(x + 1, y)] +
        gray[idx(x, y + 1)];
    }
  }

  let mean = 0;
  const count = (sampleSize - 2) * (sampleSize - 2);
  for (let y = 1; y < sampleSize - 1; y++) {
    for (let x = 1; x < sampleSize - 1; x++) {
      mean += laplacian[idx(x, y)];
    }
  }
  mean /= count;

  let variance = 0;
  for (let y = 1; y < sampleSize - 1; y++) {
    for (let x = 1; x < sampleSize - 1; x++) {
      const diff = laplacian[idx(x, y)] - mean;
      variance += diff * diff;
    }
  }
  variance /= count;

  return {
    score: variance,
    is_blurry: variance < threshold,
    method: "variance_of_laplacian",
  };
}

export async function computeSHA256(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hashHex}`;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function guessExtension(mime: string): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
  };
  return mimeMap[mime] || "bin";
}
