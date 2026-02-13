import {
  Env,
  ImageMetadata,
  createGitHubClient,
  isValidImageId,
  imageIdToMetaPath,
  jsonResponse,
  errorResponse,
  corsHeaders,
} from "../../../_utils";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  if (request.method !== "GET") {
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

  try {
    const github = createGitHubClient(env);
    const file = await github.getFile(imageIdToMetaPath(imageId));

    const content = atob(file.content);
    const metadata = JSON.parse(content) as ImageMetadata;

    return jsonResponse(env, metadata);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return errorResponse(env, "Image not found", 404);
    }
    return errorResponse(env, "Failed to fetch metadata", 500);
  }
};
