import {
  Env,
  ImageMetadata,
  UploadResult,
  createGitHubClient,
  isValidImageId,
  buildImageApiUrls,
  decodeBase64Utf8,
  decodeImageListCursor,
  encodeImageListCursor,
  validateUploadToken,
  mapGitHubErrorToHttp,
  jsonResponse,
  errorResponse,
  corsHeaders,
} from "../../../_utils";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  if (request.method === "GET") {
    return handleListImages(request, env);
  }

  if (request.method === "POST") {
    return handleUpload(request, env);
  }

  return errorResponse(env, "Method not allowed", 405);
};

async function handleUpload(request: Request, env: Env): Promise<Response> {
  try {
    const tokenError = validateUploadToken(request, env);
    if (tokenError) {
      return tokenError;
    }

    const formData = await request.formData();
    const original = formData.get("original");
    const thumb = formData.get("thumb");
    const liveVideo = formData.get("live_video");
    const metadataStr = formData.get("metadata");
    const uploadModeValue = formData.get("upload_mode");
    const deferFinalizeValue = formData.get("defer_finalize");
    const uploadMode = uploadModeValue === "live_photo" ? "live_photo" : "static";
    const deferFinalize = deferFinalizeValue === "true";

    if (!original || !(original instanceof File)) {
      return errorResponse(env, "Missing original file", 400);
    }

    if (!thumb || !(thumb instanceof Blob)) {
      return errorResponse(env, "Missing thumbnail", 400);
    }

    if (!metadataStr || typeof metadataStr !== "string") {
      return errorResponse(env, "Missing metadata", 400);
    }

    let metadata: ImageMetadata;
    try {
      metadata = JSON.parse(metadataStr);
    } catch {
      return errorResponse(env, "Invalid metadata JSON", 400);
    }

    if (!metadata.image_id || !isValidImageId(metadata.image_id)) {
      return errorResponse(env, "Invalid image_id", 400);
    }

    const MAX_SIZE = 25 * 1024 * 1024;
    const MAX_LIVE_VIDEO_SIZE = 10 * 1024 * 1024;
    if (original.size > MAX_SIZE) {
      return errorResponse(env, "File too large", 413);
    }

    if (uploadMode === "live_photo") {
      if (!liveVideo || !(liveVideo instanceof File)) {
        return errorResponse(env, "Missing live video file for live photo upload", 400);
      }
      const isMovType =
        liveVideo.type === "video/quicktime" ||
        liveVideo.name.toLowerCase().endsWith(".mov");
      if (!isMovType) {
        return errorResponse(env, "Invalid live video type. Must be MOV", 400);
      }
      if (liveVideo.size > MAX_LIVE_VIDEO_SIZE) {
        return errorResponse(env, "Live video file too large", 413);
      }
      if (!metadata.files.live_video) {
        metadata.files.live_video = {
          path: "",
          mime: liveVideo.type || "video/quicktime",
          bytes: liveVideo.size,
        };
      }
    }

    const github = createGitHubClient(env);

    const originalBytes = new Uint8Array(await original.arrayBuffer());
    const thumbBytes = new Uint8Array(await thumb.arrayBuffer());
    const liveVideoBytes =
      uploadMode === "live_photo" && liveVideo instanceof File
        ? new Uint8Array(await liveVideo.arrayBuffer())
        : undefined;

    const { originalPath, thumbPath, liveVideoPath, metaPath } = await github.uploadImage(
      originalBytes,
      original.type,
      thumbBytes,
      metadata,
      liveVideoBytes && liveVideo instanceof File
        ? { bytes: liveVideoBytes, mime: liveVideo.type || "video/quicktime" }
        : undefined,
      { deferFinalize }
    );

    const result: UploadResult = {
      image_id: metadata.image_id,
      stored: {
        original_path: originalPath,
        thumb_path: thumbPath,
        live_video_path: liveVideoPath,
        meta_path: metaPath,
      },
      urls: buildImageApiUrls(metadata.image_id),
    };

    return jsonResponse(env, result, 201);
  } catch (error) {
    console.error("Upload error:", error);
    const mapped = mapGitHubErrorToHttp(env, error);
    if (mapped) return mapped;
    return errorResponse(env, error instanceof Error ? error.message : "Upload failed", 500);
  }
}

