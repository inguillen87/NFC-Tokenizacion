export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../lib/http";
import { readConsumerTapEligibility } from "../../../lib/consumer-tap-eligibility";

export async function GET(req: Request) {
  const result = await readConsumerTapEligibility(req);
  return json(result.body, result.status, {
    "cache-control": "private, no-store, max-age=0",
    "vary": "Cookie",
    "referrer-policy": "no-referrer",
  });
}
