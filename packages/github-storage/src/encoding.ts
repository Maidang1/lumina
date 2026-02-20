const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function hasAtobBtoa(): boolean {
  return typeof atob === "function" && typeof btoa === "function";
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const sanitized = base64.replace(/\s+/g, "");
  const clean = sanitized.replace(/=+$/, "");
  const output: number[] = [];

  for (let i = 0; i < clean.length; i += 4) {
    const c1 = BASE64_ALPHABET.indexOf(clean[i] || "A");
    const c2 = BASE64_ALPHABET.indexOf(clean[i + 1] || "A");
    const c3 = BASE64_ALPHABET.indexOf(clean[i + 2] || "A");
    const c4 = BASE64_ALPHABET.indexOf(clean[i + 3] || "A");

    const triplet = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);

    output.push((triplet >> 16) & 0xff);
    if (i + 2 < clean.length) output.push((triplet >> 8) & 0xff);
    if (i + 3 < clean.length) output.push(triplet & 0xff);
  }

  return new Uint8Array(output);
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let result = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;

    const triplet = (b1 << 16) | (b2 << 8) | b3;

    result += BASE64_ALPHABET[(triplet >> 18) & 63];
    result += BASE64_ALPHABET[(triplet >> 12) & 63];
    result += i + 1 < bytes.length ? BASE64_ALPHABET[(triplet >> 6) & 63] : "=";
    result += i + 2 < bytes.length ? BASE64_ALPHABET[triplet & 63] : "=";
  }

  return result;
}

export function decodeBase64Utf8(base64: string): string {
  const normalized = base64.replace(/\n/g, "");

  if (hasAtobBtoa()) {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  return new TextDecoder().decode(decodeBase64ToBytes(normalized));
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (hasAtobBtoa()) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  return encodeBytesToBase64(bytes);
}
