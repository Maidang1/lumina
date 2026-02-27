import {
  Env,
  ImageMetadata,
  createGitHubClient,
  decodeBase64Utf8,
  decodeImageListCursor,
  encodeImageListCursor,
  buildWeakEtagFromString,
  ifNoneMatchSatisfied,
  mapGitHubErrorToHttp,
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

  return errorResponse(env, "Method not allowed", 405);
};

async function handleListImages(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 100)
    : 20;
  const cursor = url.searchParams.get("cursor");
  const cursorData = cursor ? decodeImageListCursor(cursor) : null;
  if (cursor && !cursorData) {
    return errorResponse(env, "Invalid cursor", 400);
  }

  try {
    const respondWithEtag = async (
      payload: {
        images: ImageMetadata[];
        next_cursor?: string;
        total: number;
      },
      etagHint?: string,
    ): Promise<Response> => {
      const body = JSON.stringify(payload);
      const etag = etagHint || (await buildWeakEtagFromString(body));
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
      return new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders(env),
          "Content-Type": "application/json",
          ETag: etag,
          "Cache-Control": "public, max-age=300, must-revalidate",
        },
      });
    };

    const github = createGitHubClient(env);
    const { index, sha: indexSha } = await github.getImageIndexWithSha();
    if (!index) {
      return errorResponse(
        env,
        "Image index not found. Run migration to create objects/_index/images.json.",
        503,
      );
    }

    const filteredIndex = cursorData
      ? index.items.filter((item) => {
          const timeDiff =
            new Date(cursorData.created_at).getTime() -
            new Date(item.created_at).getTime();
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
        }),
      )
    ).filter((item): item is ImageMetadata => item !== null);

    const hasNextPage = filteredIndex.length > pageEntries.length;
    const nextCursor =
      hasNextPage && pageEntries.length > 0
        ? encodeImageListCursor({
            created_at: pageEntries[pageEntries.length - 1].created_at,
            image_id: pageEntries[pageEntries.length - 1].image_id,
          })
        : undefined;

    const pageEtag = indexSha
      ? `W/"idx:${indexSha}:${cursor || ""}:${limit}"`
      : undefined;

    return respondWithEtag(
      {
        images: pageMetas,
        next_cursor: nextCursor,
        total: index.items.length,
      },
      pageEtag,
    );
  } catch (error) {
    console.error("List error:", error);
    const mapped = mapGitHubErrorToHttp(env, error);
    if (mapped) return mapped;
    return errorResponse(env, "Failed to list images", 500);
  }
}
