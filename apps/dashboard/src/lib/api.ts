export async function postAdmin<T>(path: string, payload: unknown): Promise<T> {
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  const response = await fetch(`/api${normalized}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
