import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { ensureLoyaltySchema } from "./loyalty-schema";
import { isCurrentLoyaltyTapEligible, LOYALTY_TAP_RESULTS } from "./loyalty-tap-policy";

type TapEligibility = {
  award: boolean;
  reason: "awarded" | "blocked_validation" | "cooldown" | "already_awarded";
};

const BLOCKED_RESULTS = new Set(["REPLAY_SUSPECT", "INVALID", "NOT_ACTIVE", "NOT_REGISTERED", "TAMPER", "TAMPER_RISK", "TAMPER_UNVERIFIED", "OPENED", "REVOKED", "BROKEN"]);

export function readTapPointsPolicy(program: any) {
  let rules: any;
  try { rules = typeof program?.rules_json === 'string' ? JSON.parse(program.rules_json) : program?.rules_json; } catch { return null; }
  const points = rules?.pointsPerValidTap;
  const cooldownSeconds = rules && Object.hasOwn(rules, 'cooldownSeconds') ? rules.cooldownSeconds : 0;
  if (!Number.isSafeInteger(points) || points < 0 || points > 10_000 || !Number.isSafeInteger(cooldownSeconds) || cooldownSeconds < 0 || cooldownSeconds > 604_800) return null;
  return { points, cooldownSeconds, rules };
}

