export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { sql } from "../../../../../lib/db";
import { canUseConsumerDemoBypass } from "../../../../../lib/consumer-demo-policy";
import { evaluateMarketplaceCheckoutAccess, parseRequestToBuyPayload } from "../../../../../lib/marketplace-policy";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../lib/bounded-request-body";
import {
  COMMERCIAL_ASSET_SCOPE_MIGRATION_REQUIRED,
  isCommercialAssetScopeSchemaError,
  requireCommercialAssetScopeSchema,
} from "../../../../../lib/commercial-asset-scope";

async function getOrCreateDemoConsumer(payload: Record<string, unknown>) {
  if (!canUseConsumerDemoBypass(payload)) return null;
  const email = String(payload.demoConsumerEmail || "demo.consumer@nexid.local").trim().toLowerCase();
  const rows = await sql/*sql*/`
    INSERT INTO consumers (email, phone, display_name, status, preferred_locale, last_login_at)
    VALUES (${email}, ${null}, 'Demo Consumer', 'registered', 'es-AR', now())
    ON CONFLICT (email)
    DO UPDATE SET last_login_at = now(), status = 'registered', updated_at = now()
    RETURNING *
  `;
  const consumer = rows[0] || null;
  if (consumer?.id) {
    await sql/*sql*/`
      INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
      VALUES (${consumer.id}, 'demo_consumer', ${email}, now())
      ON CONFLICT (provider, provider_subject)
      DO UPDATE SET verified_at = now(), updated_at = now()
    `;
  }
  return consumer;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: "marketplace",
    subjectId: "request-to-buy:unauthenticated",
  });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 24 * 1024);
  } catch (error) {
    return json({ ok: false, error: error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json" }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  const { id } = await params;
  try {
    await requireCommercialAssetScopeSchema();
  } catch (error) {
    if (isCommercialAssetScopeSchemaError(error)) {
      return json({ ok: false, error: COMMERCIAL_ASSET_SCOPE_MIGRATION_REQUIRED }, 503, {
        "cache-control": "no-store",
        "retry-after": "2",
      });
    }
    throw error;
  }
  const consumer = (await getConsumerFromRequest(req)) || (await getOrCreateDemoConsumer(body));
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);

  const parsed = parseRequestToBuyPayload(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);

  const product = await sql/*sql*/`
    SELECT
      p.id,
      p.tenant_id,
      p.status,
      p.title,
      p.request_to_buy_enabled,
      p.age_gate_required,
      mb.status AS brand_status,
      mb.visible_in_network,
      mb.display_name AS brand_name
    FROM marketplace_products p
    JOIN marketplace_brand_profiles mb ON mb.tenant_id = p.tenant_id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  if (!product[0]) return json({ ok: false, error: "product_not_found" }, 404);

  const record = product[0];
  if (String(record.status || "") !== "active") return json({ ok: false, error: "product_not_active" }, 409);
  if (String(record.brand_status || "") !== "active" || record.visible_in_network !== true) {
    return json({ ok: false, error: "brand_not_visible_in_network" }, 409);
  }
  if (!record.request_to_buy_enabled) return json({ ok: false, error: "request_to_buy_disabled" }, 409);
  if (record.age_gate_required && !parsed.value.ageGateAccepted) {
    return json({ ok: false, error: "age_gate_ack_required" }, 400);
  }

  const accessRows = await sql/*sql*/`
    SELECT
      EXISTS (
        SELECT 1
        FROM tenant_consumer_memberships m
        WHERE m.tenant_id = ${record.tenant_id}
          AND m.consumer_id = ${consumer.id}
          AND m.status = 'active'
      ) AS active_membership,
      EXISTS (
        SELECT 1
        FROM consumer_product_ownerships o
        WHERE o.tenant_id = ${record.tenant_id}
          AND o.consumer_id = ${consumer.id}
          AND o.status = 'claimed'
      ) AS claimed_ownership,
      (
        SELECT cth.tap_event_id
        FROM consumer_tap_history cth
        WHERE cth.tenant_id = ${record.tenant_id}
          AND cth.consumer_id = ${consumer.id}
          AND COALESCE(cth.risk_level, 'medium') IN ('low', 'medium')
          AND UPPER(COALESCE(cth.verdict, '')) NOT IN ('REPLAY_SUSPECT', 'DUPLICATE', 'INVALID', 'NOT_REGISTERED', 'NOT_ACTIVE', 'TAMPER', 'TAMPERED', 'REVOKED', 'BROKEN')
        ORDER BY cth.created_at DESC
        LIMIT 1
      ) AS latest_verified_tap_event_id
  `;
  const access = accessRows[0] || {};
  const demoOverride = canUseConsumerDemoBypass(body);
  const publicNetworkCheckout = String(process.env.MARKETPLACE_PUBLIC_REQUEST_TO_BUY || "").toLowerCase() === "true";
  const checkoutAccess = evaluateMarketplaceCheckoutAccess({
    activeMembership: access.active_membership === true,
    claimedOwnership: access.claimed_ownership === true,
    verifiedTap: Boolean(access.latest_verified_tap_event_id),
    demoOverride,
    publicNetworkCheckout,
  });
  if (!checkoutAccess.ok) {
    return json({
      ok: false,
      error: checkoutAccess.error,
      requirement: checkoutAccess.requirement,
      signals: {
        activeMembership: access.active_membership === true,
        claimedOwnership: access.claimed_ownership === true,
        verifiedTap: Boolean(access.latest_verified_tap_event_id),
      },
    }, 403);
  }

  const sourceRows = access.latest_verified_tap_event_id ? await sql/*sql*/`
    SELECT e.id AS event_id,
           e.created_at AS event_created_at,
           e.uid_hex,
           e.batch_id,
           b.bid,
           tag.id AS tag_id
    FROM events e
    JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
    JOIN tags tag ON tag.batch_id = e.batch_id AND UPPER(tag.uid_hex) = UPPER(e.uid_hex)
    WHERE e.id = ${access.latest_verified_tap_event_id}
      AND e.tenant_id = ${record.tenant_id}::uuid
    LIMIT 2
  ` : [];
  const source = sourceRows.length === 1 ? sourceRows[0] : {};
  const hasAttributionTuple = Boolean(
    source.event_id
      && source.event_created_at
      && source.tag_id
      && source.uid_hex
      && source.batch_id
      && source.bid,
  );
  if (access.latest_verified_tap_event_id && !hasAttributionTuple) {
    return json({ ok: false, error: "marketplace_source_attribution_mismatch" }, 409, {
      "cache-control": "no-store",
    });
  }

  const crmNotes = `Marketplace request: ${String(record.title || record.id)} | access=${checkoutAccess.mode} | attribution=${hasAttributionTuple ? "physical" : "generic"} | event=${String(hasAttributionTuple ? source.event_id : "n/a")} | uid=${String(hasAttributionTuple ? source.uid_hex : "n/a")} | bid=${String(hasAttributionTuple ? source.bid : "n/a")}${parsed.value.message ? ` | ${parsed.value.message}` : ""}`;
  const crmContact = consumer.email || consumer.phone || `consumer:${consumer.id}`;

  let rows;
  try {
    rows = hasAttributionTuple
      ? await sql/*sql*/`
          WITH created_request AS (
            INSERT INTO marketplace_order_requests (
              consumer_id,
              tenant_id,
              marketplace_product_id,
              quantity,
              consumer_message,
              contact_json,
              source_tap_event_id,
              source_tap_event_created_at,
              source_tag_id,
              source_uid_hex,
              source_batch_id,
              source_bid,
              source_context_json
            )
            VALUES (
              ${consumer.id},
              ${record.tenant_id},
              ${record.id},
              ${parsed.value.quantity},
              ${parsed.value.message},
              ${JSON.stringify({ email: consumer.email, phone: consumer.phone, access_mode: checkoutAccess.mode })}::jsonb,
              ${source.event_id}::bigint,
              ${source.event_created_at},
              ${source.tag_id},
              ${source.uid_hex},
              ${source.batch_id},
              ${source.bid},
              ${JSON.stringify({
                source: "post_tap_marketplace",
                attribution_mode: "attribution_only",
                event_id: source.event_id,
                event_created_at: source.event_created_at,
                tag_id: source.tag_id,
                uid_hex: source.uid_hex,
                batch_id: source.batch_id,
                bid: source.bid,
                access_mode: checkoutAccess.mode,
              })}::jsonb
            )
            ON CONFLICT DO NOTHING
            RETURNING *
          ), created_crm_request AS (
            INSERT INTO order_requests (tenant_id, locale, contact, company, tag_type, volume, notes, status, source)
            SELECT
              ${record.tenant_id},
              ${consumer.preferred_locale || "es-AR"},
              ${crmContact},
              ${record.brand_name || "Marketplace"},
              ${String(record.title || "Marketplace product")},
              ${parsed.value.quantity},
              ${crmNotes},
              'new',
              'marketplace'
            FROM created_request
            RETURNING id
          )
          SELECT created_request.*, true AS was_created,
                 (SELECT id FROM created_crm_request LIMIT 1) AS crm_request_id
          FROM created_request
        `
      : await sql/*sql*/`
          WITH created_request AS (
            INSERT INTO marketplace_order_requests (
              consumer_id,
              tenant_id,
              marketplace_product_id,
              quantity,
              consumer_message,
              contact_json,
              source_context_json
            )
            VALUES (
              ${consumer.id},
              ${record.tenant_id},
              ${record.id},
              ${parsed.value.quantity},
              ${parsed.value.message},
              ${JSON.stringify({ email: consumer.email, phone: consumer.phone, access_mode: checkoutAccess.mode })}::jsonb,
              ${JSON.stringify({
                source: "marketplace_catalog_request",
                attribution_mode: "generic",
                access_mode: checkoutAccess.mode,
              })}::jsonb
            )
            ON CONFLICT DO NOTHING
            RETURNING *
          ), created_crm_request AS (
            INSERT INTO order_requests (tenant_id, locale, contact, company, tag_type, volume, notes, status, source)
            SELECT
              ${record.tenant_id},
              ${consumer.preferred_locale || "es-AR"},
              ${crmContact},
              ${record.brand_name || "Marketplace"},
              ${String(record.title || "Marketplace product")},
              ${parsed.value.quantity},
              ${crmNotes},
              'new',
              'marketplace'
            FROM created_request
            RETURNING id
          )
          SELECT created_request.*, true AS was_created,
                 (SELECT id FROM created_crm_request LIMIT 1) AS crm_request_id
          FROM created_request
        `;
  } catch (error) {
    if (hasAttributionTuple && isCommercialAssetScopeSchemaError(error)) {
      return json({ ok: false, error: COMMERCIAL_ASSET_SCOPE_MIGRATION_REQUIRED }, 503, {
        "cache-control": "no-store",
        "retry-after": "2",
      });
    }
    throw error;
  }
  const created = rows[0]?.was_created === true;
  const selectedRequest = rows[0] || (await sql/*sql*/`
    SELECT *
    FROM marketplace_order_requests
    WHERE consumer_id = ${consumer.id}
      AND marketplace_product_id = ${record.id}
      AND status IN ('requested', 'new', 'pending', 'open')
    ORDER BY created_at DESC
    LIMIT 1
  `)[0];
  if (!selectedRequest) return json({ ok: false, error: "request_creation_conflict" }, 409);
  const { was_created: _wasCreated, crm_request_id: _crmRequestId, ...orderRequest } = selectedRequest;

  const persistedAttributionTuple = Boolean(
    orderRequest.source_tap_event_id
      && orderRequest.source_tap_event_created_at
      && orderRequest.source_tag_id
      && orderRequest.source_uid_hex
      && orderRequest.source_batch_id
      && orderRequest.source_bid,
  );

  return json({
    ok: true,
    deduplicated: !created,
    reason: created ? "request_created" : "active_marketplace_request_exists",
    orderRequest,
    checkout: "request_only",
    access: checkoutAccess.mode,
    loyalty: {
      pointsAwarded: 0,
      state: "not_awarded_for_unfulfilled_request",
      note: "Points can be credited only by a later fulfilled-order event.",
    },
    source: {
      attribution_mode: persistedAttributionTuple ? "attribution_only" : "generic",
      event_id: persistedAttributionTuple ? orderRequest.source_tap_event_id : null,
      event_created_at: persistedAttributionTuple ? orderRequest.source_tap_event_created_at : null,
      tag_id: persistedAttributionTuple ? orderRequest.source_tag_id : null,
      uid_hex: persistedAttributionTuple ? orderRequest.source_uid_hex : null,
      batch_id: persistedAttributionTuple ? orderRequest.source_batch_id : null,
      bid: persistedAttributionTuple ? orderRequest.source_bid : null,
    },
  });
}
