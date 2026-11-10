import { cookies } from "next/headers";
import { CONSUMER_REWARD_RECEIPT_COOKIE, parseConsumerRewardReceipt } from "../../api/_lib/consumer-reward-receipt";
import { fetchConsumerPath } from "../_components/consumer-api";
import { rewardTenant } from "../_components/consumer-rewards-model";

const receiptStatuses = ["claimed", "redeemed", "cancelled", "expired", "unknown"] as const;
export type LastRewardReceipt = {
  id: string;
  rewardId: string;
  tenant: string;
  status: (typeof receiptStatuses)[number];
  expiresAt: string | null;
};

export async function readLastRewardReceipt(): Promise<LastRewardReceipt | null> {
  const claimId = parseConsumerRewardReceipt((await cookies()).get(CONSUMER_REWARD_RECEIPT_COOKIE)?.value);
  if (!claimId) return null;
  const payload = await fetchConsumerPath("redemptions/" + claimId);
  const raw = payload?.receipt;
  if (payload?.ok !== true || !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const receipt = raw as Record<string, unknown>;
  const rewardId = parseConsumerRewardReceipt(receipt.reward_id);
  const tenant = rewardTenant(receipt.tenant_slug);
  const status = receiptStatuses.find(value => value === receipt.status);
  const expiresAt = receipt.expires_at;
  if (parseConsumerRewardReceipt(receipt.id) !== claimId || !rewardId || !tenant || !status
    || (expiresAt !== null && (typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt))))) return null;
  return { id: claimId, rewardId, tenant, status, expiresAt };
}