export async function getTapEvent(eventId: string) {
  const rows = await sql/*sql*/`
    SELECT e.id, e.tenant_id, e.batch_id, e.uid_hex, e.sdm_read_ctr, e.result, e.reason, e.created_at, e.city, e.country_code, e.geo_lat, e.geo_lng,
           manual_override.tamper_status AS manual_tamper_status,
           manual_override.reason AS manual_tamper_reason,
           manual_override.source AS manual_tamper_source,
           manual_override.updated_at AS manual_tamper_updated_at,
           t.slug AS tenant_slug, b.bid,
           current_tag.id AS current_tag_id,
           b.tenant_id AS current_tag_tenant_id,
           current_tag.batch_id AS current_tag_batch_id,
           current_tag.uid_hex AS current_tag_uid_hex,
           current_tag.status AS current_tag_status,
           current_tag.lifecycle_state AS current_tag_lifecycle_state,
           current_tag.row_revision AS current_tag_revision,
           current_tag.identity_count AS current_tag_identity_count
    FROM events e
    JOIN tenants t ON t.id = e.tenant_id
    LEFT JOIN batches b ON b.id = e.batch_id
    LEFT JOIN LATERAL (
      SELECT tag.id, tag.batch_id, tag.uid_hex, tag.status, tag.lifecycle_state, tag.xmin::text AS row_revision,
             count(*) OVER () AS identity_count
      FROM tags tag
      WHERE tag.batch_id = e.batch_id
        AND UPPER(tag.uid_hex) = UPPER(e.uid_hex)
    ) current_tag ON b.tenant_id = e.tenant_id
    LEFT JOIN tag_manual_tamper_overrides manual_override
      ON manual_override.batch_id = e.batch_id
     AND UPPER(manual_override.uid_hex) = UPPER(e.uid_hex)
    WHERE e.id = ${eventId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getActiveProgram(tenantId: string) {
  await ensureLoyaltySchema();
  const rows = await sql/*sql*/`
    SELECT *, start_at::text AS configuration_start_at, end_at::text AS configuration_end_at, updated_at::text AS configuration_updated_at
    FROM loyalty_programs
    WHERE tenant_id = ${tenantId}
      AND status = 'active'
      AND start_at <= now()
      AND (end_at IS NULL OR end_at >= now())
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getOrCreateMember(input: { tenantId: string; programId: string; eventId: string; memberKey: string; consumerId?: string | null; locale?: string; email?: string | null; phone?: string | null; displayName?: string | null; country?: string | null }) {
  await ensureLoyaltySchema();
  const event = await getTapEvent(input.eventId);
  const rows = await sql/*sql*/`
    WITH current_tag AS MATERIALIZED (
      SELECT tag.id
      FROM events source_event
      JOIN batches bound_batch ON bound_batch.id = source_event.batch_id AND bound_batch.tenant_id = source_event.tenant_id
      JOIN tags tag ON tag.batch_id = source_event.batch_id AND UPPER(tag.uid_hex) = UPPER(source_event.uid_hex)
      LEFT JOIN tag_manual_tamper_overrides manual_override
        ON manual_override.batch_id = source_event.batch_id AND UPPER(manual_override.uid_hex) = UPPER(source_event.uid_hex)
      WHERE source_event.id = ${input.eventId}::bigint
        AND source_event.tenant_id = ${input.tenantId}
        AND UPPER(source_event.result) = ANY(${[...LOYALTY_TAP_RESULTS]}::text[])
        AND BTRIM(COALESCE(source_event.uid_hex, '')) <> ''
        AND tag.status = 'active'
        AND tag.xmin::text = ${event?.current_tag_revision ?? null}
        AND COALESCE(tag.lifecycle_state, tag.status::text) = 'active'
        AND NOT EXISTS (SELECT 1 FROM tags ambiguous_tag WHERE ambiguous_tag.batch_id = tag.batch_id AND UPPER(ambiguous_tag.uid_hex) = UPPER(tag.uid_hex) AND ambiguous_tag.id <> tag.id)
        AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_TAMPER_OPENED%'
        AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_OPENED%'
        AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%OPERATOR_DECLARED_OPEN%'
        AND UPPER(BTRIM(COALESCE(manual_override.tamper_status, ''))) NOT IN ('MANUAL_OPENED', 'OPENED')
        AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_TAMPER_OPENED%'
        AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_OPENED%'
        AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%OPERATOR_DECLARED_OPEN%'
      FOR SHARE OF tag
    ), locked_program AS MATERIALIZED (
      SELECT program.* FROM loyalty_programs program JOIN current_tag ON true
      WHERE program.id = ${input.programId} AND program.tenant_id = ${input.tenantId}
      FOR SHARE OF program
    ), locked_existing_member AS MATERIALIZED (
      SELECT member.id FROM loyalty_members member JOIN locked_program ON true
      WHERE member.tenant_id = ${input.tenantId} AND member.program_id = ${input.programId} AND member.member_key = ${input.memberKey}
      FOR UPDATE OF member
    ), locked_membership AS MATERIALIZED (
      SELECT membership.status FROM tenant_consumer_memberships membership JOIN locked_program ON true
      CROSS JOIN (SELECT count(*) FROM locked_existing_member) member_lock_barrier
      WHERE membership.tenant_id = ${input.tenantId} AND membership.consumer_id = ${input.consumerId || null}
      FOR UPDATE OF membership
    ), eligible_program AS MATERIALIZED (
      SELECT locked_program.id FROM locked_program
      WHERE status = 'active' AND start_at <= clock_timestamp()
        AND (end_at IS NULL OR end_at >= clock_timestamp())
        AND NOT EXISTS (SELECT 1 FROM locked_membership WHERE status IS DISTINCT FROM 'active')
    )
    INSERT INTO loyalty_members (tenant_id, program_id, event_id, member_key, consumer_id, preferred_locale, email, phone, display_name, country, status, first_tap_at, last_tap_at)
    SELECT ${input.tenantId}, ${input.programId}, ${input.eventId}, ${input.memberKey}, ${input.consumerId || null}, ${input.locale || "es-AR"}, ${input.email || null}, ${input.phone || null}, ${input.displayName || null}, ${input.country || null}, ${input.email || input.phone || input.consumerId ? "enrolled" : "anonymous"}, now(), now()
    FROM eligible_program
    WHERE true
    ON CONFLICT (program_id, member_key)
    DO UPDATE SET
      event_id = EXCLUDED.event_id,
      consumer_id = COALESCE(EXCLUDED.consumer_id, loyalty_members.consumer_id),
      preferred_locale = EXCLUDED.preferred_locale,
      email = COALESCE(EXCLUDED.email, loyalty_members.email),
      phone = COALESCE(EXCLUDED.phone, loyalty_members.phone),
      display_name = COALESCE(EXCLUDED.display_name, loyalty_members.display_name),
      country = COALESCE(EXCLUDED.country, loyalty_members.country),
      status = CASE WHEN loyalty_members.status = 'verified' THEN loyalty_members.status WHEN EXCLUDED.email IS NOT NULL OR EXCLUDED.phone IS NOT NULL OR EXCLUDED.consumer_id IS NOT NULL THEN 'enrolled'::loyalty_member_status ELSE loyalty_members.status END,
      updated_at = now(),
      last_tap_at = now()
    WHERE loyalty_members.status IN ('anonymous', 'enrolled', 'verified')
      AND loyalty_members.tenant_id = EXCLUDED.tenant_id
    RETURNING *
  `;
  return rows[0];
}

export async function evaluateLoyaltyForTap(input: { eventId: string; memberId: string; program: any; event: any }): Promise<TapEligibility> {
  if (!isCurrentLoyaltyTapEligible(input.event)) {
    return { award: false, reason: "blocked_validation" };
  }
  await ensureLoyaltySchema();
  const idem = `tap:${input.eventId}:member:${input.memberId}`;
  const idemRows = await sql/*sql*/`SELECT id FROM points_ledger WHERE idempotency_key = ${idem} LIMIT 1`;
  if (idemRows[0]) return { award: false, reason: "already_awarded" };

  const policy = readTapPointsPolicy(input.program);
  if (!policy) return { award: false, reason: 'blocked_validation' };
  const cooldownSeconds = policy.cooldownSeconds;
  if (cooldownSeconds > 0) {
    const rows = await sql/*sql*/`
      SELECT pl.id
      FROM points_ledger pl
      JOIN events e ON e.id = pl.tap_event_id
      WHERE pl.member_id = ${input.memberId}
        AND pl.source = 'TAP_VALID'
        AND e.uid_hex = ${input.event.uid_hex || null}
        AND pl.created_at >= now() - make_interval(secs => ${cooldownSeconds})
      LIMIT 1
    `;
    if (rows[0]) return { award: false, reason: "cooldown" };
  }
  return { award: true, reason: "awarded" };
}

export async function loyaltyFraudGuard(input: { eventId: string; result: string; uidHex: string; tenantId: string }) {
  const isSuspicious = BLOCKED_RESULTS.has(input.result.toUpperCase());
  if (isSuspicious) {
    await sql`
      INSERT INTO audit_logs (tenant_id, action, entity_type, entity_id, before_json, after_json)
      VALUES (${input.tenantId}, 'LOYALTY_FRAUD_BLOCKED', 'event', ${input.eventId}, ${JSON.stringify({ uid: input.uidHex, reason: input.result })}::jsonb, '{}'::jsonb)
    `.catch(() => null);
  }
}

export async function awardPoints(input: { tenantId: string; programId: string; memberId: string; tapEventId?: string; delta: number; source: string; idempotencyKey: string; reason?: string; metadata?: Record<string, unknown>; expectedRules?: unknown }) {
  await ensureLoyaltySchema();
  const delta = Number(input.delta);
  const isTapAward = input.source === 'TAP_VALID';
  if (!Number.isSafeInteger(delta) || (delta === 0 && !isTapAward) || Math.abs(delta) > 1_000_000 || (isTapAward && (!input.tapEventId || delta < 0 || delta > 10_000))) {
    return { awarded: false, duplicate: false, entry: null, error: "invalid_points_delta" as const };
  }
  const idempotencyKey = String(input.idempotencyKey || "").trim().slice(0, 240);
  if (!idempotencyKey) return { awarded: false, duplicate: false, entry: null, error: "idempotency_key_required" as const };
  // A first manual declaration may be absent from the statement snapshot.
  // Its writer touches the tag, so the captured version must still match after
  // this writer acquires its tag lock. Independent admin adjustments keep their contract.
  const tapEvent = isTapAward ? await getTapEvent(input.tapEventId!) : null;
  // A member row version closes the snapshot gap when another TAP commits
  // while this statement waits: the ledger predicate alone sees an older
  // READ COMMITTED snapshot. Zero cooldown intentionally allows other taps.
  const memberRevision = isTapAward ? (await sql/*sql*/`
    SELECT xmin::text AS row_revision FROM loyalty_members
    WHERE id = ${input.memberId} AND tenant_id = ${input.tenantId} AND program_id = ${input.programId}
  `)[0]?.row_revision : null;
  const rows = await sql/*sql*/`
    WITH current_tag AS MATERIALIZED (
      SELECT tag.id
      FROM events source_event
      JOIN batches bound_batch ON bound_batch.id = source_event.batch_id AND bound_batch.tenant_id = source_event.tenant_id
      JOIN tags tag ON tag.batch_id = source_event.batch_id AND UPPER(tag.uid_hex) = UPPER(source_event.uid_hex)
      WHERE source_event.id = ${input.tapEventId || null}::bigint
        AND source_event.tenant_id = ${input.tenantId}
        AND UPPER(source_event.result) = ANY(${[...LOYALTY_TAP_RESULTS]}::text[])
        AND BTRIM(COALESCE(source_event.uid_hex, '')) <> ''
        AND tag.status = 'active'
        AND (NOT ${isTapAward} OR tag.xmin::text = ${tapEvent?.current_tag_revision ?? null})
        AND COALESCE(tag.lifecycle_state, tag.status::text) = 'active'
        AND NOT EXISTS (SELECT 1 FROM tags ambiguous_tag WHERE ambiguous_tag.batch_id = tag.batch_id AND UPPER(ambiguous_tag.uid_hex) = UPPER(tag.uid_hex) AND ambiguous_tag.id <> tag.id)
      FOR SHARE OF tag
    ), tap_rights AS MATERIALIZED (
      SELECT true AS allowed
      WHERE ${delta} < 0
         OR ${input.tapEventId || null}::bigint IS NULL
         OR EXISTS (
           SELECT 1
           FROM events source_event
            JOIN current_tag ON true
           LEFT JOIN tag_manual_tamper_overrides manual_override
             ON manual_override.batch_id = source_event.batch_id
            AND UPPER(manual_override.uid_hex) = UPPER(source_event.uid_hex)
           WHERE source_event.id = ${input.tapEventId || null}::bigint
             AND UPPER(COALESCE(source_event.result, '')) NOT IN ('MANUAL_OPENED', 'VALID_MANUAL_OPENED')
             AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_TAMPER_OPENED%'
             AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_OPENED%'
             AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%OPERATOR_DECLARED_OPEN%'
             AND UPPER(BTRIM(COALESCE(manual_override.tamper_status, ''))) NOT IN ('MANUAL_OPENED', 'OPENED')
             AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_TAMPER_OPENED%'
             AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_OPENED%'
             AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%OPERATOR_DECLARED_OPEN%'
         )
    ),
    locked_program AS MATERIALIZED (
      SELECT program.* FROM loyalty_programs program JOIN tap_rights ON true
      WHERE program.id = ${input.programId} AND program.tenant_id = ${input.tenantId}
      FOR SHARE OF program
    ),
    locked_member AS MATERIALIZED (
      SELECT member.id, member.points_balance, member.lifetime_points, member.consumer_id, member.xmin::text AS row_revision
      FROM loyalty_members member
      JOIN tap_rights ON tap_rights.allowed = true
      JOIN locked_program ON true
      WHERE member.id = ${input.memberId}
        AND member.tenant_id = ${input.tenantId}
        AND member.program_id = ${input.programId}
        AND (${delta} < 0 OR ${input.tapEventId || null}::bigint IS NULL OR member.status IN ('anonymous', 'enrolled', 'verified'))
        AND (${delta} >= 0 OR member.points_balance >= abs(${delta}))
      FOR UPDATE OF member
    ), program_policy AS MATERIALIZED (
      SELECT locked_program.*, CASE WHEN NOT (rules_json ? 'cooldownSeconds') THEN 0
        WHEN jsonb_typeof(rules_json->'cooldownSeconds') = 'number' THEN CASE
          WHEN (rules_json->>'cooldownSeconds')::numeric BETWEEN 0 AND 604800
            AND mod((rules_json->>'cooldownSeconds')::numeric, 1) = 0
          THEN (rules_json->>'cooldownSeconds')::numeric::integer ELSE NULL END ELSE NULL END AS cooldown_seconds
      FROM locked_program
    ), eligible_member AS MATERIALIZED (
      SELECT locked_member.* FROM locked_member JOIN program_policy locked_program ON true
      WHERE NOT ${isTapAward} OR (
        locked_program.status = 'active' AND locked_program.start_at <= clock_timestamp()
        AND (locked_program.end_at IS NULL OR locked_program.end_at >= clock_timestamp())
        AND jsonb_typeof(locked_program.rules_json->'pointsPerValidTap') = 'number'
        AND locked_program.rules_json->'pointsPerValidTap' = to_jsonb(${delta}::integer)
        AND locked_program.cooldown_seconds IS NOT NULL
        AND (${input.expectedRules === undefined} OR locked_program.rules_json = ${JSON.stringify(input.expectedRules ?? {})}::jsonb)
        AND (locked_program.cooldown_seconds = 0 OR locked_member.row_revision = ${memberRevision})
        AND NOT EXISTS (
          SELECT 1 FROM points_ledger previous JOIN events previous_event ON previous_event.id = previous.tap_event_id
          JOIN events current_event ON current_event.id = ${input.tapEventId || null}::bigint
          WHERE previous.member_id = locked_member.id AND previous.tenant_id = ${input.tenantId}
            AND previous.program_id = ${input.programId} AND previous.source = 'TAP_VALID'
            AND UPPER(previous_event.uid_hex) = UPPER(current_event.uid_hex)
            AND previous.created_at >= clock_timestamp() - make_interval(secs => locked_program.cooldown_seconds)
            AND locked_program.cooldown_seconds > 0
        )
      )
    ), membership_reservation AS MATERIALIZED (
      INSERT INTO tenant_consumer_memberships (tenant_id, consumer_id, loyalty_program_id, source, first_tap_event_id, last_tap_event_id, status, points_balance, lifetime_points)
      SELECT ${input.tenantId}, consumer_id, ${input.programId}, 'tap', ${input.tapEventId || null}, ${input.tapEventId || null}, 'active', points_balance + ${delta}, lifetime_points + ${delta}
      FROM eligible_member WHERE ${isTapAward} AND consumer_id IS NOT NULL
      ON CONFLICT (tenant_id, consumer_id) DO UPDATE SET
        points_balance = EXCLUDED.points_balance,
        lifetime_points = EXCLUDED.lifetime_points,
        loyalty_program_id = EXCLUDED.loyalty_program_id,
        last_tap_event_id = EXCLUDED.last_tap_event_id,
        last_activity_at = now(),
        updated_at = now()
      WHERE tenant_consumer_memberships.status = 'active'
      RETURNING id
    ),
    reserved_ledger AS MATERIALIZED (
      INSERT INTO points_ledger (
        tenant_id, program_id, member_id, tap_event_id, source, delta,
        balance_after, idempotency_key, reason, metadata_json
      )
      SELECT
        ${input.tenantId}, ${input.programId}, id, ${input.tapEventId || null},
        ${input.source}::points_source, ${delta}, locked_member.points_balance + ${delta}, ${idempotencyKey},
        ${input.reason || null}, ${JSON.stringify(input.metadata || {})}::jsonb
      FROM eligible_member locked_member
      WHERE NOT ${isTapAward} OR locked_member.consumer_id IS NULL OR EXISTS (SELECT 1 FROM membership_reservation)
      RETURNING *
    ),
    updated_member AS MATERIALIZED (
      UPDATE loyalty_members member
      SET points_balance = member.points_balance + ${delta},
          lifetime_points = member.lifetime_points + CASE WHEN ${delta} > 0 THEN ${delta} ELSE 0 END,
          updated_at = now()
      FROM locked_member, reserved_ledger
      WHERE member.id = locked_member.id
      RETURNING member.points_balance
    )
    SELECT reserved_ledger.* FROM reserved_ledger JOIN updated_member ON true
  `.catch((error: unknown) => {
    const pgError = error as { code?: string; constraint?: string };
    if (pgError.code === '23505' && pgError.constraint === 'points_ledger_idempotency_key_key') return [];
    throw error;
  });
  if (rows[0]) return { awarded: true, duplicate: false, entry: rows[0] };
  const existing = await sql/*sql*/`
    SELECT id, delta, balance_after
    FROM points_ledger
    WHERE idempotency_key = ${idempotencyKey}
      AND member_id = ${input.memberId}
      AND tenant_id = ${input.tenantId}
      AND program_id = ${input.programId}
      AND source = ${input.source}::points_source
      AND tap_event_id IS NOT DISTINCT FROM ${input.tapEventId || null}::bigint
    LIMIT 1
  `;
  if (existing[0]) return { awarded: false, duplicate: true, entry: existing[0] };
  return { awarded: false, duplicate: false, entry: null, error: delta < 0 ? "insufficient_points" as const : "member_not_found" as const };
}

export async function claimTapPoints(input: { eventId: string; memberKey?: string; consumerId?: string | null; email?: string | null; phone?: string | null; locale?: string }) {
  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false, status: 404, error: "event_not_found" as const };
  if (!isCurrentLoyaltyTapEligible(event)) return { ok: false, status: 403, error: "event_security_blocked" as const };

  const program = await getActiveProgram(event.tenant_id);
  if (!program) return { ok: false, status: 404, error: "program_not_found" as const };
  const policy = readTapPointsPolicy(program);
  if (!policy) return { ok: false, status: 409, error: 'tap_points_not_configured' as const };

  const member = await getOrCreateMember({
    tenantId: event.tenant_id,
    programId: program.id,
    eventId: String(event.id),
    memberKey: input.memberKey || `event:${event.id}` ,
    consumerId: input.consumerId || null,
    locale: input.locale || "es-AR",
    email: input.email || null,
    phone: input.phone || null,
    country: event.country_code || null,
  });
  if (!member) return { ok: false, status: 403, error: "event_security_blocked" as const };

  const tap = await evaluateLoyaltyForTap({ eventId: String(event.id), memberId: member.id, event, program });
  if (!tap.award) return { ok: true, status: 200, awarded: false, reason: tap.reason, member, memberId: member.id, points: 0 };

  const { rules, points: pointsPerValidTap } = policy;
  const idem = `tap:${event.id}:member:${member.id}`;
  const award = await awardPoints({
    tenantId: event.tenant_id,
    programId: program.id,
    memberId: member.id,
    tapEventId: String(event.id),
    delta: pointsPerValidTap,
    source: "TAP_VALID",
    idempotencyKey: idem,
    reason: "Valid NFC tap",
    metadata: { uid: event.uid_hex || null, result: event.result, tenant: event.tenant_slug },
    expectedRules: rules,
  });
  if (!award.awarded && !award.duplicate) return { ok: false, status: 409, error: 'loyalty_configuration_changed' as const };
  return { ok: true, status: 200, awarded: award.awarded, reason: award.duplicate ? 'already_awarded' : tap.reason, memberId: member.id, points: award.entry?.delta ?? 0 };
}

