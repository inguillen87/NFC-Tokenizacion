import { sql, type SqlExecutor } from "./db";

export const CONSUMER_REWARDS_LIMIT = 100;
export const CONSUMER_PORTAL_CLAIM_INTENT = "portal-first-reservation.v1" as const;

export type ConsumerRewardCatalogState = "reported" | "locked" | "upcoming" | "expired" | "out_of_stock" | "inactive";
export type ConsumerRewardClaimStatus = "claimed" | "redeemed" | "cancelled" | "expired";
export type ConsumerRewardUnavailableReason =
  | "age_verification_required" | "insufficient_program_points" | "brand_connection_required"
  | "program_participation_required" | "brand_conditions_review" | "availability_review" | "account_review";
export type ConsumerRewardItem = {
  id: string;
  title: string;
  description: string | null;
  tenant_slug: string;
  tenant_name: string;
  program_name: string | null;
  program_points_balance?: number | null;
  points_cost: number | null;
  points_spent: number | null;
  stock_remaining: number | null;
  state: ConsumerRewardCatalogState | ConsumerRewardClaimStatus;
  catalog_state: ConsumerRewardCatalogState;
  claim_id: string | null;
  claim_status: ConsumerRewardClaimStatus | null;
  claim_expires_at: string | null;
  claimed_at: string | null;
  redemption_code: string | null;
  can_claim: boolean;
  /** Advertised only for the persisted, supported portal reservation capability. */
  claimIntent?: typeof CONSUMER_PORTAL_CLAIM_INTENT;
  claim_unavailable_reason: "review_required" | null;
  /** Read-only explanations; they never authorize a reservation or override an own voucher. */
  claim_unavailable_reasons?: ConsumerRewardUnavailableReason[];
};

function text(value: unknown, maxLength: number): string | null {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || null : null;
}

