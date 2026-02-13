import { PHashInfo } from "@/features/photos/types";

export interface PHashOptions {
  bits: 16 | 32;
  method: 1 | 2;
}

interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const DEFAULT_OPTIONS: PHashOptions = {
  bits: 16,
  method: 2,
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function imageToImageData(img: HTMLImageElement): ImageDataLike {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: true,
  });

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function bitsToHexHash(bitsArray: number[]): string {
  const hex: string[] = [];
  for (let i = 0; i < bitsArray.length; i += 4) {
    const nibble = bitsArray.slice(i, i + 4);
    hex.push(parseInt(nibble.join(""), 2).toString(16));
  }
  return hex.join("");
}

function bmvbhashEven(data: ImageDataLike, bits: number): string {
  const blocksizeX = Math.floor(data.width / bits);
  const blocksizeY = Math.floor(data.height / bits);
  const result: number[] = [];

  for (let y = 0; y < bits; y++) {
    for (let x = 0; x < bits; x++) {
      let total = 0;
      for (let iy = 0; iy < blocksizeY; iy++) {
        for (let ix = 0; ix < blocksizeX; ix++) {
          const cx = x * blocksizeX + ix;
          const cy = y * blocksizeY + iy;
          const ii = (cy * data.width + cx) * 4;
          const alpha = data.data[ii + 3];
          if (alpha === 0) {
            total += 765;
          } else {
            total += data.data[ii] + data.data[ii + 1] + data.data[ii + 2];
          }
        }
      }
      result.push(total);
    }
  }

  const quarter = (bits * bits) / 4;
  const medians = [
    median(result.slice(0, quarter)),
    median(result.slice(quarter, quarter * 2)),
    median(result.slice(quarter * 2, quarter * 3)),
    median(result.slice(quarter * 3)),
  ];

  for (let i = 0; i < bits * bits; i++) {
    const group = Math.floor(i / quarter);
    result[i] = result[i] < medians[group] ? 0 : 1;
  }

  return bitsToHexHash(result);
}

function bmvbhash(data: ImageDataLike, bits: number): string {
  const result: number[] = [];
  const blocks: number[][] = Array.from({ length: bits }, () => Array(bits).fill(0));

  const evenX = data.width % bits === 0;
  const evenY = data.height % bits === 0;

  if (evenX && evenY) {
    return bmvbhashEven(data, bits);
  }

  const blockWidth = data.width / bits;
  const blockHeight = data.height / bits;

  for (let y = 0; y < data.height; y++) {
    let blockTop: number;
    let blockBottom: number;
    let weightTop: number;
    let weightBottom: number;

    if (evenY) {
      blockTop = Math.floor(y / blockHeight);
      blockBottom = blockTop;
      weightTop = 1;
      weightBottom = 0;
    } else {
      const yMod = (y + 1) % blockHeight;
      const yFrac = yMod - Math.floor(yMod);
      const yInt = yMod - yFrac;
      weightTop = 1 - yFrac;
      weightBottom = yFrac;
      if (yInt > 0 || y + 1 === data.height) {
        blockTop = Math.floor(y / blockHeight);
        blockBottom = blockTop;
      } else {
        blockTop = Math.floor(y / blockHeight);
        blockBottom = Math.ceil(y / blockHeight);
      }
    }

    for (let x = 0; x < data.width; x++) {
      const ii = (y * data.width + x) * 4;
      const alpha = data.data[ii + 3];
      const avgValue =
        alpha === 0 ? 765 : data.data[ii] + data.data[ii + 1] + data.data[ii + 2];

      let blockLeft: number;
      let blockRight: number;
      let weightLeft: number;
      let weightRight: number;

      if (evenX) {
        blockLeft = Math.floor(x / blockWidth);
        blockRight = blockLeft;
        weightLeft = 1;
        weightRight = 0;
      } else {
        const xMod = (x + 1) % blockWidth;
        const xFrac = xMod - Math.floor(xMod);
        const xInt = xMod - xFrac;
        weightLeft = 1 - xFrac;
        weightRight = xFrac;
        if (xInt > 0 || x + 1 === data.width) {
          blockLeft = Math.floor(x / blockWidth);
          blockRight = blockLeft;
        } else {
          blockLeft = Math.floor(x / blockWidth);
          blockRight = Math.ceil(x / blockWidth);
        }
      }

      blocks[blockTop][blockLeft] += avgValue * weightTop * weightLeft;
      blocks[blockTop][blockRight] += avgValue * weightTop * weightRight;
      blocks[blockBottom][blockLeft] += avgValue * weightBottom * weightLeft;
      blocks[blockBottom][blockRight] += avgValue * weightBottom * weightRight;
    }
  }

  for (let i = 0; i < bits; i++) {
    for (let j = 0; j < bits; j++) {
      result.push(blocks[i][j]);
    }
  }

  const quarter = (bits * bits) / 4;
  const medians = [
    median(result.slice(0, quarter)),
    median(result.slice(quarter, quarter * 2)),
    median(result.slice(quarter * 2, quarter * 3)),
    median(result.slice(quarter * 3)),
  ];

  for (let i = 0; i < bits * bits; i++) {
    const group = Math.floor(i / quarter);
    result[i] = result[i] < medians[group] ? 0 : 1;
  }

  return bitsToHexHash(result);
}

function blockhashData(imgData: ImageDataLike, bits: number, method: 1 | 2): string {
  if (method === 1) {
    return bmvbhashEven(imgData, bits);
  }
  if (method === 2) {
    return bmvbhash(imgData, bits);
  }
  throw new Error("Bad hashing method");
}

export async function computePHash(
  file: File | Blob,
  options: Partial<PHashOptions> = {}
): Promise<PHashInfo> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImage(objectUrl);
    const imageData = imageToImageData(img);
    const value = blockhashData(imageData, opts.bits, opts.method);

    return {
      algo: "blockhash",
      bits: opts.bits,
      value,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error("Hash lengths must be equal");
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

export function similarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  return 1 - distance / hash1.length;
}
