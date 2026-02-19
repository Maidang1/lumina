function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const utf8Decoder = new TextDecoder();

export function decodeBase64Utf8(base64: string): string {
  return utf8Decoder.decode(base64ToBytes(base64));
}
