import { sql, type SqlExecutor } from "./db";

export const CONSUMER_REWARDS_LIMIT = 100;

export type ConsumerRewardCatalogState = "reported" | "locked" | "upcoming" | "expired" | "out_of_stock" | "inactive";
export type ConsumerRewardClaimStatus = "claimed" | "redeemed" | "cancelled" | "expired";
export type ConsumerRewardItem = {
  id: string;
  title: string;
  description: string | null;
  tenant_slug: string;
  tenant_name: string;
  program_name: string | null;
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
  can_claim: false;
  claim_unavailable_reason: "review_required";
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

  return {
    id: text(row.id, 64) || "",
    title: text(row.title, 300) || "",
    description: text(row.description, 4000),
    tenant_slug: text(row.tenant_slug, 160) || "",
    tenant_name: text(row.tenant_name, 200) || "",
    program_name: text(row.program_name, 200),
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
    can_claim: false,
    claim_unavailable_reason: "review_required",
  };
}

/** One row per own claim; a catalog row only when the reward has no own claim.
 * The latest 100 claims take priority, then remaining slots show own-brand
 * catalog entries. claim_id (or id for catalog) is the stable row identity.
 * Network discovery is deliberately outside this authenticated read contract.
 */
export async function getPrivateConsumerRewards(consumerId: string, executor: SqlExecutor = sql): Promise<ConsumerRewardItem[]> {
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(consumerId)) throw new Error("invalid_consumer_id");

  const rows = await executor/*sql*/`
    SELECT
      reward.id, reward.title, reward.description, reward.points_cost,
      reward.stock_remaining, reward.status AS reward_status,
      reward.starts_at, reward.ends_at,
      tenant.slug AS tenant_slug, tenant.name AS tenant_name,
      program.name AS program_name, program.status::text AS program_status,
      program.start_at AS program_starts_at, program.end_at AS program_ends_at,
      membership.status::text AS membership_status,
      member.member_count AS program_member_count,
      member.points_balance AS program_points_balance,
      member.active AS program_member_active,
      claim.id AS claim_id, claim.status::text AS claim_status,
      claim.created_at AS claimed_at, claim.redemption_code, claim.points_spent,
      claim.metadata_json->'expires_at' AS claim_expires_at_value
    FROM rewards reward
    JOIN tenants tenant ON tenant.id = reward.tenant_id
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
    ORDER BY (claim.id IS NOT NULL) DESC,
      COALESCE(claim.created_at, reward.created_at) DESC,
      reward.id DESC, claim.id DESC
    LIMIT ${CONSUMER_REWARDS_LIMIT}
  `;
  const now = Date.now();
  return rows.map((row) => toConsumerRewardItem(row, now));
}
