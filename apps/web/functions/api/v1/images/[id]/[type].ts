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

const LEGACY_VARIANT_NAME_MAP: Record<"400" | "800" | "1600", string[]> = {
  "400": ["thumb-400.webp", "thumb_400.webp", "thumb_sm.webp"],
  "800": ["thumb-800.webp", "thumb_800.webp", "thumb_md.webp"],
  "1600": ["thumb-1600.webp", "thumb_1600.webp", "thumb_lg.webp"],
};

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
  const sizeParam = new URL(request.url).searchParams.get("size");

  if (!isValidImageId(imageId)) {
    return errorResponse(env, "Invalid image_id", 400);
  }

  if (type !== "original" && type !== "thumb") {
    return errorResponse(
      env,
      "Invalid type. Must be 'original' or 'thumb'",
      400,
    );
  }

  try {
    const signatureError = await validateSignedAssetAccess(
      request,
      env,
      imageId,
      type,
    );
    if (signatureError) {
      return signatureError;
    }

    const github = createGitHubClient(env);
    const metaFile = await github.getFile(imageIdToMetaPath(imageId));
    const metadata = JSON.parse(
      decodeBase64Utf8(metaFile.content),
    ) as ImageMetadata;
    const isVariantSize =
      sizeParam === "400" || sizeParam === "800" || sizeParam === "1600";
    const declaredPath =
      type === "original"
        ? metadata.files.original.path
        : isVariantSize
          ? metadata.files.thumb_variants?.[sizeParam]?.path ||
            metadata.files.thumb.path
          : metadata.files.thumb.path;
    let targetPath: string | undefined;

    if (declaredPath) {
      targetPath = declaredPath;
    } else {
      const hex = imageId.replace("sha256:", "");
      const p1 = hex.slice(0, 2);
      const p2 = hex.slice(2, 4);
      const dirPath = `objects/${p1}/${p2}/sha256_${hex}`;
      const files = await github.listDirectory(dirPath);
      const fallbackPath = files.find((f) =>
        type === "original"
          ? f.name.startsWith("original.")
          : isVariantSize
            ? LEGACY_VARIANT_NAME_MAP[sizeParam].includes(f.name)
            : f.name === "thumb.webp",
      )?.path;

      if (!fallbackPath) {
        return errorResponse(env, "Image not found", 404);
      }

      targetPath = fallbackPath;
    }

    if (!targetPath) {
      return errorResponse(env, "Image not found", 404);
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders(env),
        Location: buildJsDelivrUrl(env, targetPath),
        "Cache-Control": "public, max-age=31536000, immutable",
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
    return errorResponse(env, "Failed to fetch image", 500);
  }
};
