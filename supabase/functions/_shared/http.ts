import { corsHeaders } from "./cors.ts";

export function withCors(resp: Response): Response {
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(resp.body, { status: resp.status, headers });
}


