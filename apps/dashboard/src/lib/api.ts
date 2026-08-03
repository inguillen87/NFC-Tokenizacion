async function mutateAdmin<T>(
  method: "PATCH" | "POST",
  path: string,
  payload: unknown,
  options: { headers?: HeadersInit } = {},
): Promise<T> {
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  const headers = new Headers(options.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`/api${normalized}`, {
    method,
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, raw: text };
    }
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  return data as T;
}

export async function postAdmin<T>(
  path: string,
  payload: unknown,
  options: { headers?: HeadersInit } = {},
): Promise<T> {
  return mutateAdmin<T>("POST", path, payload, options);
}

export async function patchAdmin<T>(
  path: string,
  payload: unknown,
  options: { headers?: HeadersInit } = {},
): Promise<T> {
  return mutateAdmin<T>("PATCH", path, payload, options);
}
