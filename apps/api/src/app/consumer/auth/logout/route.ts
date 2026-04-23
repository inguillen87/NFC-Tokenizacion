export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sessionCookieHeader } from "../../../../lib/consumer-auth";

export async function POST() {
  return new Response(JSON.stringify({ ok: true }, null, 2), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "set-cookie": sessionCookieHeader(null) },
  });
}