function integer(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function timestamp(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Staff/public claims use metadata.expires_at, otherwise created_at + 48 hours.
 * Invalid explicit metadata must not silently acquire a new validity window.
 * Parse it outside SQL so one malformed historical claim cannot break the list.
 */
export function consumerRewardClaimExpiresAt(explicitValue: unknown, createdAt: unknown): string | null {
  if (explicitValue !== null && explicitValue !== undefined) {
    if (typeof explicitValue !== "string") return null;
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.exec(explicitValue);
    if (!parts) return null;
    const [, year, month, day, hour, minute, second] = parts.map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) return null;
    return timestamp(explicitValue);
  }
  const created = timestamp(createdAt);
  return created ? timestamp(new Date(Date.parse(created) + 48 * 60 * 60 * 1000)) : null;
}

function catalogState(row: Record<string, unknown>, now: number): ConsumerRewardCatalogState {
  if (row.reward_status !== "active" || row.program_status !== "active") return "inactive";
  const endsAt = timestamp(row.ends_at);
  const programEndsAt = timestamp(row.program_ends_at);
  if ((endsAt && Date.parse(endsAt) <= now) || (programEndsAt && Date.parse(programEndsAt) <= now)) return "expired";
  const startsAt = timestamp(row.starts_at);
  const programStartsAt = timestamp(row.program_starts_at);
  if ((startsAt && Date.parse(startsAt) > now) || (programStartsAt && Date.parse(programStartsAt) > now)) return "upcoming";
  const stock = integer(row.stock_remaining);
  if (stock !== null && stock <= 0) return "out_of_stock";
  const cost = integer(row.points_cost);
  const balance = integer(row.program_points_balance);
  if (row.membership_status !== "active" || integer(row.program_member_count) !== 1 || row.program_member_active !== true
    || cost === null || cost < 0 || balance === null || balance < cost) return "locked";
  // A program balance alone proves neither age/segment eligibility nor the
  // applicable redemption limits, consent, fulfillment or fresh-tap policies.
  return "reported";
}

function unavailableReasons(row: Record<string, unknown>, now: number): ConsumerRewardUnavailableReason[] {
  const reasons = new Set<ConsumerRewardUnavailableReason>();
  const accountAllowed = typeof row.consumer_account_status === "string"
    && ["anonymous", "registered", "verified"].includes(row.consumer_account_status);
  if (!accountAllowed) reasons.add("account_review");

  if (row.program_age_gate_required === true || row.reward_age_gate_required === true) reasons.add("age_verification_required");
  if (row.program_identity_matches !== true
    || (row.program_age_gate_required !== true && row.program_age_gate_required !== false)
    || (row.reward_age_gate_required !== true && row.reward_age_gate_required !== false)
    || row.reward_eligibility_unrestricted !== true || row.reward_fulfillment_unrestricted !== true
    || row.reward_member_limit_unrestricted !== true) reasons.add("brand_conditions_review");

  if (row.membership_identity_matches === false
    || (row.membership_identity_matches === true && typeof row.membership_status === "string"
      && ["invited", "paused", "blocked", "left"].includes(row.membership_status))) {
    reasons.add("brand_connection_required");
  } else if (row.membership_identity_matches !== true || row.membership_status !== "active") {
    reasons.add("account_review");
  }

  const memberCount = integer(row.program_member_count);
  const cost = integer(row.points_cost);
  const balance = integer(row.program_points_balance);
  if (row.program_identity_matches === true && (memberCount === 0 || (memberCount === 1 && row.program_member_active === false))) {
    reasons.add("program_participation_required");
  } else if (row.program_identity_matches !== true || memberCount !== 1 || row.program_member_active !== true) {
    reasons.add("account_review");
  }
  if (cost === null || cost < 0 || (memberCount === 1 && (balance === null || balance < 0))) {
    reasons.add("account_review");
  } else if (row.program_identity_matches === true && memberCount === 1 && row.program_member_active === true
    && balance !== null && balance < cost) {
    reasons.add("insufficient_program_points");
  }

  const startsAt = timestamp(row.starts_at);
  const programStartsAt = timestamp(row.program_starts_at);
  const endsAt = timestamp(row.ends_at);
  const programEndsAt = timestamp(row.program_ends_at);
  const stock = integer(row.stock_remaining);
  if (row.reward_status !== "active" || row.program_status !== "active"
    || !startsAt || !programStartsAt || Date.parse(startsAt) > now || Date.parse(programStartsAt) > now
    || (row.ends_at !== null && (!endsAt || Date.parse(endsAt) <= now))
    || (row.program_ends_at !== null && (!programEndsAt || Date.parse(programEndsAt) <= now))
    || (row.stock_remaining !== null && (stock === null || stock <= 0))) reasons.add("availability_review");

  // A future/unsupported persisted condition remains a review, never an empty grant.
  if (!reasons.size) reasons.add("brand_conditions_review");
  return [...reasons];
}

export function toConsumerRewardItem(row: Record<string, unknown>, now = Date.now()): ConsumerRewardItem {
  const catalog = catalogState(row, now);
  const claimId = text(row.claim_id, 64);
  const claimedAt = claimId ? timestamp(row.claimed_at) : null;
  const expiresAt = claimId ? consumerRewardClaimExpiresAt(row.claim_expires_at_value, row.claimed_at) : null;
  const knownStatus = ["claimed", "redeemed", "cancelled", "expired"].includes(String(row.claim_status));
  let claimStatus = claimId && knownStatus ? row.claim_status as ConsumerRewardClaimStatus : null;
  if (claimStatus === "claimed" && expiresAt && Date.parse(expiresAt) <= now) claimStatus = "expired";
  const state = claimId
    ? claimStatus === "claimed" ? expiresAt ? "claimed" : "locked" : claimStatus || "locked"
    : catalog;
  const cost = integer(row.points_cost);
  const spent = claimId ? integer(row.points_spent) : null;
  const programBalance = integer(row.program_points_balance);
  // PostgreSQL proves exact persisted authority/time/policy; display state alone never grants it.
  const canClaim = !claimId && catalog === "reported" && row.portal_claim_eligible === true;

  return {
    id: text(row.id, 64) || "",
    title: text(row.title, 300) || "",
    description: text(row.description, 4000),
    tenant_slug: text(row.tenant_slug, 160) || "",
    tenant_name: text(row.tenant_name, 200) || "",
    program_name: text(row.program_name, 200),
    program_points_balance: row.program_identity_matches === true && integer(row.program_member_count) === 1 && programBalance !== null && programBalance >= 0 ? programBalance : null,
    points_cost: cost !== null && cost >= 0 ? cost : null,
    points_spent: spent !== null && spent >= 0 ? spent : null,
    stock_remaining: integer(row.stock_remaining),
    state,
    catalog_state: catalog,
    claim_id: claimId,
    claim_status: claimStatus,
    claim_expires_at: expiresAt,
    claimed_at: claimedAt,
    redemption_code: state === "claimed" ? text(row.redemption_code, 160) : null,
    can_claim: canClaim,
    ...(canClaim ? { claimIntent: CONSUMER_PORTAL_CLAIM_INTENT } : {}),
    claim_unavailable_reason: canClaim ? null : "review_required",
    ...(!claimId ? { claim_unavailable_reasons: canClaim ? [] : unavailableReasons(row, now) } : {}),
  };
}

/** One row per own claim; a catalog row only when the reward has no own claim.
 * The latest 100 claims take priority, then remaining slots show own-brand
 * catalog entries. claim_id (or id for catalog) is the stable row identity.
 * One own enrolled/verified program member may also read its current published
 * catalog without creating a CRM membership. An existing nonactive membership
 * cannot use that path. This read relationship grants no claim or consent.
 * Network discovery is deliberately outside this authenticated read contract.
 */
export async function getPrivateConsumerRewardsSnapshot(consumerId: string, executor: SqlExecutor = sql): Promise<{ items: ConsumerRewardItem[]; checkedAt: string }> {
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(consumerId)) throw new Error("invalid_consumer_id");

  const rows = await executor/*sql*/`
    SELECT
      reward.id, reward.title, reward.description, reward.points_cost,
      reward.stock_remaining, reward.status AS reward_status,
      reward.starts_at, reward.ends_at,
      tenant.slug AS tenant_slug, tenant.name AS tenant_name,
      program.name AS program_name, program.status::text AS program_status,
      (program.id IS NOT NULL) AS program_identity_matches,
      program.start_at AS program_starts_at, program.end_at AS program_ends_at,
      membership.status::text AS membership_status,
      member.member_count AS program_member_count,
      member.points_balance AS program_points_balance,
      member.active AS program_member_active,
      account.status::text AS consumer_account_status,
      (membership.tenant_id IS NOT NULL) AS membership_identity_matches,
      program.age_gate_required AS program_age_gate_required,
      reward.requires_age_gate AS reward_age_gate_required,
      (reward.eligibility_json = '{}'::jsonb) AS reward_eligibility_unrestricted,
      (reward.fulfillment_json = '{}'::jsonb) AS reward_fulfillment_unrestricted,
      (reward.redemption_limit_per_member IS NULL) AS reward_member_limit_unrestricted,
      CASE WHEN claim.id IS NULL
        AND account.status IN ('anonymous', 'registered', 'verified')
        AND program.id IS NOT NULL AND program.status = 'active'
        AND program.start_at <= statement_timestamp()
        AND (program.end_at IS NULL OR program.end_at > statement_timestamp())
        AND membership.status = 'active' AND reward.status = 'active'
        AND reward.starts_at <= statement_timestamp()
        AND (reward.ends_at IS NULL OR reward.ends_at > statement_timestamp())
        AND program.age_gate_required = false AND reward.requires_age_gate = false
        AND reward.eligibility_json = '{}'::jsonb
        AND reward.redemption_limit_per_member IS NULL
        AND reward.fulfillment_json = '{}'::jsonb
        AND member.member_count = 1 AND member.active IS TRUE
        AND reward.points_cost >= 0 AND member.points_balance >= reward.points_cost
        AND (reward.stock_remaining IS NULL OR reward.stock_remaining > 0)
        AND NOT EXISTS (SELECT 1 FROM consumer_reward_claims own_claim
          WHERE own_claim.consumer_id = ${consumerId}::uuid AND own_claim.reward_id = reward.id)
        THEN true ELSE false END AS portal_claim_eligible,
      claim.id AS claim_id, claim.status::text AS claim_status,
      claim.created_at AS claimed_at, claim.redemption_code, claim.points_spent,
      claim.metadata_json->'expires_at' AS claim_expires_at_value
    FROM rewards reward
    JOIN tenants tenant ON tenant.id = reward.tenant_id
    LEFT JOIN consumers account ON account.id = ${consumerId}::uuid
    LEFT JOIN loyalty_programs program
      ON program.id = reward.program_id AND program.tenant_id = reward.tenant_id
    LEFT JOIN tenant_consumer_memberships membership
      ON membership.tenant_id = reward.tenant_id AND membership.consumer_id = ${consumerId}::uuid
    LEFT JOIN consumer_reward_claims claim
      ON claim.reward_id = reward.id AND claim.tenant_id = reward.tenant_id
     AND claim.consumer_id = ${consumerId}::uuid
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS member_count, min(lm.points_balance) AS points_balance,
        bool_and(lm.status IN ('enrolled', 'verified')) AS active
      FROM loyalty_members lm
      WHERE lm.tenant_id = reward.tenant_id AND lm.program_id = reward.program_id
        AND lm.consumer_id = ${consumerId}::uuid
    ) member ON true
    WHERE claim.id IS NOT NULL
       OR (membership.status IN ('active', 'paused') AND reward.status = 'active')
       OR (membership.tenant_id IS NULL
           AND program.id IS NOT NULL AND program.status = 'active'
           AND program.start_at <= statement_timestamp()
           AND (program.end_at IS NULL OR program.end_at > statement_timestamp())
           AND reward.status = 'active' AND reward.starts_at <= statement_timestamp()
           AND (reward.ends_at IS NULL OR reward.ends_at > statement_timestamp())
           AND member.member_count = 1 AND member.active IS TRUE)
    ORDER BY (claim.id IS NOT NULL) DESC,
      COALESCE(claim.created_at, reward.created_at) DESC,
      reward.id DESC, claim.id DESC
    LIMIT ${CONSUMER_REWARDS_LIMIT}
  `;
  // One application-server projection instant, sampled after the read as before.
  // This is not the SQL statement timestamp or a grant of future claim validity.
  const now = Date.now();
  return { items: rows.map((row) => toConsumerRewardItem(row, now)), checkedAt: new Date(now).toISOString() };
}

/** Preserve the existing array contract for private readers and SQL harnesses. */
export async function getPrivateConsumerRewards(consumerId: string, executor: SqlExecutor = sql): Promise<ConsumerRewardItem[]> {
  return (await getPrivateConsumerRewardsSnapshot(consumerId, executor)).items;
}
