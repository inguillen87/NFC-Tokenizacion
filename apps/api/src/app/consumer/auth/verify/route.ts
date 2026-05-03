export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sessionCookieHeader, verifyConsumerAuth } from "../../../../lib/consumer-auth";
import { sql } from "../../../../lib/db";
import { ensureTenantMembership } from "../../../../lib/consumer-portal-service";
import { ensureConsumerAuthSchema } from "../../../../lib/commercial-runtime-schema";
import { randomBytes, createHash } from "node:crypto";

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const contact = String(body.email || body.phone || "").trim();
  const code = String(body.code || "").trim();
  if (!contact || !code) return new Response(JSON.stringify({ ok: false, error: "contact_and_code_required" }), { status: 400 });

  const normalized = contact.toLowerCase();
  const demoMode = String(process.env.DEMO_MODE || "").toLowerCase() === "true";
  if (demoMode && normalized === "demo.consumer@nexid.local" && code === "000000") {
    await ensureConsumerAuthSchema();
    const consumerRows = await sql/*sql*/`
      INSERT INTO consumers (email, phone, display_name, status, preferred_locale, last_login_at)
      VALUES (${normalized}, ${null}, ${"Demo Consumer"}, 'registered', 'es-AR', now())
      ON CONFLICT (email)
      DO UPDATE SET last_login_at = now(), status = 'registered', display_name = COALESCE(consumers.display_name, EXCLUDED.display_name)
      RETURNING *
    `;
    const consumer = consumerRows[0];
    await sql/*sql*/`
      INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
      VALUES (${consumer.id}, ${"email_magic_link"}, ${normalized}, now())
      ON CONFLICT (provider, provider_subject)
      DO UPDATE SET verified_at = now(), updated_at = now()
    `;
    const tenantRows = await sql/*sql*/`SELECT id FROM tenants WHERE slug = ${"demobodega"} LIMIT 1`;
    if (tenantRows[0]?.id) {
      await ensureTenantMembership({ consumerId: consumer.id, tenantId: tenantRows[0].id, source: "demo_login" });
    }
    const sessionToken = randomBytes(24).toString("hex");
    await sql/*sql*/`
      INSERT INTO consumer_sessions (consumer_id, session_token_hash, expires_at, user_agent_hash, ip_hash)
      VALUES (
        ${consumer.id},
        ${sha(sessionToken)},
        now() + interval '30 days',
        ${req.headers.get("user-agent") ? sha(String(req.headers.get("user-agent"))) : null},
        ${req.headers.get("x-forwarded-for") ? sha(String(req.headers.get("x-forwarded-for"))) : null}
      )
    `;
    return new Response(JSON.stringify({ ok: true, consumer, demo: true }, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": sessionCookieHeader(sessionToken),
      },
    });
  }

  const verified = await verifyConsumerAuth(contact, code, { userAgent: req.headers.get("user-agent"), ip: req.headers.get("x-forwarded-for") });
  if (!verified.ok) {
    const status = verified.error === "rate_limited" ? 429 : verified.error === "locked" ? 423 : verified.error === "expired" ? 410 : verified.error === "unavailable" ? 503 : 401;
    return new Response(JSON.stringify({ ok: false, error: verified.error }), { status });
  }

  return new Response(JSON.stringify({ ok: true, consumer: verified.consumer }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookieHeader(verified.sessionToken),
    },
  });
}
