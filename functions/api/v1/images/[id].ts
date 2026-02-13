import {
  Env,
  ImageMetadata,
  createGitHubClient,
  isValidImageId,
  imageIdToMetaPath,
  validateUploadToken,
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

      const content = atob(file.content);
      const metadata = JSON.parse(content) as ImageMetadata;

      return jsonResponse(env, metadata);
    } catch (error) {
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

      const body = await request.json();
      const { description, original_filename } = body as { description?: string; original_filename?: string };

      const github = createGitHubClient(env);
      const file = await github.getFile(imageIdToMetaPath(imageId));
      const metadata = JSON.parse(atob(file.content)) as ImageMetadata;

      if (description !== undefined) {
        metadata.description = description;
      }
      if (original_filename !== undefined) {
        metadata.original_filename = original_filename;
      }

      await github.updateImageMetadata(metadata);

      return jsonResponse(env, metadata);
    } catch (error) {
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
    const metadata = JSON.parse(atob(file.content)) as ImageMetadata;
    const deletedPaths = await github.deleteImageAssets(metadata);

    return jsonResponse(env, { image_id: imageId, deleted_paths: deletedPaths }, 200);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return errorResponse(env, "Image not found", 404);
    }
    return errorResponse(env, "Failed to delete image", 500);
  }
};
