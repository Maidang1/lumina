import { VIDEO_MIME_BY_EXTENSION } from "./types";

export function getExtensionFromUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    const cleanPath = parsed.pathname.split("?")[0].split("#")[0];
    const segments = cleanPath.split(".");
    return segments.length > 1 ? segments[segments.length - 1].toLowerCase() : "";
  } catch {
    const cleanPath = url.split("?")[0].split("#")[0];
    const segments = cleanPath.split(".");
    return segments.length > 1 ? segments[segments.length - 1].toLowerCase() : "";
  }
}

export function guessMimeByUrl(url: string): string | undefined {
  const extension = getExtensionFromUrl(url);
  return VIDEO_MIME_BY_EXTENSION[extension];
}
