import type { Env } from "@lumina/contracts";

export function corsHeaders(env: Env): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Upload-Token",
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonResponse(env: Env, data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(env: Env, message: string, status: number = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json",
    },
  });
}

export function validateUploadToken(request: Request, env: Env): Response | null {
  const expectedToken = env.UPLOAD_TOKEN?.trim();
  if (!expectedToken) {
    return errorResponse(env, "Server upload token is not configured", 500);
  }

  const providedToken = request.headers.get("x-upload-token")?.trim();
  if (!providedToken) {
    return errorResponse(env, "Missing upload token", 401);
  }

  if (providedToken !== expectedToken) {
    return errorResponse(env, "Invalid upload token", 403);
  }

  return null;
}

export function mapGitHubErrorToHttp(env: Env, error: unknown): Response | null {
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
  if (message.includes("github get failed: 401") || message.includes("bad credentials")) {
    return errorResponse(env, "GitHub credentials are invalid. Check GITHUB_TOKEN.", 502);
  }
  return null;
}
