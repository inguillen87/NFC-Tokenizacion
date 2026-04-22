export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { startConsumerAuth } from "../../../../lib/consumer-auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const contact = String(body.email || body.phone || "").trim();
  if (!contact) return json({ ok: false, error: "contact_required" }, 400);
  const challenge = await startConsumerAuth(contact);
  return json({ ok: true, contact, code: challenge.code, ttlMinutes: challenge.challengeTtlMinutes, mode: "demo" });
}
