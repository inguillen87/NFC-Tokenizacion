import { sql } from "./db";
import { claimTapPoints, getTapEvent } from "./loyalty-service";
import { evaluateOwnershipEligibility } from "./ownership-policy";
import { ensureConsumerPortalSchema } from "./commercial-runtime-schema";

export async function ensureTenantMembership(input: { consumerId: string; tenantId: string; tapEventId?: string; source?: string }) {
  await ensureConsumerPortalSchema();
  const programRows = await sql/*sql*/`SELECT id FROM loyalty_programs WHERE tenant_id = ${input.tenantId} AND status='active' ORDER BY created_at DESC LIMIT 1`;
  const loyaltyProgramId = programRows[0]?.id || null;
  const rows = await sql/*sql*/`
    INSERT INTO tenant_consumer_memberships (tenant_id, consumer_id, loyalty_program_id, source, first_tap_event_id, last_tap_event_id, status)
    VALUES (${input.tenantId}, ${input.consumerId}, ${loyaltyProgramId}, ${input.source || "tap"}, ${input.tapEventId || null}, ${input.tapEventId || null}, 'active')
    ON CONFLICT (tenant_id, consumer_id)
    DO UPDATE SET
      last_tap_event_id = COALESCE(EXCLUDED.last_tap_event_id, tenant_consumer_memberships.last_tap_event_id),
      last_activity_at = now(),
      status = 'active',
      updated_at = now()
    RETURNING *
  `;
  return rows[0];
}

export async function saveTapForConsumer(input: { consumerId: string; eventId: string }) {
  await ensureConsumerPortalSchema();
  const event = await getTapEvent(input.eventId);
  if (!event) return null;

  await ensureTenantMembership({ consumerId: input.consumerId, tenantId: event.tenant_id, tapEventId: String(event.id), source: "tap" });

  const normalizedResult = String(event.result || "").toUpperCase();
  const tapRiskLevel = normalizedResult.includes("REPLAY") || normalizedResult.includes("TAMPER") || normalizedResult.includes("INVALID")
    ? "high"
    : normalizedResult.includes("VALID") || normalizedResult === "OPENED"
      ? "low"
      : "medium";

  await sql/*sql*/`
    INSERT INTO consumer_tap_history (consumer_id, tenant_id, tap_event_id, verdict, risk_level, city, country)
    VALUES (
      ${input.consumerId},
      ${event.tenant_id},
      ${event.id},
      ${event.result || null},
      ${tapRiskLevel},
      ${event.city || null},
      ${event.country_code || null}
    )
    ON CONFLICT (consumer_id, tap_event_id) DO NOTHING
  `;

  const tagRows = await sql/*sql*/`
    SELECT
      t.id,
      b.bid,
      tp.product_name,
      tp.sku,
      tp.winery,
      tp.region,
      tp.grape_varietal
    FROM events e
    JOIN tags t ON t.uid_hex = e.uid_hex
    JOIN batches b ON b.id = t.batch_id
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    WHERE e.id = ${event.id}
      AND b.tenant_id = ${event.tenant_id}
    ORDER BY t.created_at ASC
    LIMIT 1
  `;
  const tagProfile = tagRows[0];
  const productName = String(tagProfile?.product_name || tagProfile?.sku || "").trim()
    || (String(tagProfile?.grape_varietal || "").trim() && String(tagProfile?.region || "").trim()
      ? `${String(tagProfile.grape_varietal).trim()} - ${String(tagProfile.region).trim()}`
      : "")
    || `Producto ${event.uid_hex || "NFC"}`;
  const brandName = String(tagProfile?.winery || event.tenant_slug || "Tenant").trim();

  const existingProduct = (await sql/*sql*/`
    SELECT id
    FROM consumer_products
    WHERE consumer_id = ${input.consumerId}
      AND tenant_id = ${event.tenant_id}
      AND (
        product_passport_id = ${event.uid_hex || null}
        OR (${tagProfile?.id || null}::uuid IS NOT NULL AND tag_id = ${tagProfile?.id || null})
      )
    ORDER BY updated_at DESC
    LIMIT 1
  `)[0];

  if (existingProduct?.id) {
    await sql/*sql*/`
      UPDATE consumer_products
      SET latest_tap_event_id = ${event.id},
          tag_id = COALESCE(${tagProfile?.id || null}, tag_id),
          product_name = COALESCE(NULLIF(${productName}, ''), product_name),
          brand_name = COALESCE(NULLIF(${brandName}, ''), brand_name),
          updated_at = now()
      WHERE id = ${existingProduct.id}
    `;
    return event;
  }

  await sql/*sql*/`
    INSERT INTO consumer_products (consumer_id, tenant_id, product_passport_id, tag_id, first_tap_event_id, latest_tap_event_id, ownership_status, collection_type, product_name, brand_name)
    VALUES (
      ${input.consumerId},
      ${event.tenant_id},
      ${event.uid_hex || null},
      ${tagProfile?.id || null},
      ${event.id},
      ${event.id},
      'viewed',
      'wine',
      ${productName},
      ${brandName}
    )
    ON CONFLICT DO NOTHING
  `;

  return event;
}

