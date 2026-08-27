import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { ensureLoyaltySchema } from "./loyalty-schema";
import { evaluateTapCommercialRights } from "./tap-commercial-rights";

type TapEligibility = {
  award: boolean;
  reason: "awarded" | "blocked_validation" | "cooldown" | "already_awarded";
};

const BLOCKED_RESULTS = new Set(["REPLAY_SUSPECT", "INVALID", "NOT_ACTIVE", "NOT_REGISTERED", "TAMPER", "TAMPER_RISK", "TAMPER_UNVERIFIED", "OPENED", "REVOKED", "BROKEN"]);

export async function getTapEvent(eventId: string) {
  const rows = await sql/*sql*/`
    SELECT e.id, e.tenant_id, e.batch_id, e.uid_hex, e.sdm_read_ctr, e.result, e.reason, e.created_at, e.city, e.country_code, e.geo_lat, e.geo_lng,
           manual_override.tamper_status AS manual_tamper_status,
           manual_override.reason AS manual_tamper_reason,
           manual_override.source AS manual_tamper_source,
           manual_override.updated_at AS manual_tamper_updated_at,
           t.slug AS tenant_slug, b.bid
    FROM events e
    JOIN tenants t ON t.id = e.tenant_id
    LEFT JOIN batches b ON b.id = e.batch_id
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
    SELECT *
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
  const rows = await sql/*sql*/`
    INSERT INTO loyalty_members (tenant_id, program_id, event_id, member_key, consumer_id, preferred_locale, email, phone, display_name, country, status, first_tap_at, last_tap_at)
    VALUES (${input.tenantId}, ${input.programId}, ${input.eventId}, ${input.memberKey}, ${input.consumerId || null}, ${input.locale || "es-AR"}, ${input.email || null}, ${input.phone || null}, ${input.displayName || null}, ${input.country || null}, ${input.email || input.phone || input.consumerId ? "enrolled" : "anonymous"}, now(), now())
    ON CONFLICT (program_id, member_key)
    DO UPDATE SET
      event_id = EXCLUDED.event_id,
      consumer_id = COALESCE(EXCLUDED.consumer_id, loyalty_members.consumer_id),
      preferred_locale = EXCLUDED.preferred_locale,
      email = COALESCE(EXCLUDED.email, loyalty_members.email),
      phone = COALESCE(EXCLUDED.phone, loyalty_members.phone),
      display_name = COALESCE(EXCLUDED.display_name, loyalty_members.display_name),
      country = COALESCE(EXCLUDED.country, loyalty_members.country),
      status = CASE WHEN EXCLUDED.email IS NOT NULL OR EXCLUDED.phone IS NOT NULL OR EXCLUDED.consumer_id IS NOT NULL THEN 'enrolled'::loyalty_member_status ELSE loyalty_members.status END,
      updated_at = now(),
      last_tap_at = now()
    RETURNING *
  `;
  return rows[0];
}

export async function evaluateLoyaltyForTap(input: { eventId: string; memberId: string; program: any; event: any }): Promise<TapEligibility> {
  const commercialRights = evaluateTapCommercialRights(input.event);
  if (!input.event || !commercialRights.allowed || BLOCKED_RESULTS.has(String(input.event.result || "").toUpperCase())) {
    return { award: false, reason: "blocked_validation" };
  }
  await ensureLoyaltySchema();
  const idem = `tap:${input.eventId}:member:${input.memberId}`;
  const idemRows = await sql/*sql*/`SELECT id FROM points_ledger WHERE idempotency_key = ${idem} LIMIT 1`;
  if (idemRows[0]) return { award: false, reason: "already_awarded" };

  const rules = typeof input.program?.rules_json === "string" ? JSON.parse(input.program.rules_json || "{}") : (input.program?.rules_json || {});
  const cooldownSeconds = Number(rules.cooldownSeconds || 3600);
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

export async function awardPoints(input: { tenantId: string; programId: string; memberId: string; tapEventId?: string; delta: number; source: string; idempotencyKey: string; reason?: string; metadata?: Record<string, unknown> }) {
  await ensureLoyaltySchema();
  const delta = Number(input.delta);
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) {
    return { awarded: false, duplicate: false, entry: null, error: "invalid_points_delta" as const };
  }
  const idempotencyKey = String(input.idempotencyKey || "").trim().slice(0, 240);
  if (!idempotencyKey) return { awarded: false, duplicate: false, entry: null, error: "idempotency_key_required" as const };
  const rows = await sql/*sql*/`
    WITH tap_rights AS MATERIALIZED (
      SELECT true AS allowed
      WHERE ${delta} < 0
         OR ${input.tapEventId || null}::bigint IS NULL
         OR EXISTS (
           SELECT 1
           FROM events source_event
           LEFT JOIN tag_manual_tamper_overrides manual_override
             ON manual_override.batch_id = source_event.batch_id
            AND UPPER(manual_override.uid_hex) = UPPER(source_event.uid_hex)
           WHERE source_event.id = ${input.tapEventId || null}::bigint
             AND UPPER(COALESCE(source_event.result, '')) NOT IN ('MANUAL_OPENED', 'VALID_MANUAL_OPENED')
             AND UPPER(COALESCE(source_event.reason, '')) NOT LIKE '%MANUAL_TAMPER_OPENED%'
             AND UPPER(COALESCE(source_event.reason, '')) NOT LIKE '%MANUAL_OPENED%'
             AND UPPER(COALESCE(manual_override.tamper_status, '')) NOT IN ('MANUAL_OPENED', 'OPENED')
             AND UPPER(COALESCE(manual_override.reason, '')) NOT LIKE '%MANUAL_TAMPER_OPENED%'
             AND UPPER(COALESCE(manual_override.reason, '')) NOT LIKE '%MANUAL_OPENED%'
         )
    ),
    locked_member AS MATERIALIZED (
      SELECT id, points_balance
      FROM loyalty_members
      JOIN tap_rights ON tap_rights.allowed = true
      WHERE id = ${input.memberId}
        AND tenant_id = ${input.tenantId}
        AND program_id = ${input.programId}
        AND (${delta} >= 0 OR points_balance >= abs(${delta}))
      FOR UPDATE
    ),
    reserved_ledger AS MATERIALIZED (
      INSERT INTO points_ledger (
        tenant_id, program_id, member_id, tap_event_id, source, delta,
        balance_after, idempotency_key, reason, metadata_json
      )
      SELECT
        ${input.tenantId}, ${input.programId}, id, ${input.tapEventId || null},
        ${input.source}::points_source, ${delta}, 0, ${idempotencyKey},
        ${input.reason || null}, ${JSON.stringify(input.metadata || {})}::jsonb
      FROM locked_member
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    ),
    updated_member AS MATERIALIZED (
      UPDATE loyalty_members member
      SET points_balance = member.points_balance + ${delta},
          lifetime_points = member.lifetime_points + CASE WHEN ${delta} > 0 THEN ${delta} ELSE 0 END,
          updated_at = now()
      FROM locked_member, reserved_ledger
      WHERE member.id = locked_member.id
      RETURNING member.points_balance
    ),
    finalized_ledger AS (
      UPDATE points_ledger ledger
      SET balance_after = updated_member.points_balance
      FROM reserved_ledger, updated_member
      WHERE ledger.id = reserved_ledger.id
      RETURNING ledger.*
    )
    SELECT * FROM finalized_ledger
  `;
  if (rows[0]) return { awarded: true, duplicate: false, entry: rows[0] };
  const existing = await sql/*sql*/`
    SELECT id, delta, balance_after
    FROM points_ledger
    WHERE idempotency_key = ${idempotencyKey}
      AND member_id = ${input.memberId}
      AND tenant_id = ${input.tenantId}
      AND program_id = ${input.programId}
    LIMIT 1
  `;
  if (existing[0]) return { awarded: false, duplicate: true, entry: existing[0] };
  return { awarded: false, duplicate: false, entry: null, error: delta < 0 ? "insufficient_points" as const : "member_not_found" as const };
}

export async function claimTapPoints(input: { eventId: string; memberKey?: string; consumerId?: string | null; email?: string | null; phone?: string | null; locale?: string }) {
  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false, status: 404, error: "event_not_found" as const };

  const program = await getActiveProgram(event.tenant_id);
  if (!program) return { ok: false, status: 404, error: "program_not_found" as const };

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

  const tap = await evaluateLoyaltyForTap({ eventId: String(event.id), memberId: member.id, event, program });
  if (!tap.award) return { ok: true, status: 200, awarded: false, reason: tap.reason, member, memberId: member.id, points: 0 };

  const rules = typeof program?.rules_json === "string" ? JSON.parse(program.rules_json || "{}") : (program?.rules_json || {});
  const pointsPerValidTap = Number(rules.pointsPerValidTap || 10);
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
  });
  return { ok: true, status: 200, awarded: award.awarded, reason: tap.reason, memberId: member.id, points: award.entry?.delta || 0 };
}

export async function redeemReward(input: { eventId: string; memberId: string; rewardId: string; locale?: string }) {
  await ensureLoyaltySchema();
  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false, status: 404, error: "event_not_found" as const };
  if (!evaluateTapCommercialRights(event).allowed || BLOCKED_RESULTS.has(String(event.result || "").toUpperCase())) {
    return { ok: false, status: 403, error: "tap_blocked" as const };
  }

  const code = `NX-${randomUUID().split("-")[0].toUpperCase()}`;
  const spendIdem = `redeem:${input.rewardId}:member:${input.memberId}:event:${event.id}`;
  const redemptionRows = await sql/*sql*/`
    WITH locked AS MATERIALIZED (
      SELECT
        reward.id AS reward_id,
        reward.tenant_id,
        reward.program_id,
        reward.code,
        reward.title,
        reward.points_cost,
        member.id AS member_id
      FROM rewards reward
      JOIN loyalty_members member
        ON member.id = ${input.memberId}
       AND member.tenant_id = reward.tenant_id
       AND member.program_id = reward.program_id
      JOIN events source_event ON source_event.id = ${String(event.id)}::bigint
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
        AND UPPER(COALESCE(source_event.reason, '')) NOT LIKE '%MANUAL_TAMPER_OPENED%'
        AND UPPER(COALESCE(source_event.reason, '')) NOT LIKE '%MANUAL_OPENED%'
        AND UPPER(COALESCE(manual_override.tamper_status, '')) NOT IN ('MANUAL_OPENED', 'OPENED')
        AND UPPER(COALESCE(manual_override.reason, '')) NOT LIKE '%MANUAL_TAMPER_OPENED%'
        AND UPPER(COALESCE(manual_override.reason, '')) NOT LIKE '%MANUAL_OPENED%'
      FOR UPDATE OF reward, member
    ),
    reserved_ledger AS MATERIALIZED (
      INSERT INTO points_ledger (
        tenant_id, program_id, member_id, tap_event_id, source, delta,
        balance_after, idempotency_key, reason, metadata_json
      )
      SELECT
        tenant_id, program_id, member_id, ${String(event.id)}, 'REWARD_REDEEMED'::points_source,
        -abs(points_cost), 0, ${spendIdem}, 'Authenticated reward redemption',
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
    finalized_ledger AS MATERIALIZED (
      UPDATE points_ledger ledger
      SET balance_after = updated_member.points_balance
      FROM reserved_ledger, updated_member
      WHERE ledger.id = reserved_ledger.id
      RETURNING ledger.id
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
      FROM locked, updated_member, updated_reward, finalized_ledger
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
