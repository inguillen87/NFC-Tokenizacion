import { sql, sqlSerializable } from "./db";
import { commitConsumerOwnershipClaim, type ConsumerOwnershipClaimAuthorization } from "./consumer-vertical-writer-policy";
import { claimTapPoints, getTapEvent } from "./loyalty-service";
import { ensureConsumerPortalSchema } from "./commercial-runtime-schema";
import { CanonicalEventWriteError, writeCanonicalEvent } from "./canonical-event-writer";
import { evaluateTapCommercialRights, readCurrentTapCommercialRights } from "./tap-commercial-rights";
import { publishTenantTapRealtimeProjection } from "./realtime-tap-projection";

export async function publishActorAssociationProjection(eventId: unknown) {
  try {
    const publication = await publishTenantTapRealtimeProjection(eventId);
    if (!publication.projected || !publication.distributed) {
      console.warn("[consumer_actor_realtime_projection_unavailable]", JSON.stringify({
        eventId: String(eventId || ""),
        projected: publication.projected,
        distributed: publication.distributed,
      }));
    }
  } catch (error) {
    console.warn("[consumer_actor_realtime_projection_failed]", JSON.stringify({
      eventId: String(eventId || ""),
      reason: error instanceof Error ? error.name : "unknown_error",
    }));
  }
}

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
      updated_at = now()
    WHERE tenant_consumer_memberships.status = 'active'
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

  const actorAssociationRows = await sql/*sql*/`
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
    RETURNING tenant_id, tap_event_id
  `;

  const actorAssociation = actorAssociationRows[0];
  if (
    actorAssociation?.tap_event_id
    && String(actorAssociation.tenant_id || "") === String(event.tenant_id || "")
  ) {
    // The association already committed. Re-publish its canonical tenant tap
    // projection so live CRM clients see the actor without waiting for a read.
    await publishActorAssociationProjection(actorAssociation.tap_event_id);
  }

  const tagRows = await sql/*sql*/`
    SELECT
      t.id,
      b.bid,
      tp.product_name,
      tp.sku,
      tp.winery,
      tp.region,
      tp.grape_varietal,
      tp.image_url
    FROM events e
    JOIN tags t ON t.batch_id = e.batch_id AND UPPER(TRIM(t.uid_hex)) = UPPER(TRIM(e.uid_hex))
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
  const imageUrl = String(tagProfile?.image_url || "").trim() || null;

  // Keep the identity predicate and the historical association separate from
  // ownership or benefit eligibility. SERIALIZABLE protects the absent-row
  // predicate too; a row lock or ON CONFLICT without a unit key cannot do that.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const productRows = await sqlSerializable/*sql*/`
        WITH existing AS MATERIALIZED (
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
        ), updated AS (
          UPDATE consumer_products product
          SET latest_tap_event_id = ${event.id},
              tag_id = COALESCE(${tagProfile?.id || null}, product.tag_id),
              product_name = COALESCE(NULLIF(${productName}, ''), product.product_name),
              brand_name = COALESCE(NULLIF(${brandName}, ''), product.brand_name),
              image_url = COALESCE(${imageUrl}, product.image_url),
              updated_at = now()
          FROM existing
          WHERE product.id = existing.id
          RETURNING product.id
        ), inserted AS (
          INSERT INTO consumer_products (consumer_id, tenant_id, product_passport_id, tag_id, first_tap_event_id, latest_tap_event_id, ownership_status, collection_type, product_name, brand_name, image_url)
          SELECT ${input.consumerId}, ${event.tenant_id}, ${event.uid_hex || null}, ${tagProfile?.id || null},
                 ${event.id}, ${event.id}, 'viewed', 'wine', ${productName}, ${brandName}, ${imageUrl}
          WHERE NOT EXISTS (SELECT 1 FROM existing)
          RETURNING id
        )
        SELECT id FROM updated
        UNION ALL
        SELECT id FROM inserted
      `;
      if (!productRows[0]?.id) throw new Error("consumer_product_save_failed");
      break;
    } catch (error) {
      if (attempt === 2 || typeof error !== "object" || error === null || !("code" in error) || error.code !== "40001") throw error;
      // Retry only the rolled-back product statement. Membership, history and
      // realtime publication already committed and must not be repeated here.
    }
  }

  return event;
}

type ClaimOwnershipInput = {
  authorization?: ConsumerOwnershipClaimAuthorization;
  consumerId: string;
  eventId: string;
  bid?: string | null;
  uidHex?: string | null;
  source?: "sun_passport" | "marketplace" | "admin";
  trustSnapshot?: Record<string, unknown>;
};

function withDigitalTitleExecutionTruth(ownership: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!ownership) return ownership || null;
  return {
    ...ownership,
    record_scope: "nexid_off_chain_digital_title",
    chain_transfer_status: "not_executed",
    nft_transfer_executed: false,
    on_chain_owner_verified: false,
  };
}

export async function claimOwnershipForConsumer(input: ClaimOwnershipInput) {
  const committed = await commitConsumerOwnershipClaim(input);
  if (!committed.ok) return { ...committed, ownership: null };
  const { event, ownership, uidHex } = committed;
  const tag = { batch_id: committed.batchId };
  const nextStatus = "claimed";
  // Core membership/history/product/title is confirmed. Canonical event/outbox
  // remains a separate, exact-receipt reconciliation boundary below.
  await publishActorAssociationProjection(event.id);
  const ownershipTruth = withDigitalTitleExecutionTruth(ownership);
  try {
    const canonicalEvent = await writeCanonicalEvent({
      operationKey: `ownership:${String(ownership.id)}:activated`,
      eventName: "ownership.activated",
      mode: "live",
      family: "lifecycle",
      referenceEventId: event.id,
      referenceEventCreatedAt: event.created_at || null,
      batchId: tag.batch_id,
      uidHex,
      eventType: "OWNERSHIP_ACTIVATED",
      result: "OWNERSHIP_ACTIVATED",
      verdict: "valid",
      riskLevel: "low",
      reason: "off_chain_digital_title_activated",
      meta: {
        source: input.source || "sun_passport",
        source_event_id: event.id,
      },
      webhookData: {
        ownershipId: String(ownership.id),
        status: String(ownership.status || nextStatus),
        recordScope: "nexid_off_chain_digital_title",
        chainTransferStatus: "not_executed",
        physicalCustodyVerified: false,
      },
    });
    return { ok: true as const, status: 200, ownership: ownershipTruth, canonicalEvent };
  } catch (error) {
    const reason = error instanceof CanonicalEventWriteError ? error.code : "canonical_event_write_unavailable";
    return {
      ok: false as const,
      status: 503,
      error: reason,
      operationCommitted: true,
      ownership: ownershipTruth,
    };
  }
}

export async function claimPointsForConsumer(input: { consumerId: string; eventId: string; locale?: string }) {
  await ensureConsumerPortalSchema();
  const rightsEvent = await getTapEvent(input.eventId);
  if (!rightsEvent) return { ok: false, error: "event_not_found" };
  if (!evaluateTapCommercialRights(rightsEvent).allowed) {
    return { ok: false, error: "tap_commercial_rights_blocked", reason: "manual_opening_declared" };
  }
  const currentRights = await readCurrentTapCommercialRights(input.eventId);
  if (!currentRights.allowed) {
    return { ok: false, error: "tap_commercial_rights_blocked", reason: currentRights.reason };
  }
  const event = rightsEvent;
  const claim = await claimTapPoints({
    eventId: input.eventId,
    locale: input.locale || "es-AR",
    memberKey: `consumer:${input.consumerId}`,
    consumerId: input.consumerId,
  });

  if (!claim.ok) return claim;
  await saveTapForConsumer(input);
  const membership = await ensureTenantMembership({ consumerId: input.consumerId, tenantId: event.tenant_id, tapEventId: String(event.id), source: "tap" });
  if (membership && claim.memberId) {
    await sql/*sql*/`
      UPDATE tenant_consumer_memberships membership
      SET points_balance = member.points_balance,
          lifetime_points = member.lifetime_points,
          loyalty_program_id = member.program_id,
          metadata_json = COALESCE(membership.metadata_json, '{}'::jsonb) || '{"pointsProjectionSource":"loyalty_members"}'::jsonb,
          updated_at = now()
      FROM loyalty_members member
      WHERE membership.id = ${membership.id}
        AND membership.status = 'active'
        AND membership.tenant_id = ${event.tenant_id}
        AND member.id = ${claim.memberId}
        AND member.consumer_id = ${input.consumerId}
    `;
  }

  return { ...claim, membershipId: membership?.id ?? null, pointsSource: "loyalty_members" };
}
