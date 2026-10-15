import { sql, sqlSerializable } from "./db";
import { claimTapPoints, getTapEvent } from "./loyalty-service";
import { CLAIMABLE_OWNERSHIP_RESULTS, evaluateOwnershipEligibility } from "./ownership-policy";
import { ensureConsumerPortalSchema } from "./commercial-runtime-schema";
import { CanonicalEventWriteError, writeCanonicalEvent } from "./canonical-event-writer";
import { evaluateTapCommercialRights, readCurrentTapCommercialRights } from "./tap-commercial-rights";
import { publishTenantTapRealtimeProjection } from "./realtime-tap-projection";

async function publishActorAssociationProjection(eventId: unknown) {
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

type ConsumerTapActionMode = { kind: "history" } | {
  kind: "mobile";
  /** Captured by the authenticated route from getTapEvent, never from its body. */
  expected: { tenantId: string; batchId: string; bid: string; uidHex: string; readCounter: unknown; tagId: string; tagRevision: string };
};

type ConsumerTapActionResult =
  | { ok: true; status: 200; event: Record<string, any>; membership: Record<string, any>; productId: string }
  | { ok: false; status: 404 | 409; error: "event_not_found" | "tap_context_changed" | "manual_opening_declared" | "consumer_membership_inactive" };

/** Membership, history and collection are one durable unit. This does not award
 * points, create a title or make the surrounding claim/points adapters atomic. */
export async function saveConsumerTapActionForConsumer(input: { consumerId: string; eventId: string; mode: ConsumerTapActionMode }): Promise<ConsumerTapActionResult> {
  await ensureConsumerPortalSchema();
  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false, status: 404, error: "event_not_found" };
  const expected = input.mode.kind === "mobile" ? input.mode.expected : null;
  const strict = input.mode.kind === "mobile";
  const counter = typeof expected?.readCounter === "number" || (typeof expected?.readCounter === "string" && /^(?:0|[1-9]\d*)$/.test(expected.readCounter))
    ? Number(expected.readCounter) : NaN;
  const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
  if (strict && (!expected || !uuid.test(expected.tenantId) || !uuid.test(expected.batchId) || !uuid.test(expected.tagId)
    || !expected.bid || !expected.uidHex || !/^\d+$/.test(expected.tagRevision)
    || !Number.isSafeInteger(counter) || counter < 0)) {
    return { ok: false, status: 409, error: "tap_context_changed" };
  }

  let committed: Record<string, any> | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const rows = await sqlSerializable/*sql*/`
        WITH locked_event AS MATERIALIZED (
          SELECT source_event.*, tenant.slug AS tenant_slug
          FROM events source_event JOIN tenants tenant ON tenant.id = source_event.tenant_id
          WHERE source_event.id = ${input.eventId}::bigint
          FOR SHARE OF source_event
        ), locked_batch AS MATERIALIZED (
          SELECT batch.* FROM batches batch JOIN locked_event event
            ON batch.id = event.batch_id AND batch.tenant_id = event.tenant_id
          FOR SHARE OF batch
        ), locked_tags AS MATERIALIZED (
          SELECT tag.*, tag.xmin::text AS row_revision FROM tags tag JOIN locked_batch batch ON batch.id = tag.batch_id
          JOIN locked_event event ON UPPER(BTRIM(tag.uid_hex)) = UPPER(BTRIM(event.uid_hex))
          WHERE (${strict}::boolean = false OR UPPER(tag.uid_hex) = UPPER(event.uid_hex))
          ORDER BY tag.id FOR SHARE OF tag
        ), locked_manual AS MATERIALIZED (
          SELECT manual.* FROM tag_manual_tamper_overrides manual JOIN locked_event event
            ON manual.batch_id = event.batch_id AND UPPER(manual.uid_hex) = UPPER(event.uid_hex)
          WHERE (SELECT count(*) FROM locked_tags) >= 0
          FOR SHARE OF manual
        ), locked_programs AS MATERIALIZED (
          SELECT program.* FROM loyalty_programs program JOIN locked_event event ON program.tenant_id = event.tenant_id
          WHERE (SELECT count(*) FROM locked_manual) >= 0
          ORDER BY program.id FOR SHARE OF program
        ), locked_membership AS MATERIALIZED (
          SELECT membership.* FROM tenant_consumer_memberships membership JOIN locked_event event ON membership.tenant_id = event.tenant_id
          WHERE membership.consumer_id = ${input.consumerId}::uuid
            AND (SELECT count(*) FROM locked_programs) >= 0
          FOR UPDATE OF membership
        ), tag_profile AS MATERIALIZED (
          SELECT tag.id, profile.product_name, profile.sku, profile.winery, profile.region, profile.grape_varietal, profile.image_url
          FROM locked_tags tag LEFT JOIN tag_profiles profile ON profile.tag_id = tag.id
          ORDER BY tag.created_at ASC, tag.id LIMIT 1
        ), locked_history AS MATERIALIZED (
          SELECT history.consumer_id, history.tenant_id, history.tap_event_id FROM consumer_tap_history history JOIN locked_event event ON event.id = history.tap_event_id
          WHERE history.consumer_id = ${input.consumerId}::uuid
            AND (SELECT count(*) FROM locked_membership) >= 0
          FOR SHARE OF history
        ), locked_product AS MATERIALIZED (
          SELECT product.id FROM consumer_products product JOIN locked_event event ON product.tenant_id = event.tenant_id
          WHERE product.consumer_id = ${input.consumerId}::uuid
            AND (SELECT count(*) FROM locked_history) >= 0
            AND (product.product_passport_id = NULLIF(event.uid_hex, '')
              OR product.tag_id = (SELECT id FROM tag_profile))
          ORDER BY product.updated_at DESC, product.id LIMIT 1 FOR UPDATE OF product
        ), decision_clock AS MATERIALIZED (
          -- Demand every locked source before sampling time: an empty product or
          -- history result does not drain an unused upstream count join. These
          -- scalar counts are used by the qualification before the volatile clock.
          SELECT clock_timestamp() AS observed_at
          WHERE (SELECT count(*) FROM locked_event)
              + (SELECT count(*) FROM locked_batch)
              + (SELECT count(*) FROM locked_tags)
              + (SELECT count(*) FROM locked_manual)
              + (SELECT count(*) FROM locked_programs)
              + (SELECT count(*) FROM locked_membership)
              + (SELECT count(*) FROM locked_history)
              + (SELECT count(*) FROM locked_product) >= 0
        ), current_program AS MATERIALIZED (
          SELECT program.id FROM locked_programs program CROSS JOIN decision_clock clock
          WHERE program.status = 'active' AND program.start_at <= clock.observed_at
            AND (program.end_at IS NULL OR program.end_at >= clock.observed_at)
          ORDER BY program.created_at DESC, program.id LIMIT 1
        ), decision AS MATERIALIZED (
          SELECT CASE
            WHEN NOT EXISTS (SELECT 1 FROM locked_event) THEN 'event_not_found'
            WHEN ${strict}::boolean AND NOT EXISTS (
              SELECT 1 FROM locked_event event JOIN locked_batch batch ON true
              WHERE event.tenant_id = ${expected?.tenantId ?? null}::uuid
                AND event.batch_id = ${expected?.batchId ?? null}::uuid AND batch.bid = ${expected?.bid ?? null}
                AND UPPER(event.uid_hex) = UPPER(${expected?.uidHex ?? null})
                AND event.sdm_read_ctr::bigint = ${strict ? counter : null}::bigint
            ) THEN 'tap_context_changed'
            WHEN ${strict}::boolean AND (
              EXISTS (SELECT 1 FROM locked_event WHERE UPPER(COALESCE(result, '')) IN ('MANUAL_OPENED', 'VALID_MANUAL_OPENED')
                OR regexp_replace(UPPER(COALESCE(reason, '')), '[[:space:]-]+', '_', 'g') SIMILAR TO '%(MANUAL_TAMPER_OPENED|MANUAL_OPENED|OPERATOR_DECLARED_OPEN)%')
              OR EXISTS (SELECT 1 FROM locked_manual WHERE UPPER(BTRIM(COALESCE(tamper_status, ''))) IN ('MANUAL_OPENED', 'OPENED')
                OR regexp_replace(UPPER(COALESCE(reason, '')), '[[:space:]-]+', '_', 'g') SIMILAR TO '%(MANUAL_TAMPER_OPENED|MANUAL_OPENED|OPERATOR_DECLARED_OPEN)%')
            ) THEN 'manual_opening_declared'
            WHEN ${strict}::boolean AND (
              NOT EXISTS (SELECT 1 FROM locked_event WHERE UPPER(COALESCE(result, '')) = ANY(${[...CLAIMABLE_OWNERSHIP_RESULTS]}::text[]))
              OR (SELECT count(*) FROM locked_tags) <> 1
              OR NOT EXISTS (SELECT 1 FROM locked_tags WHERE id = ${expected?.tagId ?? null}::uuid
                AND row_revision = ${expected?.tagRevision ?? null} AND status = 'active'
                AND COALESCE(lifecycle_state, status::text) = 'active')
            ) THEN 'tap_context_changed'
            WHEN EXISTS (SELECT 1 FROM locked_membership WHERE status IS DISTINCT FROM 'active') THEN 'consumer_membership_inactive'
            WHEN EXISTS (SELECT 1 FROM locked_history history JOIN locked_event event ON history.tenant_id IS DISTINCT FROM event.tenant_id) THEN 'tap_context_changed'
            ELSE NULL END AS error
          FROM decision_clock
        ), eligible AS MATERIALIZED (
          SELECT event.*,
            COALESCE(NULLIF(BTRIM(COALESCE(NULLIF(profile.product_name, ''), profile.sku, '')), ''),
              CASE WHEN NULLIF(BTRIM(profile.grape_varietal), '') IS NOT NULL AND NULLIF(BTRIM(profile.region), '') IS NOT NULL
                THEN BTRIM(profile.grape_varietal) || ' - ' || BTRIM(profile.region) END,
              'Producto ' || COALESCE(NULLIF(event.uid_hex, ''), 'NFC')) AS product_name,
            BTRIM(COALESCE(NULLIF(profile.winery, ''), event.tenant_slug, 'Tenant')) AS brand_name,
            NULLIF(BTRIM(profile.image_url), '') AS image_url, profile.id AS tag_id,
            CASE WHEN UPPER(COALESCE(event.result, '')) SIMILAR TO '%(REPLAY|TAMPER|INVALID)%' THEN 'high'
              WHEN UPPER(COALESCE(event.result, '')) LIKE '%VALID%' OR UPPER(event.result) = 'OPENED' THEN 'low' ELSE 'medium' END AS tap_risk_level
          FROM locked_event event LEFT JOIN tag_profile profile ON true CROSS JOIN decision
          WHERE decision.error IS NULL
        ), written_membership AS (
          INSERT INTO tenant_consumer_memberships (tenant_id, consumer_id, loyalty_program_id, source, first_tap_event_id, last_tap_event_id, status)
          SELECT tenant_id, ${input.consumerId}::uuid, (SELECT id FROM current_program), 'tap', id, id, 'active' FROM eligible WHERE true
          ON CONFLICT (tenant_id, consumer_id) DO UPDATE SET
            last_tap_event_id = COALESCE(EXCLUDED.last_tap_event_id, tenant_consumer_memberships.last_tap_event_id),
            last_activity_at = now(), updated_at = now()
          WHERE tenant_consumer_memberships.status = 'active'
          RETURNING *
        ), written_history AS (
          INSERT INTO consumer_tap_history (consumer_id, tenant_id, tap_event_id, verdict, risk_level, city, country)
          SELECT ${input.consumerId}::uuid, event.tenant_id, event.id, NULLIF(event.result, ''), event.tap_risk_level,
            NULLIF(event.city, ''), NULLIF(event.country_code, '')
          FROM eligible event JOIN written_membership membership ON membership.tenant_id = event.tenant_id
          WHERE true
          ON CONFLICT (consumer_id, tap_event_id) DO NOTHING RETURNING tenant_id, tap_event_id
        ), updated_product AS (
          UPDATE consumer_products product SET latest_tap_event_id = event.id,
            tag_id = COALESCE(event.tag_id, product.tag_id), product_name = COALESCE(NULLIF(event.product_name, ''), product.product_name),
            brand_name = COALESCE(NULLIF(event.brand_name, ''), product.brand_name), image_url = COALESCE(event.image_url, product.image_url), updated_at = now()
          FROM locked_product existing, eligible event, written_membership membership,
            (SELECT count(*) FROM written_history) history_write_barrier
          WHERE product.id = existing.id AND membership.tenant_id = event.tenant_id RETURNING product.id
        ), inserted_product AS (
          INSERT INTO consumer_products (consumer_id, tenant_id, product_passport_id, tag_id, first_tap_event_id, latest_tap_event_id, ownership_status, collection_type, product_name, brand_name, image_url)
          SELECT ${input.consumerId}::uuid, event.tenant_id, NULLIF(event.uid_hex, ''), event.tag_id,
            event.id, event.id, 'viewed', 'wine', event.product_name, event.brand_name, event.image_url
          FROM eligible event JOIN written_membership membership ON membership.tenant_id = event.tenant_id
          CROSS JOIN (SELECT count(*) FROM written_history) history_write_barrier
          WHERE NOT EXISTS (SELECT 1 FROM locked_product) RETURNING id
        ), saved_product AS MATERIALIZED (
          SELECT id FROM updated_product UNION ALL SELECT id FROM inserted_product
        ), write_integrity AS MATERIALIZED (
          -- Force a statement rollback if an unexpected trigger/RLS suppresses a
          -- required write; never return a rejection after committing only part.
          SELECT 1 / CASE WHEN (SELECT error FROM decision) IS NOT NULL
            OR ((SELECT count(*) FROM written_membership) = 1 AND (SELECT count(*) FROM saved_product) = 1
              AND ((SELECT count(*) FROM written_history) = 1 OR EXISTS (
                SELECT 1 FROM locked_history history JOIN locked_event event ON history.tenant_id = event.tenant_id AND history.tap_event_id = event.id
                WHERE history.consumer_id = ${input.consumerId}::uuid)))
            THEN 1 ELSE 0 END AS valid
        )
        SELECT (SELECT error FROM decision) AS error,
          (SELECT row_to_json(membership) FROM written_membership membership LIMIT 1) AS membership,
          (SELECT id FROM saved_product LIMIT 1) AS product_id,
          (SELECT tap_event_id FROM written_history LIMIT 1) AS association_event_id
        FROM write_integrity WHERE valid = 1
      `;
      committed = rows[0];
      break;
    } catch (error) {
      if (attempt === 2 || typeof error !== "object" || error === null || !("code" in error) || error.code !== "40001") throw error;
      // Only the entire rolled-back core is retried. No token consumption, PIN,
      // points, title or post-commit projection is repeated by this loop.
    }
  }
  const reason = committed?.error;
  if (reason === "event_not_found") return { ok: false, status: 404, error: reason };
  if (reason === "tap_context_changed" || reason === "manual_opening_declared" || reason === "consumer_membership_inactive") {
    return { ok: false, status: 409, error: reason };
  }
  if (reason || !committed?.membership?.id || !committed.product_id) throw new Error("consumer_tap_core_result_unavailable");
  // All three writes already committed. Publication remains best-effort and
  // outside the core; its failure cannot turn this receipt into a new attempt.
  if (committed.association_event_id) await publishActorAssociationProjection(committed.association_event_id);
  return { ok: true, status: 200, event, membership: committed.membership, productId: String(committed.product_id) };
}

