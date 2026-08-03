import { createHash } from "node:crypto";

import { getRequestMeta } from "./request-meta";
import {
  releaseSunRateLimitLeases,
  reserveSunRateLimitLease,
  type SunRateLimitLease,
} from "./sun-rate-limit-store";

export const OWNERSHIP_CLAIM_PIN_DEVICE_MAX_ATTEMPTS = 5;
export const OWNERSHIP_CLAIM_PIN_PRODUCT_MAX_ATTEMPTS = 20;
export const OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS = 15 * 60;

type ClaimPinRateContext = {
  tenantId: string;
  bid: string;
  uidHex?: string | null;
  sourceId?: string | null;
  credentialScope: "batch" | "tag";
};

type RateReserve = typeof reserveSunRateLimitLease;
type RateRelease = typeof releaseSunRateLimitLeases;

export type OwnershipClaimPinAttemptLease = {
  leases: SunRateLimitLease[];
};

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function ownershipClaimPinRateKeys(req: Request, input: ClaimPinRateContext) {
  const meta = getRequestMeta(req);
  const tenantId = String(input.tenantId || "tenant:unknown").trim();
  const bid = String(input.bid || "batch:unknown").trim();
  const uidHex = String(input.uidHex || "batch-wide").trim().toUpperCase();
  const sourceId = String(input.sourceId || "source:anonymous").trim();
  // A batch PIN authorizes every unit in the batch, therefore every UID must
  // consume the same online-guess budget. Only a tag credential may shard the
  // budget by UID. Unknown runtime values fall back to the safer batch scope.
  const credentialScope = input.credentialScope === "tag" ? "tag" : "batch";
  const credentialIdentity = credentialScope === "tag" ? uidHex : "batch-wide";
  const productIdentity = ["ownership-claim-pin-v2", tenantId, bid, credentialScope, credentialIdentity].join("\0");
  const sourceIdentity = [sourceId, meta.ip || "ip:unknown", meta.userAgent || "ua:unknown"].join("\0");
  return {
    device: digest(`${productIdentity}\0${sourceIdentity}`),
    product: digest(productIdentity),
  };
}

async function releaseAllowedReservations(
  reservations: Array<{ limited: boolean; unavailable?: boolean; lease: SunRateLimitLease }>,
  release: RateRelease,
) {
  const leases = reservations
    .filter((reservation) => !reservation.limited && !reservation.unavailable)
    .map((reservation) => reservation.lease);
  if (!leases.length) return true;
  try {
    const result = await release(leases);
    return result.released && !result.unavailable;
  } catch {
    return false;
  }
}

/**
 * Atomically reserves both failure budgets before expensive verification.
 * A successful verification must release the returned leases; a failed one
 * deliberately keeps them. This closes concurrent guess bursts without
 * permanently charging successful users against the failure budget.
 */
export async function reserveOwnershipClaimPinAttempt(
  req: Request,
  input: ClaimPinRateContext,
  dependencies: { reserve?: RateReserve; release?: RateRelease } = {},
): Promise<
  | { status: "allowed"; attempt: OwnershipClaimPinAttemptLease }
  | { status: "locked" }
  | { status: "unavailable" }
> {
  const keys = ownershipClaimPinRateKeys(req, input);
  const reserve = dependencies.reserve || reserveSunRateLimitLease;
  const release = dependencies.release || releaseSunRateLimitLeases;
  const settled = await Promise.allSettled([
    reserve("claim_pin_device", keys.device, OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS, OWNERSHIP_CLAIM_PIN_DEVICE_MAX_ATTEMPTS),
    reserve("claim_pin_product", keys.product, OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS, OWNERSHIP_CLAIM_PIN_PRODUCT_MAX_ATTEMPTS),
  ]);
  const reservations = settled
    .filter((entry): entry is PromiseFulfilledResult<Awaited<ReturnType<RateReserve>>> => entry.status === "fulfilled")
    .map((entry) => entry.value);
  if (settled.some((entry) => entry.status === "rejected") || reservations.some((entry) => entry.unavailable)) {
    await releaseAllowedReservations(reservations, release);
    return { status: "unavailable" };
  }
  if (reservations.some((entry) => entry.limited)) {
    const released = await releaseAllowedReservations(reservations, release);
    return { status: released ? "locked" : "unavailable" };
  }
  return { status: "allowed", attempt: { leases: reservations.map((entry) => entry.lease) } };
}

export async function releaseSuccessfulOwnershipClaimPinAttempt(
  attempt: OwnershipClaimPinAttemptLease,
  dependencies: { release?: RateRelease } = {},
): Promise<{ status: "released" | "unavailable" }> {
  try {
    const release = dependencies.release || releaseSunRateLimitLeases;
    const result = await release(attempt.leases);
    return { status: result.released && !result.unavailable ? "released" : "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
