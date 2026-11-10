import { CONSUMER_REWARD_RESERVATION_INTENT } from "../../../../../me/_components/consumer-rewards-model";
import { CONSUMER_REWARD_RECEIPT_COOKIE, parseConsumerRewardReceipt } from "../../../../_lib/consumer-reward-receipt";
import { proxyToApi } from "../../../../_lib/runtime-proxy";

export const runtime = "nodejs";

type ClaimContext = { params: Promise<{ rewardId: string }> };
const loopbackHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
const MAX_CLAIM_REQUEST_BYTES = 8 * 1024;
const MAX_CLAIM_RESPONSE_BYTES = 64 * 1024;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Inspection only. An oversized or malformed body still uses the normal relay response. */
async function readRecord(message: Request | Response, maxBytes: number) {
  const reader = message.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return record(JSON.parse(text + decoder.decode()));
      bytes += value.byteLength;
      if (bytes > maxBytes) return null;
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function claimPath(rewardId: string) {
  return "/consumer/rewards/" + encodeURIComponent(rewardId) + "/claim";
}

// Preserve the catch-all relay for methods outside the reservation flow.
async function relay(req: Request, { params }: ClaimContext) {
  return proxyToApi(req, claimPath((await params).rewardId));
}

export const GET = relay;
export const PATCH = relay;
export const DELETE = relay;

export async function POST(req: Request, { params }: ClaimContext) {
  const { rewardId } = await params;
  const target = claimPath(rewardId);
  const expectedReward = parseConsumerRewardReceipt(rewardId);
  if (!expectedReward) return proxyToApi(req, target);

  // Consume the bounded inspector branch while the relay reads the request.
  const submission = readRecord(req.clone(), MAX_CLAIM_REQUEST_BYTES);
  const response = await proxyToApi(req, target);
  if (!response.ok) return response;

  const requestBody = await submission;
  const cost = requestBody?.expectedPointsCost;
  if (requestBody?.claimIntent !== CONSUMER_REWARD_RESERVATION_INTENT
    || typeof cost !== "number" || !Number.isSafeInteger(cost) || cost < 0 || cost > 2_147_483_647) return response;

  // The relay already materialized its response. Only the extra inspection is bounded here.
  const acknowledgement = await readRecord(response.clone(), MAX_CLAIM_RESPONSE_BYTES);
  const claim = record(acknowledgement?.claim);
  const receipt = parseConsumerRewardReceipt(claim?.id);
  if (acknowledgement?.ok !== true || typeof acknowledgement.duplicate !== "boolean"
    || !receipt || parseConsumerRewardReceipt(claim?.reward_id) !== expectedReward) return response;

  const url = new URL(req.url);
  const localHttp = url.protocol === "http:" && loopbackHost.test(url.host)
    && loopbackHost.test(req.headers.get("host") || url.host);
  // Append so that an upstream auth or compatibility cookie is never rewritten again.
  response.headers.append("set-cookie",
    `${CONSUMER_REWARD_RECEIPT_COOKIE}=${receipt}; Path=/me/rewards; Max-Age=7200; HttpOnly; SameSite=Lax${localHttp ? "" : "; Secure"}`);
  response.headers.set("cache-control", "private, no-store");
  return response;
}
