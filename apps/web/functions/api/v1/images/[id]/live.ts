import {
  Env,
  ImageMetadata,
  createGitHubClient,
  decodeBase64Utf8,
  isValidImageId,
  imageIdToMetaPath,
  buildJsDelivrUrl,
  errorResponse,
  mapGitHubErrorToHttp,
  corsHeaders,
  validateSignedAssetAccess,
} from "../../../../_utils";

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
    const signatureError = await validateSignedAssetAccess(
      request,
      env,
      imageId,
      "live",
    );
    if (signatureError) {
      return signatureError;
    }

    const github = createGitHubClient(env);
    const metaFile = await github.getFile(imageIdToMetaPath(imageId));
    const metadata = JSON.parse(
      decodeBase64Utf8(metaFile.content),
    ) as ImageMetadata;
    const livePath = metadata.files.live_video?.path;

    if (!livePath) {
      return errorResponse(env, "Live photo video not found", 404);
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders(env),
        Location: buildJsDelivrUrl(env, livePath),
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    const mapped = mapGitHubErrorToHttp(env, error);
    if (mapped) return mapped;
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("not found")
    ) {
      return errorResponse(env, "Live photo video not found", 404);
    }
    return errorResponse(env, "Failed to fetch live photo video", 500);
  }
};
