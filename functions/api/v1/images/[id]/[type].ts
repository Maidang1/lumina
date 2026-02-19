import {
  Env,
  ImageMetadata,
  createGitHubClient,
  decodeBase64Utf8,
  isValidImageId,
  imageIdToMetaPath,
  errorResponse,
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
  const type = params.type as string;

  if (!isValidImageId(imageId)) {
    return errorResponse(env, "Invalid image_id", 400);
  }

  if (type !== "original" && type !== "thumb") {
    return errorResponse(env, "Invalid type. Must be 'original' or 'thumb'", 400);
  }

  try {
    const signatureError = await validateSignedAssetAccess(request, env, imageId, type);
    if (signatureError) {
      return signatureError;
    }

    const github = createGitHubClient(env);
    const metaFile = await github.getFile(imageIdToMetaPath(imageId));
    const metadata = JSON.parse(decodeBase64Utf8(metaFile.content)) as ImageMetadata;
    const declaredPath = type === "original" ? metadata.files.original.path : metadata.files.thumb.path;
    let targetFile;

    if (declaredPath) {
      targetFile = await github.getFile(declaredPath);
    } else {
      const hex = imageId.replace("sha256:", "");
      const p1 = hex.slice(0, 2);
      const p2 = hex.slice(2, 4);
      const dirPath = `objects/${p1}/${p2}/sha256_${hex}`;
      const files = await github.listDirectory(dirPath);
      const fallbackPath = files.find((f) =>
        type === "original" ? f.name.startsWith("original.") : f.name === "thumb.webp"
      )?.path;

      if (!fallbackPath) {
        return errorResponse(env, "Image not found", 404);
      }

      targetFile = await github.getFile(fallbackPath);
    }

    if (!targetFile.download_url) {
      return errorResponse(env, "Image not found", 404);
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders(env),
        Location: targetFile.download_url,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return errorResponse(env, "Image not found", 404);
    }
    return errorResponse(env, "Failed to fetch image", 500);
  }
};
