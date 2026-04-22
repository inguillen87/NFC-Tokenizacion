export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

function fallbackStream(message: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: snapshot\ndata: {"rows":[]}\n\n'));
      controller.enqueue(encoder.encode(`event: warning\ndata: ${JSON.stringify({ reason: message })}\n\n`));
      const heartbeat = setInterval(() => {
        const now = Date.now();
        controller.enqueue(encoder.encode(`: ping ${now}\n\n`));
        controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ id: `hb-${now}`, ts: now })}\n\n`));
      }, 15000);
      setTimeout(() => {
        clearInterval(heartbeat);
        controller.close();
      }, 60 * 1000);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const upstream = new URL(`${API_BASE}/admin/events/stream`);
  incoming.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  const token = String(process.env.ADMIN_API_KEY || "").trim();
  if (!token) return fallbackStream("ADMIN_API_KEY missing in dashboard environment");

  const response = await fetch(upstream.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok || !response.body) {
    return fallbackStream(`upstream stream unavailable (${response?.status || 503})`);
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
