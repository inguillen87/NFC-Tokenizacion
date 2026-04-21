export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const upstream = new URL(`${API_BASE}/admin/events/stream`);
  incoming.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  const response = await fetch(upstream.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}`,
      Accept: "text/event-stream",
    },
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok || !response.body) {
    return new Response("event: snapshot\ndata: {\"rows\":[]}\n\n", {
      status: 503,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
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