/** Historical callers retain their event/null adapter and may save an invalid,
 * tag-less or currently suspended reading without claiming ownership/benefits. */
export async function saveTapForConsumer(input: { consumerId: string; eventId: string }) {
  const result = await saveConsumerTapActionForConsumer({ ...input, mode: { kind: "history" } });
  return result.ok ? result.event : null;
}

type ClaimOwnershipInput = {
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
  await ensureConsumerPortalSchema();
  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false as const, status: 404, error: "event_not_found" as const };
  if (!event.tenant_id || !event.batch_id || !event.uid_hex) return { ok: false as const, status: 400, error: "event_missing_identity" as const };
  if (input.uidHex && String(input.uidHex).toUpperCase() !== String(event.uid_hex).toUpperCase()) {
    return { ok: false as const, status: 403, error: "uid_mismatch" as const };
  }

  const tag = {
    id: event.current_tag_id,
    status: event.current_tag_status,
    lifecycle_state: event.current_tag_lifecycle_state,
    batch_id: event.batch_id,
    bid: event.bid,
  };
  if (!tag.id) return { ok: false as const, status: 404, error: "tag_not_found" as const };
  if (input.bid && String(input.bid).trim() !== String(tag.bid || "").trim()) {
    return { ok: false as const, status: 403, error: "tenant_batch_mismatch" as const };
  }
  const result = String(event.result || "").toUpperCase();
  const currentRights = await readCurrentTapCommercialRights(String(event.id));
  const { isBlocked, nextStatus } = evaluateOwnershipEligibility({
    ...event,
    result,
  });
  const durableBlocked = isBlocked || !currentRights.allowed;
  const durableNextStatus = durableBlocked ? "revoked" : nextStatus;

  if (!durableBlocked) {
    await ensureTenantMembership({ consumerId: input.consumerId, tenantId: event.tenant_id, tapEventId: String(event.id), source: "tap" });
    await saveTapForConsumer({ consumerId: input.consumerId, eventId: String(event.id) });
  }

  const trustSnapshot = {
    result,
    reason: event.reason || null,
    city: event.city || null,
    country: event.country_code || null,
    tag_status: tag.status || null,
    tag_lifecycle_state: tag.lifecycle_state || tag.status || null,
    blocked: durableBlocked,
    commercial_rights_reason: currentRights.reason,
    ...(input.trustSnapshot || {}),
  };

  const uidHex = String(event.uid_hex).toUpperCase();
  const existingClaimRows = !durableBlocked ? await sql/*sql*/`
    SELECT o.id, o.consumer_id
    FROM consumer_product_ownerships o
    WHERE o.tenant_id = ${event.tenant_id}
      AND o.uid_hex = ${uidHex}
      AND o.status = 'claimed'
    ORDER BY o.updated_at DESC
    LIMIT 1
  ` : [];
  const existingClaim = existingClaimRows[0];
  const existingConsumerId = String(existingClaim?.consumer_id || "");
  const sameConsumerClaim = existingConsumerId && existingConsumerId === String(input.consumerId);

  if (existingClaim && !sameConsumerClaim) {
    return {
      ok: false as const,
      status: 409,
      error: "ownership_already_claimed" as const,
      ownership: null,
    };
  }

  let ownershipRows;
  if (existingClaim && sameConsumerClaim) {
    ownershipRows = await sql/*sql*/`
      WITH current_tag AS MATERIALIZED (
        SELECT tag.id
        FROM events source_event
        JOIN batches bound_batch ON bound_batch.id = source_event.batch_id AND bound_batch.tenant_id = source_event.tenant_id
        JOIN tags tag ON tag.batch_id = source_event.batch_id AND UPPER(tag.uid_hex) = UPPER(source_event.uid_hex)
        WHERE source_event.id = ${event.id}::bigint
          AND source_event.tenant_id = ${event.tenant_id}
          AND source_event.batch_id = ${tag.batch_id}
          AND UPPER(source_event.uid_hex) = ${uidHex}
          AND tag.id = ${tag.id}
          AND UPPER(source_event.result) = ANY(${[...CLAIMABLE_OWNERSHIP_RESULTS]}::text[])
          AND tag.status = 'active'
          AND COALESCE(tag.lifecycle_state, tag.status::text) = 'active'
          AND NOT EXISTS (SELECT 1 FROM tags ambiguous_tag WHERE ambiguous_tag.batch_id = tag.batch_id AND UPPER(ambiguous_tag.uid_hex) = UPPER(tag.uid_hex) AND ambiguous_tag.id <> tag.id)
        FOR SHARE OF tag, bound_batch, source_event
      )
      UPDATE consumer_product_ownerships
      SET consumer_id = ${input.consumerId},
          batch_id = ${tag.batch_id},
          tag_id = ${tag.id || null},
          event_id = ${event.id},
          status = CASE
            WHEN NOT EXISTS (SELECT 1 FROM current_tag) OR EXISTS (
              SELECT 1
              FROM events source_event
              LEFT JOIN tag_manual_tamper_overrides manual_override
                ON manual_override.batch_id = source_event.batch_id
               AND UPPER(manual_override.uid_hex) = UPPER(source_event.uid_hex)
              WHERE source_event.id = ${event.id}::bigint
                AND (
                  UPPER(COALESCE(source_event.result, '')) IN ('MANUAL_OPENED', 'VALID_MANUAL_OPENED')
                  OR regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%MANUAL_TAMPER_OPENED%'
                  OR regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%MANUAL_OPENED%'
                  OR regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%OPERATOR_DECLARED_OPEN%'
                  OR UPPER(BTRIM(COALESCE(manual_override.tamper_status, ''))) IN ('MANUAL_OPENED', 'OPENED')
                  OR regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%MANUAL_TAMPER_OPENED%'
                  OR regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%MANUAL_OPENED%'
                  OR regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%OPERATOR_DECLARED_OPEN%'
                )
            ) THEN 'revoked'
            ELSE ${durableNextStatus}
          END,
          source = ${input.source || "sun_passport"},
          trust_snapshot = ${JSON.stringify(trustSnapshot)}::jsonb,
          updated_at = now()
      WHERE id = ${existingClaim.id}
      RETURNING *
    `;

  } else {
    try {
      ownershipRows = await sql/*sql*/`
        WITH current_tag AS MATERIALIZED (
          SELECT tag.id
          FROM events source_event
          JOIN batches bound_batch ON bound_batch.id = source_event.batch_id AND bound_batch.tenant_id = source_event.tenant_id
          JOIN tags tag ON tag.batch_id = source_event.batch_id AND UPPER(tag.uid_hex) = UPPER(source_event.uid_hex)
          WHERE source_event.id = ${event.id}::bigint
            AND source_event.tenant_id = ${event.tenant_id}
            AND source_event.batch_id = ${tag.batch_id}
            AND UPPER(source_event.uid_hex) = ${uidHex}
            AND tag.id = ${tag.id}
            AND UPPER(source_event.result) = ANY(${[...CLAIMABLE_OWNERSHIP_RESULTS]}::text[])
            AND tag.status = 'active'
            AND COALESCE(tag.lifecycle_state, tag.status::text) = 'active'
            AND NOT EXISTS (SELECT 1 FROM tags ambiguous_tag WHERE ambiguous_tag.batch_id = tag.batch_id AND UPPER(ambiguous_tag.uid_hex) = UPPER(tag.uid_hex) AND ambiguous_tag.id <> tag.id)
          FOR SHARE OF tag, bound_batch, source_event
        )
        INSERT INTO consumer_product_ownerships (
          tenant_id, consumer_id, batch_id, tag_id, uid_hex, event_id, status, source, trust_snapshot
        )
        SELECT
          ${event.tenant_id}, ${input.consumerId}, ${tag.batch_id}, ${tag.id || null}, ${uidHex}, ${event.id},
          CASE
            WHEN NOT EXISTS (SELECT 1 FROM current_tag)
              OR UPPER(COALESCE(source_event.result, '')) IN ('MANUAL_OPENED', 'VALID_MANUAL_OPENED')
              OR regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%MANUAL_TAMPER_OPENED%'
              OR regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%MANUAL_OPENED%'
              OR regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%OPERATOR_DECLARED_OPEN%'
              OR UPPER(BTRIM(COALESCE(manual_override.tamper_status, ''))) IN ('MANUAL_OPENED', 'OPENED')
              OR regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%MANUAL_TAMPER_OPENED%'
              OR regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%MANUAL_OPENED%'
              OR regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') LIKE '%OPERATOR_DECLARED_OPEN%'
            THEN 'revoked'
            ELSE ${durableNextStatus}
          END,
          ${input.source || "sun_passport"}, ${JSON.stringify(trustSnapshot)}::jsonb
        FROM events source_event
        LEFT JOIN tag_manual_tamper_overrides manual_override
          ON manual_override.batch_id = source_event.batch_id
         AND UPPER(manual_override.uid_hex) = UPPER(source_event.uid_hex)
        WHERE source_event.id = ${event.id}::bigint
        ON CONFLICT (consumer_id, event_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          trust_snapshot = EXCLUDED.trust_snapshot,
          updated_at = now()
        RETURNING *
      `;
    } catch (error) {
      const err = error as { code?: string; constraint?: string };
      if (err.code === "23505" && err.constraint === "uq_consumer_product_ownerships_active_uid") {
        return {
          ok: false as const,
          status: 409,
          error: "ownership_already_claimed" as const,
          ownership: null,
        };
      }
      throw error;
    }
  }
  const ownership = ownershipRows[0];
  const persistedNextStatus = String(ownership?.status || "revoked");

  await sql/*sql*/`
    UPDATE consumer_products
    SET ownership_status = ${persistedNextStatus},
        latest_tap_event_id = ${event.id},
        updated_at = now()
    WHERE consumer_id = ${input.consumerId}
      AND tenant_id = ${event.tenant_id}
      AND (
        product_passport_id = ${uidHex}
        OR tag_id = ${tag.id || null}
      )
  `;

  if (durableBlocked || String(ownership?.status || "") !== "claimed") {
    return {
      ok: false as const,
      status: 409,
      error: nextStatus === "blocked_replay" ? "blocked_replay" as const : "revoked" as const,
      ownership: withDigitalTitleExecutionTruth(ownership),
    };
  }

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
