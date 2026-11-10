import { cookies } from "next/headers";
import { CONSUMER_REWARD_RECEIPT_COOKIE, parseConsumerRewardReceipt } from "../../api/_lib/consumer-reward-receipt";
import { readConsumerRewardReceipt } from "../_components/consumer-api";
import { rewardTenant } from "../_components/consumer-rewards-model";

const receiptStatuses = ["claimed", "redeemed", "cancelled", "expired", "unknown"] as const;
export type LastRewardReceipt = {
  id: string;
  rewardId: string;
  tenant: string;
  status: (typeof receiptStatuses)[number];
  expiresAt: string | null;
};

export type LastRewardReceiptRead =
  | { status: "ready"; receipt: LastRewardReceipt }
  | { status: "hidden" | "unavailable" };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function readLastRewardReceipt(): Promise<LastRewardReceiptRead> {
  const claimId = parseConsumerRewardReceipt((await cookies()).get(CONSUMER_REWARD_RECEIPT_COOKIE)?.value);
  if (!claimId) return { status: "hidden" };
  const result = await readConsumerRewardReceipt(claimId);
  if (result.status === "http-error" && [401, 403, 404].includes(result.httpStatus)) return { status: "hidden" };
  if (result.status !== "ready") return { status: "unavailable" };
  const payload = record(result.data);
  const receipt = record(payload?.receipt);
  if (payload?.ok !== true || !receipt) return { status: "unavailable" };
  const rewardId = parseConsumerRewardReceipt(receipt.reward_id);
  const tenant = rewardTenant(receipt.tenant_slug);
  const status = receiptStatuses.find(value => value === receipt.status);
  const expiresAt = receipt.expires_at;
  if (parseConsumerRewardReceipt(receipt.id) !== claimId || !rewardId || !tenant || !status
    || (expiresAt !== null && (typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt))))) return { status: "unavailable" };
  return { status: "ready", receipt: { id: claimId, rewardId, tenant, status, expiresAt } };
}