async function handleListImages(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
  const cursor = url.searchParams.get("cursor");
  const cursorData = cursor ? decodeImageListCursor(cursor) : null;
  if (cursor && !cursorData) {
    return errorResponse(env, "Invalid cursor", 400);
  }

  try {
    const github = createGitHubClient(env);
    const index = await github.getImageIndex();
    if (index && index.items.length > 0) {
      const filteredIndex = cursorData
        ? index.items.filter((item) => {
            const timeDiff =
              new Date(cursorData.created_at).getTime() - new Date(item.created_at).getTime();
            if (timeDiff !== 0) {
              return timeDiff > 0;
            }
            return cursorData.image_id.localeCompare(item.image_id) > 0;
          })
        : index.items;

      const pageEntries = filteredIndex.slice(0, limit);
      const pageMetas = (
        await Promise.all(
          pageEntries.map(async (entry) => {
            try {
              const metaResponse = await github.getFile(entry.meta_path);
              const content = decodeBase64Utf8(metaResponse.content);
              return JSON.parse(content) as ImageMetadata;
            } catch {
              return null;
            }
          })
        )
      ).filter((item): item is ImageMetadata => item !== null);

      const nextCursor =
        filteredIndex.length > limit
          ? encodeImageListCursor({
              created_at: pageEntries[pageEntries.length - 1].created_at,
              image_id: pageEntries[pageEntries.length - 1].image_id,
            })
          : undefined;

      return jsonResponse(env, {
        images: pageMetas,
        next_cursor: nextCursor,
        total: index.items.length,
      });
    }

    const p1Dirs = await github.listDirectory("objects");
    const allImages: { image_id: string; meta: ImageMetadata }[] = [];
    const scanCap = Math.max(limit * 3, 100);

    for (const p1Dir of p1Dirs) {
      if (p1Dir.type !== "dir") continue;
      const p2Dirs = await github.listDirectory(p1Dir.path);

      for (const p2Dir of p2Dirs) {
        if (p2Dir.type !== "dir") continue;
        const imageDirs = await github.listDirectory(p2Dir.path);

        for (const imageDir of imageDirs) {
          if (imageDir.type !== "dir") continue;
          const files = await github.listDirectory(imageDir.path);
          const metaFile = files.find((f) => f.name === "meta.json");

          if (metaFile) {
            try {
              const metaResponse = await github.getFile(metaFile.path);
              const content = decodeBase64Utf8(metaResponse.content);
              const meta = JSON.parse(content) as ImageMetadata;
              allImages.push({ image_id: meta.image_id, meta: meta });
            } catch {
              // skip
            }
          }
          if (allImages.length >= scanCap) break;
        }
        if (allImages.length >= scanCap) break;
      }
      if (allImages.length >= scanCap) break;
    }

    const sorted = allImages
      .sort((a, b) => {
        const timeDiff =
          new Date(b.meta.timestamps.created_at).getTime() -
          new Date(a.meta.timestamps.created_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.image_id.localeCompare(a.image_id);
      })
      .map((item) => item.meta);

    const filtered = cursorData
      ? sorted.filter((meta) => {
          const timeDiff =
            new Date(cursorData.created_at).getTime() -
            new Date(meta.timestamps.created_at).getTime();
          if (timeDiff !== 0) {
            return timeDiff > 0;
          }
          return cursorData.image_id.localeCompare(meta.image_id) > 0;
        })
      : sorted;

    const page = filtered.slice(0, limit);
    const nextCursor =
      filtered.length > limit
        ? encodeImageListCursor({
            created_at: page[page.length - 1].timestamps.created_at,
            image_id: page[page.length - 1].image_id,
          })
        : undefined;

    return jsonResponse(env, {
      images: page,
      next_cursor: nextCursor,
      total: sorted.length,
    });
  } catch (error) {
    console.error("List error:", error);
    const mapped = mapGitHubErrorToHttp(env, error);
    if (mapped) return mapped;
    return errorResponse(env, "Failed to list images", 500);
  }
}
