import {
  Env,
  ImageMetadata,
  createGitHubClient,
  decodeBase64Utf8,
  isValidImageId,
  imageIdToMetaPath,
  mapGitHubErrorToHttp,
  ifNoneMatchSatisfied,
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
    const etag = `W/"${file.sha}"`;

    const content = decodeBase64Utf8(file.content);
    const metadata = JSON.parse(content) as ImageMetadata;

    if (ifNoneMatchSatisfied(request, etag)) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders(env),
          ETag: etag,
          "Cache-Control": "public, max-age=300, must-revalidate",
        },
      });
    }

    return new Response(JSON.stringify(metadata), {
      status: 200,
      headers: {
        ...corsHeaders(env),
        "Content-Type": "application/json",
        ETag: etag,
        "Cache-Control": "public, max-age=300, must-revalidate",
      },
    });
  } catch (error) {
    const mapped = mapGitHubErrorToHttp(env, error);
    if (mapped) return mapped;
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("not found")
    ) {
      return errorResponse(env, "Image not found", 404);
    }
    return errorResponse(env, "Failed to fetch metadata", 500);
  }
};
