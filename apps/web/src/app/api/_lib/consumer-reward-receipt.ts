export const CONSUMER_REWARD_RECEIPT_COOKIE = "nexid_consumer_reward_receipt";

/** A receipt is a lookup selector. Only an authenticated, owned read can confirm it. */
export function parseConsumerRewardReceipt(value: unknown): string | null {
  return typeof value === "string" && value.length === 36
    && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}
