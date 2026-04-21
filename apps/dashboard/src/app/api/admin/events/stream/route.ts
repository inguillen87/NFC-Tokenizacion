export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

function toEventPayload(raw: unknown) {
  if (Array.isArray(raw)) return { rows: raw };
  if (raw && typeof raw === "object" && Array.isArray((raw as { rows?: unknown[] }).rows)) return { rows: (raw as { rows: unknown[] }).rows };
  return { rows: [] as unknown[] };
}

async function fetchRows(search: URLSearchParams) {
  const upstream = new URL(`${API_BASE}/admin/events`);
  search.forEach((value, key) => upstream.searchParams.set(key, value));
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 4500);
  const response = await fetch(upstream.toString(), {
    headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
    cache: "no-store",
    signal: abort.signal,
  }).catch(() => null);
  clearTimeout(timeout);
  if (!response?.ok) return { rows: [] as unknown[] };
  const data = await response.json().catch(() => null);
  return toEventPayload(data);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        send("snapshot", await fetchRows(searchParams));
      } catch {
        send("snapshot", { rows: [] });
      }

      const interval = setInterval(async () => {
        try {
          send("snapshot", await fetchRows(searchParams));
        } catch {
          send("snapshot", { rows: [] });
        }
      }, 5000);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 15000);

      setTimeout(() => {
        clearInterval(interval);
        clearInterval(heartbeat);
        safeClose();
      }, 4 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
