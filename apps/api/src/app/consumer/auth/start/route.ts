export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { startConsumerAuth } from "../../../../lib/consumer-auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const contact = String(body.email || body.phone || "").trim();
  if (!contact) return json({ ok: false, error: "contact_required" }, 400);
  const challenge = await startConsumerAuth(contact, { ip: req.headers.get("x-forwarded-for") });
  if (!challenge.ok) return json({ ok: false, error: challenge.error }, 429);

  const demoMode = String(process.env.DEMO_MODE || "").toLowerCase() === "true";
  const mode = String(process.env.CONSUMER_AUTH_MODE || "demo").toLowerCase();
  const payload = { ok: true, contact, ttlMinutes: challenge.challengeTtlMinutes, mode } as Record<string, unknown>;
  if (demoMode || mode === "demo") payload.code = challenge.code;
  return json(payload);
}
