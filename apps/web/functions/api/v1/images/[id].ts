import {
  Env,
  ImageMetadata,
  createGitHubClient,
  decodeBase64Utf8,
  isValidImageId,
  imageIdToMetaPath,
  validateUploadToken,
  mapGitHubErrorToHttp,
  jsonResponse,
  errorResponse,
  corsHeaders,
} from "../../../_utils";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  if (request.method !== "GET" && request.method !== "DELETE" && request.method !== "PATCH") {
    return errorResponse(env, "Method not allowed", 405);
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

  if (request.method === "GET") {
    try {
      const github = createGitHubClient(env);
      const file = await github.getFile(imageIdToMetaPath(imageId));

      const content = decodeBase64Utf8(file.content);
      const metadata = JSON.parse(content) as ImageMetadata;

      return jsonResponse(env, metadata);
    } catch (error) {
      const mapped = mapGitHubErrorToHttp(env, error);
      if (mapped) return mapped;
      if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
        return errorResponse(env, "Image not found", 404);
      }
      return errorResponse(env, "Failed to fetch metadata", 500);
    }
  }

  if (request.method === "PATCH") {
    try {
      const tokenError = validateUploadToken(request, env);
      if (tokenError) {
        return tokenError;
      }

      const body = await request.json() as Record<string, unknown>;

      const github = createGitHubClient(env);
      const file = await github.getFile(imageIdToMetaPath(imageId));
      const metadata = JSON.parse(decodeBase64Utf8(file.content)) as ImageMetadata;

      if (typeof body.description === "string") {
        metadata.description = body.description;
      }
      if (typeof body.original_filename === "string") {
        metadata.original_filename = body.original_filename;
      }
      if (typeof body.category === "string") {
        metadata.category = body.category;
      }
      if (isPrivacyInfo(body.privacy)) {
        metadata.privacy = body.privacy;
      }
      if (isGeoRegionPayload(body.geo)) {
        metadata.geo = body.geo;
      }
      if (isProcessingPayload(body.processing)) {
        metadata.processing = body.processing;
      }

      await github.updateImageMetadata(metadata);

      return jsonResponse(env, metadata);
    } catch (error) {
      const mapped = mapGitHubErrorToHttp(env, error);
      if (mapped) return mapped;
      if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
        return errorResponse(env, "Image not found", 404);
      }
      return errorResponse(env, "Failed to update metadata", 500);
    }
  }

  try {
    const tokenError = validateUploadToken(request, env);
    if (tokenError) {
      return tokenError;
    }

    const github = createGitHubClient(env);
    const file = await github.getFile(imageIdToMetaPath(imageId));
    const metadata = JSON.parse(decodeBase64Utf8(file.content)) as ImageMetadata;
    const deletedPaths = await github.deleteImageAssets(metadata);

    return jsonResponse(env, { image_id: imageId, deleted_paths: deletedPaths }, 200);
  } catch (error) {
    const mapped = mapGitHubErrorToHttp(env, error);
    if (mapped) return mapped;
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return errorResponse(env, "Image not found", 404);
    }
    return errorResponse(env, "Failed to delete image", 500);
  }
};

function isPrivacyInfo(value: unknown): value is ImageMetadata["privacy"] {
  if (!value || typeof value !== "object") return false;
  const casted = value as Record<string, unknown>;
  return (
    typeof casted.original_contains_gps === "boolean" &&
    typeof casted.exif_gps_removed === "boolean"
  );
}

function isGeoRegionPayload(value: unknown): value is NonNullable<ImageMetadata["geo"]> {
  if (!value || typeof value !== "object") return false;
  const casted = value as Record<string, unknown>;
  if (!casted.region || typeof casted.region !== "object") return false;
  const region = casted.region as Record<string, unknown>;
  return (
    typeof region.country === "string" &&
    typeof region.province === "string" &&
    typeof region.city === "string" &&
    typeof region.display_name === "string" &&
    typeof region.cache_key === "string" &&
    region.source === "nominatim" &&
    typeof region.resolved_at === "string"
  );
}

function isProcessingPayload(value: unknown): value is NonNullable<ImageMetadata["processing"]> {
  if (!value || typeof value !== "object") return false;
  const casted = value as Record<string, unknown>;
  if (!casted.summary || typeof casted.summary !== "object") return false;
  const summary = casted.summary as Record<string, unknown>;
  if (typeof summary.total_ms !== "number" || typeof summary.concurrency_profile !== "string") {
    return false;
  }
  if (!Array.isArray(summary.stage_durations)) {
    return false;
  }
  return summary.stage_durations.every((item) => {
    if (!item || typeof item !== "object") return false;
    const stage = item as Record<string, unknown>;
    return typeof stage.stage_id === "string" && typeof stage.duration_ms === "number";
  });
}
