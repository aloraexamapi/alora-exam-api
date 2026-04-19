const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function withCors(init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers);

  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return {
    ...init,
    headers,
  };
}

export function jsonWithCors(body: unknown, init?: ResponseInit) {
  return Response.json(body, withCors(init));
}

export function corsOptions() {
  return new Response(null, withCors({ status: 204 }));
}
