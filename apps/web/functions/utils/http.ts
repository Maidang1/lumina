import type { Env } from "@luminafe/contracts";

export function corsHeaders(env: Env): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonResponse(
  env: Env,
  data: unknown,
  status: number = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(
  env: Env,
  message: string,
  status: number = 400,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json",
    },
  });
}

export function mapGitHubErrorToHttp(
  env: Env,
  error: unknown,
): Response | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message.toLowerCase();
  if (message.includes("github_token is not configured")) {
    return errorResponse(env, "Server GITHUB_TOKEN is not configured", 500);
  }
  if (message.includes("gh_owner is not configured")) {
    return errorResponse(env, "Server GH_OWNER is not configured", 500);
  }
  if (message.includes("gh_repo is not configured")) {
    return errorResponse(env, "Server GH_REPO is not configured", 500);
  }
  if (message.includes("gh_branch is not configured")) {
    return errorResponse(env, "Server GH_BRANCH is not configured", 500);
  }
  if (
    message.includes("github get failed: 401") ||
    message.includes("bad credentials")
  ) {
    return errorResponse(
      env,
      "GitHub credentials are invalid. Check GITHUB_TOKEN.",
      502,
    );
  }
  return null;
}

export function buildJsDelivrUrl(env: Env, path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const encodedPath = normalizedPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const owner = encodeURIComponent(env.GH_OWNER);
  const repo = encodeURIComponent(env.GH_REPO);
  const branch = encodeURIComponent(env.GH_BRANCH);
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${encodedPath}`;
}

export async function buildWeakEtagFromString(
  content: string,
): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const bytes = new TextEncoder().encode(content);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest))
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `W/"${hash}"`;
  }

  let hash = 5381;
  for (let i = 0; i < content.length; i += 1) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  return `W/"${(hash >>> 0).toString(16)}"`;
}

export function ifNoneMatchSatisfied(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (!ifNoneMatch) {
    return false;
  }
  if (ifNoneMatch.trim() === "*") {
    return true;
  }

  const candidates = ifNoneMatch
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/^W\//, ""));
  const normalized = etag.replace(/^W\//, "");
  return candidates.includes(normalized);
}