type ClaimOwnershipInput = {
  consumerId: string;
  eventId: string;
  bid?: string | null;
  uidHex?: string | null;
  source?: "sun_passport" | "marketplace" | "admin";
  trustSnapshot?: Record<string, unknown>;
};

export async function claimOwnershipForConsumer(input: ClaimOwnershipInput) {
  await ensureConsumerPortalSchema();
  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false as const, status: 404, error: "event_not_found" as const };
  if (!event.tenant_id || !event.uid_hex) return { ok: false as const, status: 400, error: "event_missing_identity" as const };
  if (input.uidHex && String(input.uidHex).toUpperCase() !== String(event.uid_hex).toUpperCase()) {
    return { ok: false as const, status: 403, error: "uid_mismatch" as const };
  }

  const tagRows = await sql/*sql*/`
    SELECT t.id, t.status, b.id AS batch_id, b.bid
    FROM tags t
    JOIN batches b ON b.id = t.batch_id
    WHERE b.tenant_id = ${event.tenant_id}
      AND t.uid_hex = ${event.uid_hex}
    ORDER BY t.created_at ASC
    LIMIT 1
  `;
  const tag = tagRows[0];
  if (!tag) return { ok: false as const, status: 404, error: "tag_not_found" as const };
  if (input.bid && String(input.bid).trim() !== String(tag.bid || "").trim()) {
    return { ok: false as const, status: 403, error: "tenant_batch_mismatch" as const };
  }
  const result = String(event.result || "").toUpperCase();
  const { isBlocked, nextStatus } = evaluateOwnershipEligibility({ result, tagStatus: tag.status || null });

  await ensureTenantMembership({ consumerId: input.consumerId, tenantId: event.tenant_id, tapEventId: String(event.id), source: "tap" });
  await saveTapForConsumer({ consumerId: input.consumerId, eventId: String(event.id) });

  const trustSnapshot = {
    result,
    reason: event.reason || null,
    city: event.city || null,
    country: event.country_code || null,
    tag_status: tag.status || null,
    blocked: isBlocked,
    ...(input.trustSnapshot || {}),
  };

  const ownershipRows = await sql/*sql*/`
    INSERT INTO consumer_product_ownerships (
      tenant_id, consumer_id, batch_id, tag_id, uid_hex, event_id, status, source, trust_snapshot
    ) VALUES (
      ${event.tenant_id}, ${input.consumerId}, ${tag.batch_id}, ${tag.id || null}, ${String(event.uid_hex).toUpperCase()}, ${event.id}, ${nextStatus}, ${input.source || "sun_passport"}, ${JSON.stringify(trustSnapshot)}::jsonb
    )
    ON CONFLICT (consumer_id, event_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      trust_snapshot = EXCLUDED.trust_snapshot,
      updated_at = now()
    RETURNING *
  `;
  const ownership = ownershipRows[0];

  await sql/*sql*/`
    UPDATE consumer_products
    SET ownership_status = ${nextStatus},
        latest_tap_event_id = ${event.id},
        updated_at = now()
    WHERE consumer_id = ${input.consumerId}
      AND tenant_id = ${event.tenant_id}
      AND (
        product_passport_id = ${String(event.uid_hex).toUpperCase()}
        OR tag_id = ${tag.id || null}
      )
  `;

  if (isBlocked) {
    return { ok: false as const, status: 409, error: nextStatus === "blocked_replay" ? "blocked_replay" as const : "revoked" as const, ownership };
  }

  return { ok: true as const, status: 200, ownership };
}

export async function claimPointsForConsumer(input: { consumerId: string; eventId: string; locale?: string }) {
  await ensureConsumerPortalSchema();
  const event = await saveTapForConsumer(input);
  if (!event) return { ok: false, error: "event_not_found" };
  const claim = await claimTapPoints({ eventId: input.eventId, locale: input.locale || "es-AR" });

  const membership = await ensureTenantMembership({ consumerId: input.consumerId, tenantId: event.tenant_id, tapEventId: String(event.id), source: "tap" });
  if (claim.ok && claim.awarded && claim.points) {
    await sql/*sql*/`
      UPDATE tenant_consumer_memberships
      SET points_balance = points_balance + ${claim.points},
          lifetime_points = lifetime_points + ${claim.points},
          updated_at = now()
      WHERE id = ${membership.id}
    `;
  }

  return { ...claim, membershipId: membership.id };
}
