export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export async function postAdmin<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.NEXT_PUBLIC_ADMIN_API_KEY
        ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY}` }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data as T;
}
