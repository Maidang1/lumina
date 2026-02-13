import { Env } from "./types";

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