export async function redeemReward(input: { eventId: string; memberId: string; rewardId: string; locale?: string }) {
  await ensureLoyaltySchema();
  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false, status: 404, error: "event_not_found" as const };
  if (!isCurrentLoyaltyTapEligible(event)) {
    return { ok: false, status: 403, error: "tap_blocked" as const };
  }

  const code = `NX-${randomUUID().split("-")[0].toUpperCase()}`;
  const spendIdem = `redeem:${input.rewardId}:member:${input.memberId}:event:${event.id}`;
  const redemptionRows = await sql/*sql*/`
    WITH current_tag AS MATERIALIZED (
      SELECT tag.id
      FROM events source_event
      JOIN batches bound_batch ON bound_batch.id = source_event.batch_id AND bound_batch.tenant_id = source_event.tenant_id
      JOIN tags tag ON tag.batch_id = source_event.batch_id AND UPPER(tag.uid_hex) = UPPER(source_event.uid_hex)
      WHERE source_event.id = ${String(event.id)}::bigint
        AND source_event.tenant_id = ${event.tenant_id}
        AND UPPER(source_event.result) = ANY(${[...LOYALTY_TAP_RESULTS]}::text[])
        AND BTRIM(COALESCE(source_event.uid_hex, '')) <> ''
        AND tag.status = 'active'
        AND tag.xmin::text = ${event.current_tag_revision ?? null}
        AND COALESCE(tag.lifecycle_state, tag.status::text) = 'active'
        AND NOT EXISTS (SELECT 1 FROM tags ambiguous_tag WHERE ambiguous_tag.batch_id = tag.batch_id AND UPPER(ambiguous_tag.uid_hex) = UPPER(tag.uid_hex) AND ambiguous_tag.id <> tag.id)
      FOR SHARE OF tag
    ), locked AS MATERIALIZED (
      SELECT
        reward.id AS reward_id,
        reward.tenant_id,
        reward.program_id,
        reward.code,
        reward.title,
        reward.points_cost,
        member.id AS member_id,
        member.points_balance AS member_points_balance
      FROM rewards reward
      JOIN loyalty_members member
        ON member.id = ${input.memberId}
       AND member.tenant_id = reward.tenant_id
       AND member.program_id = reward.program_id
      JOIN events source_event ON source_event.id = ${String(event.id)}::bigint
      JOIN current_tag ON true
      LEFT JOIN tag_manual_tamper_overrides manual_override
        ON manual_override.batch_id = source_event.batch_id
       AND UPPER(manual_override.uid_hex) = UPPER(source_event.uid_hex)
      WHERE reward.id = ${input.rewardId}
        AND reward.tenant_id = ${event.tenant_id}
        AND member.status IN ('enrolled', 'verified')
        AND member.points_balance >= reward.points_cost
        AND reward.status = 'active'
        AND reward.starts_at <= now()
        AND (reward.ends_at IS NULL OR reward.ends_at >= now())
        AND (reward.stock_remaining IS NULL OR reward.stock_remaining > 0)
        AND UPPER(COALESCE(source_event.result, '')) NOT IN ('MANUAL_OPENED', 'VALID_MANUAL_OPENED')
        AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_TAMPER_OPENED%'
        AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_OPENED%'
        AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%OPERATOR_DECLARED_OPEN%'
        AND UPPER(BTRIM(COALESCE(manual_override.tamper_status, ''))) NOT IN ('MANUAL_OPENED', 'OPENED')
        AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_TAMPER_OPENED%'
        AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_OPENED%'
        AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%OPERATOR_DECLARED_OPEN%'
      FOR UPDATE OF reward, member
    ),
    reserved_ledger AS MATERIALIZED (
      INSERT INTO points_ledger (
        tenant_id, program_id, member_id, tap_event_id, source, delta,
        balance_after, idempotency_key, reason, metadata_json
      )
      SELECT
        tenant_id, program_id, member_id, ${String(event.id)}, 'REWARD_REDEEMED'::points_source,
        -abs(points_cost), member_points_balance - points_cost, ${spendIdem}, 'Authenticated reward redemption',
        jsonb_build_object('rewardId', reward_id, 'title', title)
      FROM locked
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    ),
    updated_member AS MATERIALIZED (
      UPDATE loyalty_members member
      SET points_balance = member.points_balance - locked.points_cost,
          updated_at = now()
      FROM locked, reserved_ledger
      WHERE member.id = locked.member_id
        AND member.points_balance >= locked.points_cost
      RETURNING member.points_balance
    ),
    updated_reward AS MATERIALIZED (
      UPDATE rewards reward
      SET stock_remaining = CASE WHEN reward.stock_remaining IS NULL THEN NULL ELSE reward.stock_remaining - 1 END,
          updated_at = now()
      FROM locked, reserved_ledger
      WHERE reward.id = locked.reward_id
        AND (reward.stock_remaining IS NULL OR reward.stock_remaining > 0)
      RETURNING reward.id
    ),
    inserted_redemption AS (
      INSERT INTO reward_redemptions (
        tenant_id, program_id, reward_id, member_id, status,
        points_spent, redemption_code, metadata_json
      )
      SELECT
        locked.tenant_id, locked.program_id, locked.reward_id, locked.member_id,
        'confirmed', abs(locked.points_cost), ${code},
        ${JSON.stringify({ locale: input.locale || "es-AR", idempotencyKey: spendIdem })}::jsonb
      FROM locked, updated_member, updated_reward, reserved_ledger
      RETURNING *
    )
    SELECT * FROM inserted_redemption
  `;
  if (!redemptionRows[0]) {
    const existing = await sql/*sql*/`
      SELECT *
      FROM reward_redemptions
      WHERE member_id = ${input.memberId}
        AND reward_id = ${input.rewardId}
        AND metadata_json->>'idempotencyKey' = ${spendIdem}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (existing[0]) return { ok: false, status: 409, error: "already_redeemed" as const, redemption: existing[0] };
    const eligibility = await sql/*sql*/`
      SELECT
        reward.id,
        member.points_balance,
        reward.points_cost,
        reward.stock_remaining
      FROM rewards reward
      LEFT JOIN loyalty_members member
        ON member.id = ${input.memberId}
       AND member.tenant_id = reward.tenant_id
       AND member.program_id = reward.program_id
      WHERE reward.id = ${input.rewardId}
        AND reward.tenant_id = ${event.tenant_id}
      LIMIT 1
    `;
    const row = eligibility[0];
    if (!row) return { ok: false, status: 404, error: "reward_not_found" as const };
    if (Number(row.points_balance || 0) < Number(row.points_cost || 0)) return { ok: false, status: 409, error: "insufficient_points" as const };
    if (row.stock_remaining !== null && Number(row.stock_remaining) <= 0) return { ok: false, status: 409, error: "out_of_stock" as const };
    return { ok: false, status: 409, error: "redemption_conflict" as const };
  }
  return { ok: true, status: 200, redemption: redemptionRows[0] };
}


export async function getLoyaltyMemberById(input: { memberId: string; consumerId: string; tenantId?: string | null }) {
  await ensureLoyaltySchema();
  const rows = await sql/*sql*/`
    SELECT m.id, m.tenant_id, m.program_id, m.consumer_id, m.email, m.phone, m.display_name, m.country, m.preferred_locale,
           m.status, m.points_balance, m.lifetime_points, m.first_tap_at, m.last_tap_at, m.consent_json, m.profile_json,
           p.name AS program_name, p.points_name
    FROM loyalty_members m
    JOIN loyalty_programs p ON p.id = m.program_id
    WHERE m.id = ${input.memberId}
      AND m.consumer_id = ${input.consumerId}
      AND (${input.tenantId || null}::uuid IS NULL OR m.tenant_id = ${input.tenantId || null}::uuid)
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function updateLoyaltyMemberPreferences(input: {
  memberId: string;
  consumerId: string;
  tenantId?: string | null;
  preferredLocale?: string | null;
  displayName?: string | null;
  country?: string | null;
  consent?: Record<string, unknown> | null;
  profilePatch?: Record<string, unknown> | null;
}) {
  const rows = await sql/*sql*/`
    UPDATE loyalty_members
    SET preferred_locale = COALESCE(${input.preferredLocale || null}, preferred_locale),
        display_name = COALESCE(${input.displayName || null}, display_name),
        country = COALESCE(${input.country || null}, country),
        consent_json = CASE WHEN ${input.consent ? JSON.stringify(input.consent) : null}::jsonb IS NULL THEN consent_json ELSE consent_json || ${input.consent ? JSON.stringify(input.consent) : null}::jsonb END,
        profile_json = CASE WHEN ${input.profilePatch ? JSON.stringify(input.profilePatch) : null}::jsonb IS NULL THEN profile_json ELSE profile_json || ${input.profilePatch ? JSON.stringify(input.profilePatch) : null}::jsonb END,
        updated_at = now()
    WHERE id = ${input.memberId}
      AND consumer_id = ${input.consumerId}
      AND (${input.tenantId || null}::uuid IS NULL OR tenant_id = ${input.tenantId || null}::uuid)
    RETURNING *
  `;
  return rows[0] || null;
}

export async function requestLoyaltyMemberDataDeletion(input: { memberId: string; consumerId: string; tenantId?: string | null; reason?: string | null }) {
  const rows = await sql/*sql*/`
    UPDATE loyalty_members
    SET status = 'deleted',
        email = NULL,
        phone = NULL,
        display_name = NULL,
        consent_json = jsonb_set(consent_json, '{dataDeletionRequestedAt}', to_jsonb(now()::text), true),
        profile_json = COALESCE(profile_json, '{}'::jsonb) || jsonb_build_object('deletionReason', ${input.reason || null}, 'deletionRequestedAt', now()::text),
        updated_at = now()
    WHERE id = ${input.memberId}
      AND consumer_id = ${input.consumerId}
      AND (${input.tenantId || null}::uuid IS NULL OR tenant_id = ${input.tenantId || null}::uuid)
    RETURNING id, status, updated_at
  `;
  return rows[0] || null;
}
