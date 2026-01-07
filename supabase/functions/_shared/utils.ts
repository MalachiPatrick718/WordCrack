export function json(resBody: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(resBody), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function getUtcDateString(d = new Date()): string {
  // YYYY-MM-DD in UTC
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function assertUpperAlpha(str: string, len: number) {
  if (!new RegExp(`^[A-Z]{${len}}$`).test(str)) {
    throw new Response(JSON.stringify({ error: "Invalid input" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}


