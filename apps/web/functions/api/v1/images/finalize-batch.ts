import {
  BatchFinalizeRequest,
  BatchFinalizeResult,
  Env,
  ImageMetadata,
  createGitHubClient,
  isValidImageId,
  jsonResponse,
  errorResponse,
  corsHeaders,
  mapGitHubErrorToHttp,
  validateUploadToken,
} from "../../../_utils";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

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

  try {
    const body = (await request.json()) as Partial<BatchFinalizeRequest>;
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return errorResponse(env, "items is required", 400);
    }

    const metadatas: ImageMetadata[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object" || !("metadata" in item)) {
        return errorResponse(env, "Invalid item payload", 400);
      }
      const metadata = (item as { metadata: ImageMetadata }).metadata;
      if (!metadata || typeof metadata !== "object") {
        return errorResponse(env, "Invalid metadata payload", 400);
      }
      if (!metadata.image_id || !isValidImageId(metadata.image_id)) {
        return errorResponse(env, "Invalid image_id", 400);
      }
      metadatas.push(metadata);
    }

    const github = createGitHubClient(env);
    try {
      await github.finalizeImageMetadataBatch(metadatas);
      const result: BatchFinalizeResult = {
        success_count: metadatas.length,
        mode: "batch_commit",
      };
      return jsonResponse(env, result, 200);
    } catch (batchError) {
      console.error("Batch finalize failed, fallback to per item:", batchError);
      const failedItems: BatchFinalizeResult["failed_items"] = [];

      for (const metadata of metadatas) {
        try {
          await github.updateImageMetadataWithIndex(metadata);
        } catch (error) {
          failedItems?.push({
            image_id: metadata.image_id,
            reason: error instanceof Error ? error.message : "Finalize failed",
          });
        }
      }

      const successCount = metadatas.length - (failedItems?.length || 0);
      const result: BatchFinalizeResult = {
        success_count: successCount,
        mode: "fallback_per_item",
        ...(failedItems && failedItems.length > 0 ? { failed_items: failedItems } : {}),
      };
      return jsonResponse(env, result, failedItems && failedItems.length > 0 ? 207 : 200);
    }
  } catch (error) {
    const mapped = mapGitHubErrorToHttp(env, error);
    if (mapped) return mapped;
    return errorResponse(env, error instanceof Error ? error.message : "Finalize failed", 500);
  }
};
