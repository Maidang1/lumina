import {
  Env,
  isValidImageId,
  validateUploadToken,
  jsonResponse,
  errorResponse,
  corsHeaders,
  buildSignedAssetUrl,
} from "../../../../_utils";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  if (request.method !== "POST") {
    return errorResponse(env, "Method not allowed", 405);
  }

  const tokenError = validateUploadToken(request, env);
  if (tokenError) {
    return tokenError;
  }

  const rawId = params.id as string;
  let imageId: string;
  try {
    imageId = decodeURIComponent(rawId);
  } catch {
    return errorResponse(env, "Invalid image_id encoding", 400);
  }
  if (!isValidImageId(imageId)) {
    return errorResponse(env, "Invalid image_id", 400);
  }

  let body: { type?: "original" | "thumb" | "live"; expires_in_seconds?: number };
  try {
    body = (await request.json()) as { type?: "original" | "thumb" | "live"; expires_in_seconds?: number };
  } catch {
    return errorResponse(env, "Invalid request body", 400);
  }

  const type = body.type ?? "original";
  if (type !== "original" && type !== "thumb" && type !== "live") {
    return errorResponse(env, "Invalid type", 400);
  }

  const expires = Number.isFinite(body.expires_in_seconds)
    ? Math.max(60, Math.min(7 * 24 * 60 * 60, Number(body.expires_in_seconds)))
    : 24 * 60 * 60;

  try {
    const url = await buildSignedAssetUrl(request, env, imageId, type, expires);
    return jsonResponse(env, { url, expires_in_seconds: expires, type });
  } catch (error) {
    return errorResponse(
      env,
      error instanceof Error ? error.message : "Failed to build share url",
      500
    );
  }
};
