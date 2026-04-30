export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}
