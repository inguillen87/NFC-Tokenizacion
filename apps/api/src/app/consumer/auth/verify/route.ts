export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH_RATE_LIMIT_RETRY_AFTER_SECONDS = 10 * 60;

import { sessionCookieHeader, verifyConsumerAuth, verifyConsumerAuthToken } from "../../../../lib/consumer-auth";
import { sql } from "../../../../lib/db";
import { ensureTenantMembership } from "../../../../lib/consumer-portal-service";
import { ensureConsumerAuthSchema } from "../../../../lib/commercial-runtime-schema";
import { parseConsumerContact } from "../../../../lib/consumer-contact";
import { canUseConsumerDemoBypass } from "../../../../lib/consumer-demo-policy";
import { randomBytes, createHash } from "node:crypto";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function authErrorResponse(error: string) {
  const status = error === "rate_limited" ? 429 : error === "locked" ? 423 : error === "expired" ? 410 : error === "unavailable" ? 503 : 401;
  const headers: Record<string, string> = {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  };
  if (status === 429) headers["retry-after"] = String(AUTH_RATE_LIMIT_RETRY_AFTER_SECONDS);
  if (status === 503) headers["retry-after"] = "30";
  return new Response(JSON.stringify({ ok: false, error }), { status, headers });
}

export async function POST(req: Request) {
  const sourceLimited = await enforceCriticalRateLimit(req, { rateClass: "auth", tenantId: "platform", subjectId: "consumer-auth-verify:unauthenticated" });
  if (sourceLimited) return sourceLimited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 4 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return new Response(JSON.stringify({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }), { status: tooLarge ? 413 : 400, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }
  const requestMeta = getRequestMeta(req);
  const magicToken = String(body.token || body.t || body.magicToken || "").trim();
  if (magicToken) {
    const verified = await verifyConsumerAuthToken(magicToken, { userAgent: requestMeta.userAgent, ip: requestMeta.ip });
    if (!verified.ok) return authErrorResponse(verified.error);
    return new Response(JSON.stringify({ ok: true, consumer: verified.consumer }, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": sessionCookieHeader(verified.sessionToken),
      },
    });
  }

  const parsedContact = parseConsumerContact(body);
  const code = String(body.code || "").trim();
  if (!parsedContact.ok) {
    return new Response(JSON.stringify({ ok: false, error: parsedContact.error }), { status: parsedContact.error === "contact_required" ? 400 : 422 });
  }
  const contact = parsedContact.contact;
  if (!code) return new Response(JSON.stringify({ ok: false, error: "contact_and_code_required" }), { status: 400 });

  const normalized = contact.toLowerCase();
  const demoBypassAllowed =
    canUseConsumerDemoBypass(body) &&
    (normalized === "demo.consumer@nexid.local" || normalized.endsWith(".consumer@nexid.local")) &&
    code === "000000";

  if (demoBypassAllowed) {
    await ensureConsumerAuthSchema();
    const displayName = body.displayName || (normalized.includes("google") ? "Google User" : normalized.includes("facebook") ? "Facebook User" : "Demo Consumer");

    const consumerRows = await sql/*sql*/`
      INSERT INTO consumers (email, phone, display_name, status, preferred_locale, last_login_at)
      VALUES (${normalized}, ${null}, ${displayName}, 'registered', 'es-AR', now())
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
        ${requestMeta.userAgent ? sha(requestMeta.userAgent) : null},
        ${requestMeta.ip ? sha(requestMeta.ip) : null}
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

  const verified = await verifyConsumerAuth(contact, code, { userAgent: requestMeta.userAgent, ip: requestMeta.ip });
  if (!verified.ok) return authErrorResponse(verified.error);

  return new Response(JSON.stringify({ ok: true, consumer: verified.consumer }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookieHeader(verified.sessionToken),
    },
  });
}
