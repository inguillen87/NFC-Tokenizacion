import { fetchConsumerJson } from "./consumer-bounded-fetch";
import { buildConsumerWalletPointsModel, type WalletBrandPointsSource } from "./consumer-wallet-points-model";

export type ConsumerBrandPointsRead =
  | { status: "ready"; points: Extract<WalletBrandPointsSource, { status: "ready" }> }
  | { status: "authentication-required" | "denied" | "unavailable" };

/** One explicit same-origin read. It does not refresh a page or mutate a reward. */
export async function readConsumerBrandPoints(options: { fetchImpl?: typeof fetch; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<ConsumerBrandPointsRead> {
  const result = await fetchConsumerJson("/api/consumer/wallet", {
    method: "GET", credentials: "same-origin", cache: "no-store",
  }, options);
  if (options.signal?.aborted) return { status: "unavailable" };
  if (result.status === "http-error") return { status: result.httpStatus === 401 ? "authentication-required" : result.httpStatus === 403 ? "denied" : "unavailable" };
  if (result.status !== "ready") return { status: "unavailable" };
  const points = buildConsumerWalletPointsModel(result.data).brands;
  return points.status === "ready" ? { status: "ready", points } : { status: "unavailable" };
}
