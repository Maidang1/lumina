import { thumbHashToDataURL } from "thumbhash";

const thumbhashDataUrlCache = new Map<string, string>();

function base64ToBytes(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function thumbhashToDataUrl(thumbhash?: string): string | undefined {
  if (!thumbhash) {
    return undefined;
  }

  const cached = thumbhashDataUrlCache.get(thumbhash);
  if (cached) {
    return cached;
  }

  try {
    const bytes = base64ToBytes(thumbhash);
    const dataUrl = thumbHashToDataURL(bytes);
    thumbhashDataUrlCache.set(thumbhash, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
}
