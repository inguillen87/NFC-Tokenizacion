import { reportedWalletPoints } from "./consumer-wallet-points-model";

export type ConsumerReward = {
  key: string; id: string; title: string; tenant: string; brand: string;
  program: string | null; description: string | null; cost: number | null; hasClaim: boolean;
  state: "claimed" | "redeemed" | "cancelled" | "expired" | "out_of_stock" | "upcoming" | "inactive" | "locked" | "reported" | "unknown";
  code: string | null; expiresAt: string | null;
};
export type ConsumerRewardsSource = { status: "ready"; items: ConsumerReward[] } | { status: "unavailable"; items: null };
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, max = 240): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
function identifier(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : null;
}
export function rewardTenant(value: unknown): string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{1,60}$/.test(value) ? value : "";
}
function instant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function rewardDateLabel(value: string | null): string {
  return value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(value)) + " (Argentina)" : "No informado";
}
export function buildConsumerRewardsModel(payload: unknown, now: string): ConsumerRewardsSource {
  const envelope = record(payload);
  if (envelope?.ok !== true || !Array.isArray(envelope.items)) return { status: "unavailable", items: null };
  const items: ConsumerReward[] = [];
  const keys = new Set<string>();
  for (const value of envelope.items) {
    const row = record(value);
    const id = identifier(row?.id);
    const tenant = rewardTenant(row?.tenant_slug);
    if (!row || !id || !tenant) return { status: "unavailable", items: null };
    const claimId = identifier(row.claim_id);
    const key = claimId ? `claim-${claimId}` : `reward-${id}`;
    if (keys.has(key)) return { status: "unavailable", items: null };
    keys.add(key);
    const reported = text(row.state);
    const rawClaimState = text(row.claim_status) || (claimId ? reported : null);
    const expiresAt = instant(row.claim_expires_at);
    let state: ConsumerReward["state"] = "unknown";
    if (claimId) {
      if (rawClaimState === "redeemed" || rawClaimState === "cancelled" || rawClaimState === "expired") state = rawClaimState;
      else if (rawClaimState === "claimed" && expiresAt && Number.isFinite(Date.parse(now))) state = Date.parse(expiresAt) <= Date.parse(now) ? "expired" : "claimed";
    } else if (["expired", "out_of_stock", "upcoming", "inactive", "locked", "reported"].includes(reported || "")) state = reported as ConsumerReward["state"];
    else if (reported === "available") state = "reported"; // Legacy availability used a different points ledger, not claim authorization.
    const code = typeof row.redemption_code === "string" && /^[A-Z0-9-]{4,64}$/i.test(row.redemption_code) ? row.redemption_code : null;
    items.push({ key, id, tenant, title: text(row.title) || "Beneficio sin título informado", brand: text(row.tenant_name) || tenant,
      program: text(row.program_name), description: text(row.description, 1200), cost: reportedWalletPoints(claimId ? row.points_spent : row.points_cost),
      hasClaim: Boolean(claimId), state, code: state === "claimed" ? code : null, expiresAt });
  }
  return { status: "ready", items };
}
export function findRequestedVoucher(source: ConsumerRewardsSource, voucher: unknown, requestedTenant: unknown): string | null {
  if (source.status !== "ready" || typeof voucher !== "string" || !/^[a-zA-Z0-9-]{4,64}$/.test(voucher)) return null;
  const tenant = rewardTenant(requestedTenant);
  if (requestedTenant !== undefined && requestedTenant !== "" && !tenant) return null;
  const matches = source.items.filter(item => item.code?.toUpperCase() === voucher.toUpperCase() && (!tenant || item.tenant === tenant));
  return matches.length === 1 ? matches[0].key : null;
}
export const REWARD_STATE_LABELS: Record<ConsumerReward["state"], string> = {
  claimed: "Voucher emitido", redeemed: "Canjeado", cancelled: "Cancelado", expired: "Vencido", out_of_stock: "Sin cupo",
  upcoming: "Próximamente", inactive: "Finalizado", locked: "Requiere condiciones", reported: "Publicado por la marca", unknown: "Estado por confirmar",
};
