export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { consumeSunFreshHandoff } from "../../../../lib/sun-fresh-handoff";

const UID_RE = /^[0-9A-F]{8,32}$/;
const CURRENCIES = new Set(["ARS", "BRL", "EUR", "USD"]);

export async function POST(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: "marketplace",
    subjectId: `p2p-list:${consumer.id}`,
    globalPrincipal: true,
  });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 16 * 1024);
  } catch (error) {
    return json({ ok: false, error: error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json" }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  await ensureConsumerPortalSchema();

  const uidHex = String(body.uidHex || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  const price = Number(body.price || 0);
  const currency = String(body.currency || "USD").trim().toUpperCase();
  const description = String(body.description || "").trim().slice(0, 1000);
  const eventId = String(body.eventId || "").trim();
  const readCounter = Number(body.ctr);

  if (!UID_RE.test(uidHex)) return json({ ok: false, error: "invalid_uid_hex" }, 400);
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000 || Math.round(price * 100) !== price * 100) {
    return json({ ok: false, error: "invalid_price" }, 400);
  }
  if (!CURRENCIES.has(currency)) return json({ ok: false, error: "unsupported_currency" }, 400);
  if (!/^\d+$/.test(eventId) || !Number.isSafeInteger(readCounter) || readCounter < 0) {
    return json({ ok: false, error: "fresh_tap_evidence_required" }, 400);
  }

  const evidenceRows = await sql/*sql*/`
    SELECT ownership.id AS ownership_id, ownership.tenant_id, batch.bid, event.sdm_read_ctr,
           COALESCE(NULLIF(profile.product_name, ''), NULLIF(profile.sku, ''), 'Premium Asset') AS product_name,
           tag.id AS tag_id
    FROM consumer_product_ownerships ownership
    JOIN tags tag ON tag.id = ownership.tag_id
    JOIN batches batch ON batch.id = tag.batch_id AND batch.tenant_id = ownership.tenant_id
    JOIN events event ON event.id = ${eventId}::bigint
      AND event.tenant_id = ownership.tenant_id
      AND event.batch_id = batch.id
      AND UPPER(event.uid_hex) = UPPER(ownership.uid_hex)
      AND event.sdm_read_ctr = ${readCounter}
    LEFT JOIN tag_profiles profile ON profile.tag_id = tag.id
    WHERE ownership.consumer_id = ${consumer.id}
      AND UPPER(ownership.uid_hex) = ${uidHex}
      AND ownership.status = 'claimed'
    LIMIT 1
  `;
  const evidence = evidenceRows[0];
  if (!evidence) {
    return json({ ok: false, error: "not_the_owner_or_not_claimed" }, 403);
  }
  const capability = await consumeSunFreshHandoff(req, body, {
    bid: String(evidence.bid),
    eventId,
    uidHex,
    readCounter,
  }, "marketplace_p2p_list");
  if (!capability.ok) {
    return json({ ok: false, error: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403);
  }

  const title = `${String(evidence.product_name || "Premium Asset").slice(0, 160)} (Reventa de owner reclamado)`;
  const offerRows = await sql/*sql*/`
    INSERT INTO marketplace_offers (
      tenant_id,
      marketplace_product_id,
      title,
      description,
      status,
      type,
      starts_at,
      visibility,
      seller_consumer_id,
      resale_price,
      resale_currency,
      resale_uid_hex
    )
    SELECT
      ownership.tenant_id,
      NULL,
      ${title},
      ${description || null},
      'active',
      'p2p_resale',
      now(),
      'nexid_network',
      ${consumer.id},
      ${price},
      ${currency},
      ${uidHex}
    FROM consumer_product_ownerships ownership
    WHERE ownership.id = ${evidence.ownership_id}
      AND ownership.consumer_id = ${consumer.id}
      AND ownership.status = 'claimed'
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  if (!offerRows[0]) {
    const existing = (await sql/*sql*/`
      SELECT * FROM marketplace_offers
      WHERE tenant_id = ${evidence.tenant_id}
        AND seller_consumer_id = ${consumer.id}
        AND UPPER(resale_uid_hex) = ${uidHex}
        AND type = 'p2p_resale'
        AND status = 'active'
      LIMIT 1
    `)[0];
    if (existing) return json({ ok: true, deduplicated: true, offer: existing }, 200);
    return json({ ok: false, error: "listing_creation_conflict" }, 409);
  }

  return json({
    ok: true,
    deduplicated: false,
    offer: offerRows[0],
    evidence: { eventId, uidHex, ctr: readCounter, scope: "signed_fresh_tap_capability" },
  }, 201);
}
