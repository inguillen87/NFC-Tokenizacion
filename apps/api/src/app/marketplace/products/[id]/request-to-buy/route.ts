export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../lib/consumer-auth";
import { sql } from "../../../../../lib/db";
import { ensureConsumerPortalSchema, ensureOrderRequestsSchema } from "../../../../../lib/commercial-runtime-schema";
import { evaluateMarketplaceCheckoutAccess, parseRequestToBuyPayload } from "../../../../../lib/marketplace-policy";
import { awardPoints, getActiveProgram, getOrCreateMember } from "../../../../../lib/loyalty-service";

function demoConsumerEnabled(payload: Record<string, unknown>, productId: string) {
  const explicit = payload?.demoConsumer === true || payload?.consumerMode === "demo";
  const envDemo = String(process.env.DEMO_MODE || "").toLowerCase() === "true"
    || String(process.env.CONSUMER_AUTH_MODE || "").toLowerCase() === "demo";
  const demoProduct = productId.startsWith("demo-");
  return explicit && (envDemo || demoProduct);
}

async function getOrCreateDemoConsumer(payload: Record<string, unknown>, productId: string) {
  if (!demoConsumerEnabled(payload, productId)) return null;
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

async function awardRequestToBuyPoints(input: {
  tenantId: string;
  consumer: Record<string, unknown>;
  quantity: number;
  orderRequestId: string;
  sourceTapEventId?: string | null;
  productTitle?: string | null;
}) {
  const points = Math.max(0, Math.min(1000, Number(input.quantity || 1) * 180));
  if (!points) return null;

  const program = await getActiveProgram(input.tenantId);
  const consumerId = String(input.consumer.id || "");
  const consumerEmail = typeof input.consumer.email === "string" ? input.consumer.email : null;
  const consumerPhone = typeof input.consumer.phone === "string" ? input.consumer.phone : null;
  const locale = typeof input.consumer.preferred_locale === "string" ? input.consumer.preferred_locale : "es-AR";
  const displayName = typeof input.consumer.display_name === "string" ? input.consumer.display_name : null;

  const membershipRows = await sql/*sql*/`
    INSERT INTO tenant_consumer_memberships (tenant_id, consumer_id, loyalty_program_id, source, last_tap_event_id, status, points_balance, lifetime_points, metadata_json)
    VALUES (
      ${input.tenantId},
      ${consumerId},
      ${program?.id || null},
      'marketplace',
      ${input.sourceTapEventId || null},
      'active',
      ${points},
      ${points},
      ${JSON.stringify({ last_request_to_buy_id: input.orderRequestId, productTitle: input.productTitle || null })}::jsonb
    )
    ON CONFLICT (tenant_id, consumer_id)
    DO UPDATE SET
      loyalty_program_id = COALESCE(EXCLUDED.loyalty_program_id, tenant_consumer_memberships.loyalty_program_id),
      last_tap_event_id = COALESCE(EXCLUDED.last_tap_event_id, tenant_consumer_memberships.last_tap_event_id),
      last_activity_at = now(),
      points_balance = tenant_consumer_memberships.points_balance + EXCLUDED.points_balance,
      lifetime_points = tenant_consumer_memberships.lifetime_points + EXCLUDED.lifetime_points,
      metadata_json = COALESCE(tenant_consumer_memberships.metadata_json, '{}'::jsonb) || EXCLUDED.metadata_json,
      status = 'active',
      updated_at = now()
    RETURNING id, points_balance, lifetime_points
  `;

  await sql/*sql*/`
    INSERT INTO consumer_reward_wallets (consumer_id, tenant_id, network_scope, points_balance, lifetime_points)
    VALUES (${consumerId}, ${input.tenantId}, 'tenant', ${points}, ${points})
    ON CONFLICT (consumer_id, tenant_id, network_scope)
    DO UPDATE SET
      points_balance = consumer_reward_wallets.points_balance + EXCLUDED.points_balance,
      lifetime_points = consumer_reward_wallets.lifetime_points + EXCLUDED.lifetime_points,
      updated_at = now()
  `;

  let ledger: unknown = null;
  if (program?.id && input.sourceTapEventId) {
    const member = await getOrCreateMember({
      tenantId: input.tenantId,
      programId: program.id,
      eventId: input.sourceTapEventId,
      memberKey: `consumer:${consumerId}`,
      consumerId,
      locale,
      email: consumerEmail,
      phone: consumerPhone,
      displayName,
    });
    ledger = await awardPoints({
      tenantId: input.tenantId,
      programId: program.id,
      memberId: member.id,
      tapEventId: input.sourceTapEventId,
      delta: points,
      source: "ADMIN_ADJUSTMENT",
      idempotencyKey: `marketplace-request:${input.orderRequestId}:member:${member.id}`,
      reason: "Marketplace request-to-buy",
      metadata: { productTitle: input.productTitle || null, orderRequestId: input.orderRequestId },
    });
  }

  return {
    pointsAwarded: points,
    membership: membershipRows[0] || null,
    ledger,
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await Promise.all([ensureConsumerPortalSchema(), ensureOrderRequestsSchema()]);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { id } = await params;
  const consumer = (await getConsumerFromRequest(req)) || (await getOrCreateDemoConsumer(body, id));
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
  const demoOverride = demoConsumerEnabled(body, id);
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
    SELECT e.id AS event_id, e.uid_hex, e.batch_id, b.bid
    FROM events e
    LEFT JOIN batches b ON b.id = e.batch_id
    WHERE e.id = ${access.latest_verified_tap_event_id}
    LIMIT 1
  ` : [];
  const source = sourceRows[0] || {};

  const existingRows = await sql/*sql*/`
    SELECT *
    FROM marketplace_order_requests
    WHERE consumer_id = ${consumer.id}
      AND marketplace_product_id = ${record.id}
      AND status IN ('requested', 'new', 'pending', 'open')
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const existing = existingRows[0];
  if (existing) {
    return json({
      ok: true,
      deduplicated: true,
      reason: "active_marketplace_request_exists",
      orderRequest: existing,
      checkout: "request_only",
      access: checkoutAccess.mode,
      source: {
        event_id: existing.source_tap_event_id || null,
        uid_hex: existing.source_uid_hex || null,
        batch_id: existing.source_batch_id || null,
        bid: existing.source_bid || null,
      },
    });
  }

  const rows = await sql/*sql*/`
    INSERT INTO marketplace_order_requests (
      consumer_id,
      tenant_id,
      marketplace_product_id,
      quantity,
      consumer_message,
      contact_json,
      source_tap_event_id,
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
      ${source.event_id || access.latest_verified_tap_event_id || null},
      ${source.uid_hex || null},
      ${source.batch_id || null},
      ${source.bid || null},
      ${JSON.stringify({
        source: "post_tap_marketplace",
        event_id: source.event_id || access.latest_verified_tap_event_id || null,
        uid_hex: source.uid_hex || null,
        batch_id: source.batch_id || null,
        bid: source.bid || null,
        access_mode: checkoutAccess.mode,
      })}::jsonb
    )
    RETURNING *
  `;
  const orderRequest = rows[0];

  await sql/*sql*/`
    INSERT INTO order_requests (locale, contact, company, tag_type, volume, notes, status, source)
    VALUES (
      ${consumer.preferred_locale || "es-AR"},
      ${consumer.email || consumer.phone || `consumer:${consumer.id}`},
      ${record.brand_name || "Marketplace"},
      ${String(record.title || "Marketplace product")},
      ${parsed.value.quantity},
      ${`Marketplace request: ${String(record.title || record.id)} | access=${checkoutAccess.mode} | event=${String(source.event_id || access.latest_verified_tap_event_id || "n/a")} | uid=${String(source.uid_hex || "n/a")} | bid=${String(source.bid || "n/a")}${parsed.value.message ? ` | ${parsed.value.message}` : ""}`},
      'new',
      'marketplace'
    )
  `;

  const loyalty = await awardRequestToBuyPoints({
    tenantId: record.tenant_id,
    consumer,
    quantity: parsed.value.quantity,
    orderRequestId: String(orderRequest.id),
    sourceTapEventId: source.event_id || access.latest_verified_tap_event_id || null,
    productTitle: String(record.title || ""),
  });

  return json({
    ok: true,
    orderRequest,
    checkout: "request_only",
    access: checkoutAccess.mode,
    loyalty,
    source: {
      event_id: source.event_id || access.latest_verified_tap_event_id || null,
      uid_hex: source.uid_hex || null,
      batch_id: source.batch_id || null,
      bid: source.bid || null,
    },
  });
}
