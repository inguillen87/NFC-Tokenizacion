import { randomUUID } from "node:crypto";
import { sql } from "./db";

type TapEligibility = {
  award: boolean;
  reason: "awarded" | "blocked_validation" | "cooldown" | "already_awarded";
};

const BLOCKED_RESULTS = new Set(["REPLAY_SUSPECT", "INVALID", "NOT_ACTIVE", "NOT_REGISTERED", "TAMPER", "TAMPER_RISK", "TAMPER_UNVERIFIED", "OPENED", "REVOKED", "BROKEN"]);

export async function getTapEvent(eventId: string) {
  const rows = await sql/*sql*/`
    SELECT e.id, e.tenant_id, e.uid_hex, e.result, e.reason, e.created_at, e.city, e.country_code, t.slug AS tenant_slug
    FROM events e
    JOIN tenants t ON t.id = e.tenant_id
    WHERE e.id = ${eventId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getActiveProgram(tenantId: string) {
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
  if (!input.event || BLOCKED_RESULTS.has(String(input.event.result || "").toUpperCase())) {
    return { award: false, reason: "blocked_validation" };
  }
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

export async function awardPoints(input: { tenantId: string; programId: string; memberId: string; tapEventId?: string; delta: number; source: string; idempotencyKey: string; reason?: string; metadata?: Record<string, unknown> }) {
  const existing = await sql/*sql*/`
    SELECT id, delta, balance_after
    FROM points_ledger
    WHERE idempotency_key = ${input.idempotencyKey}
    LIMIT 1
  `;
  if (existing[0]) return { awarded: false, duplicate: true, entry: existing[0] };

  const balanceRows = await sql/*sql*/`
    UPDATE loyalty_members
    SET
      points_balance = points_balance + ${input.delta},
      lifetime_points = lifetime_points + CASE WHEN ${input.delta} > 0 THEN ${input.delta} ELSE 0 END,
      updated_at = now()
    WHERE id = ${input.memberId}
    RETURNING points_balance
  `;
  const balanceAfter = Number(balanceRows[0]?.points_balance || 0);
  const inserted = await sql/*sql*/`
    INSERT INTO points_ledger (tenant_id, program_id, member_id, tap_event_id, source, delta, balance_after, idempotency_key, reason, metadata_json)
    VALUES (${input.tenantId}, ${input.programId}, ${input.memberId}, ${input.tapEventId || null}, ${input.source}::points_source, ${input.delta}, ${balanceAfter}, ${input.idempotencyKey}, ${input.reason || null}, ${JSON.stringify(input.metadata || {})}::jsonb)
    RETURNING *
  `;
  return { awarded: true, duplicate: false, entry: inserted[0] };
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
  if (!tap.award) return { ok: true, status: 200, awarded: false, reason: tap.reason, member };

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
  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false, status: 404, error: "event_not_found" as const };
  if (BLOCKED_RESULTS.has(String(event.result || "").toUpperCase())) {
    return { ok: false, status: 403, error: "tap_blocked" as const };
  }

  const rewardRows = await sql/*sql*/`
    SELECT r.*, m.points_balance
    FROM rewards r
    JOIN loyalty_members m ON m.id = ${input.memberId}
    WHERE r.id = ${input.rewardId}
      AND r.tenant_id = ${event.tenant_id}
      AND r.program_id = m.program_id
      AND r.status = 'active'
      AND r.starts_at <= now()
      AND (r.ends_at IS NULL OR r.ends_at >= now())
    LIMIT 1
  `;
  const reward = rewardRows[0];
  if (!reward) return { ok: false, status: 404, error: "reward_not_found" as const };
  if (Number(reward.points_balance || 0) < Number(reward.points_cost || 0)) return { ok: false, status: 409, error: "insufficient_points" as const };
  if (reward.stock_remaining !== null && Number(reward.stock_remaining) <= 0) return { ok: false, status: 409, error: "out_of_stock" as const };

  const stockRows = await sql/*sql*/`
    UPDATE rewards
    SET stock_remaining = CASE
      WHEN stock_remaining IS NULL THEN NULL
      WHEN stock_remaining > 0 THEN stock_remaining - 1
      ELSE stock_remaining
    END,
    updated_at = now()
    WHERE id = ${reward.id}
      AND (stock_remaining IS NULL OR stock_remaining > 0)
    RETURNING stock_remaining
  `;
  if (reward.stock_remaining !== null && !stockRows[0]) return { ok: false, status: 409, error: "out_of_stock" as const };

  const spendIdem = `redeem:${reward.id}:member:${input.memberId}:event:${event.id}`;
  const spend = await awardPoints({
    tenantId: event.tenant_id,
    programId: reward.program_id,
    memberId: input.memberId,
    tapEventId: String(event.id),
    delta: -Math.abs(Number(reward.points_cost || 0)),
    source: "REWARD_REDEEMED",
    idempotencyKey: spendIdem,
    reason: `Redeem ${reward.code}`,
    metadata: { rewardId: reward.id, title: reward.title },
  });
  if (spend.duplicate) return { ok: false, status: 409, error: "already_redeemed" as const };

  const code = `NX-${randomUUID().split("-")[0].toUpperCase()}`;
  const redemptionRows = await sql/*sql*/`
    INSERT INTO reward_redemptions (tenant_id, program_id, reward_id, member_id, status, points_spent, redemption_code, metadata_json)
    VALUES (${event.tenant_id}, ${reward.program_id}, ${reward.id}, ${input.memberId}, 'confirmed', ${Math.abs(Number(reward.points_cost || 0))}, ${code}, ${JSON.stringify({ locale: input.locale || "es-AR" })}::jsonb)
    RETURNING *
  `;
  return { ok: true, status: 200, redemption: redemptionRows[0] };
}


export async function getLoyaltyMemberById(input: { memberId: string; tenantId?: string | null }) {
  const rows = await sql/*sql*/`
    SELECT m.id, m.tenant_id, m.program_id, m.consumer_id, m.email, m.phone, m.display_name, m.country, m.preferred_locale,
           m.status, m.points_balance, m.lifetime_points, m.first_tap_at, m.last_tap_at, m.consent_json, m.profile_json,
           p.name AS program_name, p.points_name
    FROM loyalty_members m
    JOIN loyalty_programs p ON p.id = m.program_id
    WHERE m.id = ${input.memberId}
      AND (${input.tenantId || null}::uuid IS NULL OR m.tenant_id = ${input.tenantId || null}::uuid)
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function updateLoyaltyMemberPreferences(input: {
  memberId: string;
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
      AND (${input.tenantId || null}::uuid IS NULL OR tenant_id = ${input.tenantId || null}::uuid)
    RETURNING *
  `;
  return rows[0] || null;
}

export async function requestLoyaltyMemberDataDeletion(input: { memberId: string; tenantId?: string | null; reason?: string | null }) {
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
      AND (${input.tenantId || null}::uuid IS NULL OR tenant_id = ${input.tenantId || null}::uuid)
    RETURNING id, status, updated_at
  `;
  return rows[0] || null;
}
