export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sessionCookieHeader, verifyConsumerAuth } from "../../../../lib/consumer-auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const contact = String(body.email || body.phone || "").trim();
  const code = String(body.code || "").trim();
  if (!contact || !code) return new Response(JSON.stringify({ ok: false, error: "contact_and_code_required" }), { status: 400 });

  const verified = await verifyConsumerAuth(contact, code, { userAgent: req.headers.get("user-agent"), ip: req.headers.get("x-forwarded-for") });
  if (!verified) return new Response(JSON.stringify({ ok: false, error: "invalid_code" }), { status: 401 });

  return new Response(JSON.stringify({ ok: true, consumer: verified.consumer }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookieHeader(verified.sessionToken),
    },
  });
}
