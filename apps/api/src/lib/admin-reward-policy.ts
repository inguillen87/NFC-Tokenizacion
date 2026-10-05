export const ADMIN_REWARD_TYPES = ["DISCOUNT", "EXPERIENCE", "TASTING", "TOUR", "FREE_SHIPPING", "EARLY_ACCESS", "DIGITAL_COLLECTIBLE", "CONTENT_UNLOCK", "GIFT", "SERVICE", "WARRANTY_EXTENSION", "REFILL", "VIP_ACCESS", "WINE_BOTTLE", "WINE_BOX"] as const;
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const MAX_INTEGER = 2_147_483_647;

export class AdminRewardError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export type AdminRewardCommand = {
  rewardId?: string; programId?: string; code: string; title: string;
  description?: string; type?: string; pointsCost?: number; stockTotal?: number;
  stockRemaining?: number; imageUrl?: string; requiresAgeGate?: boolean;
  networkVisible?: boolean; status?: string;
};

function text(value: unknown, field: string, max: number, required = false): string {
  const forbidden = field === "description" ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (typeof value !== "string" || forbidden.test(value)) throw new AdminRewardError(`invalid_${field}`);
  const result = value.trim();
  if (result.length > max) throw new AdminRewardError(`invalid_${field}`);
  if (required && !result) throw new AdminRewardError(`${field}_required`);
  return result;
}
function integer(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_INTEGER) throw new AdminRewardError(`invalid_${field}`);
  return parsed;
}
function identifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new AdminRewardError(`invalid_${field}`);
  return value.toLowerCase();
}

/** Validation happens before any tenant/program query or write. Omitted fields
 * stay omitted so older clients cannot clear saved policy by leaving it out. */
export function parseAdminRewardCommand(raw: unknown): AdminRewardCommand {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AdminRewardError("invalid_reward_body");
  const body = raw as Record<string, unknown>;
  const command: AdminRewardCommand = {
    code: text(body.code, "code", 100, true).toUpperCase(),
    title: text(body.title, "title", 300, true),
  };
  if (body.reward_id !== undefined) command.rewardId = identifier(body.reward_id, "reward_id");
  if (body.program_id !== undefined) command.programId = identifier(body.program_id, "program_id");
  if (command.rewardId && !command.programId) throw new AdminRewardError("reward_program_required");
  if (body.description !== undefined) command.description = text(body.description, "description", 4000);
  if (body.image_url !== undefined) command.imageUrl = text(body.image_url, "image_url", 2048);
  if (body.type !== undefined) {
    command.type = text(body.type, "reward_type", 40).toUpperCase();
    if (!(ADMIN_REWARD_TYPES as readonly string[]).includes(command.type)) throw new AdminRewardError("invalid_reward_type");
  }
  const points = body.points_cost !== undefined ? body.points_cost : body.points;
  if (points !== undefined) command.pointsCost = integer(points, "points_cost");
  if (body.stock_total !== undefined) command.stockTotal = integer(body.stock_total, "stock_total");
  if (body.stock_remaining !== undefined) {
    command.stockRemaining = integer(body.stock_remaining, "stock_remaining");
    if (command.stockTotal === undefined || command.stockRemaining > command.stockTotal) throw new AdminRewardError("invalid_stock_remaining");
  }
  for (const [field, key] of [["requires_age_gate", "requiresAgeGate"], ["network_visible", "networkVisible"]] as const) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "boolean") throw new AdminRewardError(`invalid_${field}`);
      command[key] = body[field];
    }
  }
  if (body.status !== undefined) {
    command.status = text(body.status, "reward_status", 20).toLowerCase();
    if (!["active", "paused", "draft", "archived"].includes(command.status)) throw new AdminRewardError("invalid_reward_status");
  }
  return command;
}

/** Mirrors the atomic stock rule for review and isolated concurrency fixtures.
 * A total change adjusts remaining stock by its delta, preserving consumption. */
export function adjustedAdminRewardStock(currentTotal: unknown, currentRemaining: unknown, nextTotal: number): number {
  if (typeof currentTotal !== "number" || typeof currentRemaining !== "number"
    || !Number.isSafeInteger(currentTotal) || !Number.isSafeInteger(currentRemaining)
    || currentTotal < 0 || currentRemaining < 0 || currentRemaining > currentTotal) throw new AdminRewardError("reward_stock_unavailable", 409);
  const consumed = currentTotal - currentRemaining;
  if (nextTotal < consumed) throw new AdminRewardError("stock_total_below_consumed", 409);
  return nextTotal - consumed;
}
