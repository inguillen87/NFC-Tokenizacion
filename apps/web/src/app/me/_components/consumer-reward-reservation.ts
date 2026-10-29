import { fetchConsumerJson, type ConsumerJsonResult } from "./consumer-bounded-fetch";
import { buildConsumerRewardsSnapshot, CONSUMER_REWARD_RESERVATION_INTENT, type ConsumerReward, type ConsumerRewardsSnapshot } from "./consumer-rewards-model";

export type RewardReservationQuote = {
  rewardId: string; tenant: string; brand: string; title: string; program: string;
  pointsCost: number; programBalance: number;
};
export type RewardReservationResult =
  | { status: "acknowledged"; claimId: string; duplicate: boolean }
  | { status: "authentication-required" }
  | { status: "denied" }
  | { status: "uncertain" };
export type RewardReservationLookup =
  | { status: "confirmed"; items: ConsumerReward[]; claimKey: string; checkedAt: string }
  | { status: "not-confirmed"; items: ConsumerReward[]; checkedAt: string }
  | { status: "authentication-required" }
  | { status: "denied" }
  | { status: "uncertain" };
export type ConsumerRewardsReadResult =
  | Extract<ConsumerRewardsSnapshot, { status: "ready" }>
  | { status: "authentication-required" }
  | { status: "denied" }
  | { status: "uncertain" };
type Options = { fetchImpl?: typeof fetch; timeoutMs?: number; signal?: AbortSignal };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const sameUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function rewardReservationQuote(item: ConsumerReward): RewardReservationQuote | null {
  const cost = item.reservation?.pointsCost;
  if (item.hasClaim || item.state !== "reported" || !uuid(item.id) || !item.tenant || !item.program
    || item.reservation?.claimIntent !== CONSUMER_REWARD_RESERVATION_INTENT
    || typeof cost !== "number" || !Number.isSafeInteger(cost) || cost < 0 || cost > 2_147_483_647
    || cost !== item.cost || typeof item.programBalance !== "number"
    || !Number.isSafeInteger(item.programBalance) || item.programBalance < cost) return null;
  return { rewardId: item.id, tenant: item.tenant, brand: item.brand, title: item.title, program: item.program,
    pointsCost: cost, programBalance: item.programBalance };
}
export function sameReservationQuote(a: RewardReservationQuote, b: RewardReservationQuote): boolean {
  return a.rewardId === b.rewardId && a.tenant === b.tenant && a.brand === b.brand && a.title === b.title
    && a.program === b.program && a.pointsCost === b.pointsCost && a.programBalance === b.programBalance;
}
function requestOptions(options: Options) {
  const fetchImpl = options.fetchImpl ?? fetch;
  return { timeoutMs: options.timeoutMs, fetchImpl: ((url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    if (options.signal?.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
    const signals = [init?.signal, options.signal].filter((signal): signal is AbortSignal => Boolean(signal));
    return fetchImpl(url, { ...init, ...(signals.length ? { signal: AbortSignal.any(signals) } : {}) });
  }) as typeof fetch };
}
function refusal(result: ConsumerJsonResult): "authentication-required" | "denied" | "uncertain" {
  return result.status === "http-error" && result.httpStatus === 401 ? "authentication-required"
    : result.status === "http-error" && result.httpStatus === 403 ? "denied" : "uncertain";
}
/** One POST only. A timeout or a conflict never triggers another mutation. */
export async function reserveConsumerReward(quote: RewardReservationQuote, options: Options = {}): Promise<RewardReservationResult> {
  if (!uuid(quote.rewardId) || !Number.isSafeInteger(quote.pointsCost) || quote.pointsCost < 0 || quote.pointsCost > 2_147_483_647) return { status: "denied" };
  const result = await fetchConsumerJson("/api/consumer/rewards/" + encodeURIComponent(quote.rewardId) + "/claim", {
    method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
    body: JSON.stringify({ claimIntent: CONSUMER_REWARD_RESERVATION_INTENT, expectedPointsCost: quote.pointsCost, locale: "es-AR" }),
  }, requestOptions(options));
  if (options.signal?.aborted) return { status: "uncertain" };
  if (result.status !== "ready") return { status: refusal(result) };
  const envelope = record(result.data), claim = record(envelope?.claim);
  if (envelope?.ok !== true || typeof envelope.duplicate !== "boolean" || !uuid(claim?.id)
    || !uuid(claim?.reward_id) || !sameUuid(claim.reward_id, quote.rewardId)) return { status: "uncertain" };
  // Do not present a code or infer ownership from the acknowledgement body.
  return { status: "acknowledged", claimId: claim.id, duplicate: envelope.duplicate };
}
/** One explicit private GET. A failed read provides no replacement snapshot. */
export async function readConsumerRewardsSnapshot(options: Options = {}): Promise<ConsumerRewardsReadResult> {
  const result = await fetchConsumerJson("/api/consumer/rewards", { method: "GET", credentials: "same-origin", cache: "no-store" }, requestOptions(options));
  if (options.signal?.aborted) return { status: "uncertain" };
  if (result.status !== "ready") return { status: refusal(result) };
  const snapshot = buildConsumerRewardsSnapshot(result.data);
  return snapshot.status === "ready" ? snapshot : { status: "uncertain" };
}
/** A private read can confirm the issued UUID; it cannot repair the economic scope of a write. */
export async function readConsumerReservation(quote: RewardReservationQuote, claimId: string | null, options: Options = {}): Promise<RewardReservationLookup> {
  if (!uuid(quote.rewardId) || (claimId !== null && !uuid(claimId))) return { status: "denied" };
  const snapshot = await readConsumerRewardsSnapshot(options);
  if (snapshot.status !== "ready") return snapshot;
  const matches = snapshot.items.filter(item => item.hasClaim && uuid(item.id) && sameUuid(item.id, quote.rewardId)
    && item.tenant === quote.tenant && uuid(item.key.slice(6))
    && (claimId === null || sameUuid(item.key.slice(6), claimId)));
  if (matches.length > 1) return { status: "uncertain" };
  return matches.length === 1 ? { status: "confirmed", items: snapshot.items, claimKey: matches[0].key, checkedAt: snapshot.checkedAt }
    : { status: "not-confirmed", items: snapshot.items, checkedAt: snapshot.checkedAt };
}
