import { Env } from "./types";
import { errorResponse } from "./http";

export type SignedAssetType = "original" | "thumb" | "live";

const encoder = new TextEncoder();

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createHmacSignature(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(signature);
}

function buildPayload(imageId: string, type: SignedAssetType, exp: number): string {
  return `${imageId}:${type}:${exp}`;
}

export async function buildSignedAssetUrl(
  request: Request,
  env: Env,
  imageId: string,
  type: SignedAssetType,
  expiresInSeconds: number
): Promise<string> {
  const secret = env.SHARE_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new Error("Server share signing secret is not configured");
  }
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, expiresInSeconds);
  const payload = buildPayload(imageId, type, exp);
  const sig = await createHmacSignature(secret, payload);
  const url = new URL(request.url);
  const encodedId = encodeURIComponent(imageId);
  return `${url.origin}/api/v1/images/${encodedId}/${type}?exp=${exp}&sig=${encodeURIComponent(sig)}`;
}

export async function validateSignedAssetAccess(
  request: Request,
  env: Env,
  imageId: string,
  type: SignedAssetType
): Promise<Response | null> {
  const secret = env.SHARE_SIGNING_SECRET?.trim();
  if (!secret) {
    return null;
  }

  const url = new URL(request.url);
  const expRaw = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");

  if (!expRaw && !sig) {
    return null;
  }

  if (!expRaw || !sig) {
    return errorResponse(env, "Missing share signature params", 401);
  }

  const exp = Number.parseInt(expRaw, 10);
  if (!Number.isFinite(exp)) {
    return errorResponse(env, "Invalid share expiration", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (exp < now) {
    return errorResponse(env, "Share link expired", 401);
  }

  const payload = buildPayload(imageId, type, exp);
  const expected = await createHmacSignature(secret, payload);
  if (expected !== sig) {
    return errorResponse(env, "Invalid share signature", 403);
  }

  return null;
}
