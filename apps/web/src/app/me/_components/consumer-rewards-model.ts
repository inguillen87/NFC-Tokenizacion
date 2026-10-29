import { reportedWalletPoints } from "./consumer-wallet-points-model";

export const CONSUMER_REWARD_RESERVATION_INTENT = "portal-first-reservation.v1" as const;

export const REWARD_UNAVAILABLE_REASONS = [
  "age_verification_required", "insufficient_program_points", "brand_connection_required",
  "program_participation_required", "brand_conditions_review", "availability_review", "account_review",
] as const;
export type ConsumerRewardUnavailableReason = typeof REWARD_UNAVAILABLE_REASONS[number];

export type ConsumerReward = {
  key: string; id: string; title: string; tenant: string; brand: string;
  program: string | null; programBalance?: number | null; description: string | null; cost: number | null; hasClaim: boolean;
  state: "claimed" | "redeemed" | "cancelled" | "expired" | "out_of_stock" | "upcoming" | "inactive" | "locked" | "reported" | "unknown";
  code: string | null; expiresAt: string | null;
  reservation?: { claimIntent: typeof CONSUMER_REWARD_RESERVATION_INTENT; pointsCost: number };
  claimUnavailableReasons?: ConsumerRewardUnavailableReason[];
  reservationNeedsRefresh?: boolean;
};
export type ConsumerRewardsSource = { status: "ready"; items: ConsumerReward[] } | { status: "unavailable"; items: null };
export type ConsumerRewardsSnapshot =
  | { status: "ready"; items: ConsumerReward[]; checkedAt: string }
  | { status: "unavailable"; items: null; checkedAt: null };
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, max = 240): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
function identifier(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : null;
}
function unavailableReasons(value: unknown): ConsumerRewardUnavailableReason[] | undefined {
  if (!Array.isArray(value) || value.length > REWARD_UNAVAILABLE_REASONS.length) return undefined;
  for (const reason of value) {
    if (typeof reason !== "string" || !(REWARD_UNAVAILABLE_REASONS as readonly string[]).includes(reason)) return undefined;
  }
  return [...new Set(value)] as ConsumerRewardUnavailableReason[];
}
export function rewardTenant(value: unknown): string {
  return typeof value === "string" && (/^[a-z0-9][a-z0-9._-]{0,119}$/.test(value) || /^[a-zA-Z0-9-]{1,60}$/.test(value)) ? value : "";
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
  if (!value) return "No informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No informado";
  const parts = new Intl.DateTimeFormat("es-AR", {
    calendar: "gregory", numberingSystem: "latn", timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} · ${part("hour")}:${part("minute")} (Argentina)`;
}
/** Private response projection time is presentation metadata, never action authority. */
export function buildConsumerRewardsSnapshot(payload: unknown): ConsumerRewardsSnapshot {
  const envelope = record(payload), checkedAt = instant(envelope?.checkedAt);
  if (!envelope || envelope.ok !== true || envelope.scope !== "own_brands" || envelope.limit !== 100
    || !Array.isArray(envelope.items) || envelope.items.length > 100 || !checkedAt || checkedAt !== envelope.checkedAt) {
    return { status: "unavailable", items: null, checkedAt: null };
  }
  const source = buildConsumerRewardsModel(envelope, checkedAt);
  return source.status === "ready" ? { ...source, checkedAt } : { ...source, checkedAt: null };
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
    // A published or legacy available row alone never authorizes a portal request.
    const canReserve = row.can_claim === true && row.claimIntent === CONSUMER_REWARD_RESERVATION_INTENT
      && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
      && row.catalog_state === "reported" && reported === "reported"
      && row.claim_id === null && row.claim_status === null && row.claim_expires_at === null
      && row.redemption_code === null && row.points_spent === null
      && typeof row.points_cost === "number" && Number.isSafeInteger(row.points_cost)
      && row.points_cost >= 0 && row.points_cost <= 2_147_483_647
      && typeof row.program_points_balance === "number" && Number.isSafeInteger(row.program_points_balance)
      && row.program_points_balance >= row.points_cost && text(row.program_name) !== null;
    const reasons = unavailableReasons(row.claim_unavailable_reasons);
    items.push({ key, id, tenant, title: text(row.title) || "Beneficio sin título informado", brand: text(row.tenant_name) || tenant,
      program: text(row.program_name), programBalance: reportedWalletPoints(row.program_points_balance), description: text(row.description, 1200), cost: reportedWalletPoints(claimId ? row.points_spent : row.points_cost),
      hasClaim: Boolean(claimId), state, code: state === "claimed" ? code : null, expiresAt,
      ...(reasons ? { claimUnavailableReasons: reasons } : {}),
      ...(row.can_claim === true && !claimId && !canReserve ? { reservationNeedsRefresh: true } : {}),
      ...(canReserve ? { reservation: { claimIntent: CONSUMER_REWARD_RESERVATION_INTENT, pointsCost: row.points_cost as number } } : {}) });
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
  upcoming: "No habilitado", inactive: "No habilitado", locked: "Requiere condiciones", reported: "Publicado por la marca", unknown: "Estado por confirmar",
};

/** Notices are advisory. A known catalog lifecycle takes priority without hiding other reported requirements. */
export function rewardAvailabilityNotice(item: ConsumerReward): { title: string; summary?: string; messages: string[] } {
  if (item.reservationNeedsRefresh) return { title: "Necesitamos actualizar los datos", messages: [
    "No pudimos confirmar todos los datos para reservar este beneficio. Volvé a consultar tus beneficios antes de continuar.",
  ] };
  const lifecycle = item.state === "expired" ? { title: "Este beneficio ya venció", message: "El beneficio figura como vencido. Podés consultar otras propuestas de la marca." }
    : item.state === "out_of_stock" ? { title: "Este beneficio no tiene cupos", message: "El beneficio figura sin cupos. Consultá con la marca si habrá una nueva disponibilidad." }
      : item.state === "inactive" ? { title: "Este beneficio no está habilitado", message: "La marca no tiene habilitada la reserva de este beneficio. Consultá si estará disponible." }
        : item.state === "upcoming" ? { title: "Todavía no se puede reservar", message: "Este beneficio todavía no está habilitado. Consultá con la marca cuándo estará disponible." } : null;
  const reasons = item.claimUnavailableReasons;
  const orderedReasons = lifecycle && reasons ? [...reasons.filter(reason => reason === "availability_review"), ...reasons.filter(reason => reason !== "availability_review")] : reasons;
  const messages = orderedReasons?.map(reason => {
    switch (reason) {
      case "age_verification_required": return "Este beneficio requiere verificación de edad. Consultá con la marca cómo acceder.";
      case "insufficient_program_points": return typeof item.cost === "number" && typeof item.programBalance === "number"
        && item.programBalance < item.cost
        ? `Te faltan ${item.cost - item.programBalance} puntos en este programa para alcanzar el costo del beneficio.`
        : "El programa necesita confirmar un saldo suficiente para este beneficio.";
      case "brand_connection_required": return "Este beneficio requiere un vínculo activo con la marca. Podés revisar tu relación en Mis marcas.";
      case "program_participation_required": return "Este beneficio requiere participar en el programa de la marca. Consultá cómo sumarte y qué condiciones tiene.";
      case "brand_conditions_review": return "La marca tiene que confirmar las condiciones de este beneficio antes de habilitar la reserva.";
      case "availability_review": return lifecycle?.message ?? "La marca tiene que confirmar la vigencia y los cupos antes de habilitar la reserva.";
      case "account_review": return "Necesitamos revisar los datos de tu cuenta para este beneficio. Volvé a consultar o contactá a la marca.";
    }
  });
  if (messages?.length) return { title: lifecycle?.title ?? "Antes de reservar", ...(lifecycle ? { summary: lifecycle.message } : {}), messages };
  if (lifecycle) return { title: lifecycle.title, messages: [lifecycle.message] };
  return { title: "Todavía no se puede reservar", messages: [
    "La marca tiene que confirmar los requisitos y la disponibilidad de este beneficio. Publicado no significa reservado; consultar esta información no descuenta puntos.",
  ] };
}
