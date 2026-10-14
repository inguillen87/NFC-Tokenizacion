export const ADMIN_REWARD_RESERVATION_REQUIREMENTS_VERSION = "portal-reservation-requirements.v1" as const;

export type AdminRewardReservationRequirements = {
  version: typeof ADMIN_REWARD_RESERVATION_REQUIREMENTS_VERSION;
  program: { name: string | null; age_gate_required: boolean | null; association_confirmed: boolean | null };
  starts_at: string | null;
  ends_at: string | null;
  requires_age_gate: boolean | null;
  eligibility_policy_review: boolean | null;
  fulfillment_policy_review: boolean | null;
  redemption_limit_per_member: number | null;
  /** true with a null limit means persisted unlimited; false means unknown. */
  redemption_limit_known: boolean;
};

function boolean(value: unknown): boolean | null {
  return value === true || value === false ? value : null;
}

function timestamp(value: unknown): string | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value !== "string") return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return null;
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function limit(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 2_147_483_647 ? parsed : null;
}

/** Explicit, read-only projection of persisted reservation requirements.
 * No policy JSON, consumer information or capability is exposed to the editor.
 */
export function toAdminRewardReadItem(row: Record<string, unknown>) {
  const memberLimit = limit(row.reservation_member_limit);
  const programMatches = boolean(row.reservation_program_matches);
  const requirements: AdminRewardReservationRequirements = {
    version: ADMIN_REWARD_RESERVATION_REQUIREMENTS_VERSION,
    program: {
      name: programMatches === true && typeof row.reservation_program_name === "string" ? row.reservation_program_name.trim().slice(0, 200) || null : null,
      age_gate_required: programMatches === true ? boolean(row.reservation_program_age_gate) : null,
      association_confirmed: programMatches,
    },
    starts_at: timestamp(row.reservation_starts_at),
    ends_at: timestamp(row.reservation_ends_at),
    requires_age_gate: boolean(row.requires_age_gate),
    eligibility_policy_review: boolean(row.reservation_eligibility_review),
    fulfillment_policy_review: boolean(row.reservation_fulfillment_review),
    redemption_limit_per_member: memberLimit,
    redemption_limit_known: row.reservation_member_limit === null || memberLimit !== null,
  };
  return {
    id: row.id, program_id: row.program_id, tenant_slug: row.tenant_slug,
    code: row.code, title: row.title, points: row.points, status: row.status,
    description: row.description, type: row.type, image_url: row.image_url,
    stock_total: row.stock_total, stock_remaining: row.stock_remaining,
    requires_age_gate: row.requires_age_gate, network_visible: row.network_visible,
    reservation_requirements: requirements,
  };
}
