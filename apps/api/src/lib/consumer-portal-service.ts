import { sql } from "./db";
import { claimTapPoints, getTapEvent } from "./loyalty-service";

export async function ensureTenantMembership(input: { consumerId: string; tenantId: string; tapEventId?: string; source?: string }) {
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
  const event = await getTapEvent(input.eventId);
  if (!event) return null;

  await ensureTenantMembership({ consumerId: input.consumerId, tenantId: event.tenant_id, tapEventId: String(event.id), source: "tap" });

  await sql/*sql*/`
    INSERT INTO consumer_tap_history (consumer_id, tenant_id, tap_event_id, verdict, risk_level, city, country)
    VALUES (
      ${input.consumerId},
      ${event.tenant_id},
      ${event.id},
      ${event.result || null},
      ${event.result === "VALID" ? "low" : "high"},
      ${event.city || null},
      ${event.country_code || null}
    )
    ON CONFLICT (consumer_id, tap_event_id) DO NOTHING
  `;

  const tagRows = await sql/*sql*/`
    SELECT t.id, b.bid
    FROM events e
    JOIN tags t ON t.uid_hex = e.uid_hex
    JOIN batches b ON b.id = t.batch_id
    WHERE e.id = ${event.id}
      AND b.tenant_id = ${event.tenant_id}
    ORDER BY t.created_at ASC
    LIMIT 1
  `;

  await sql/*sql*/`
    INSERT INTO consumer_products (consumer_id, tenant_id, product_passport_id, tag_id, first_tap_event_id, latest_tap_event_id, ownership_status, collection_type, product_name, brand_name)
    VALUES (
      ${input.consumerId},
      ${event.tenant_id},
      ${event.uid_hex || null},
      ${tagRows[0]?.id || null},
      ${event.id},
      ${event.id},
      'viewed',
      'wine',
      ${`Producto ${event.uid_hex || "NFC"}`},
      ${event.tenant_slug || "Tenant"}
    )
    ON CONFLICT DO NOTHING
  `;

  return event;
}

export async function claimPointsForConsumer(input: { consumerId: string; eventId: string; locale?: string }) {
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
