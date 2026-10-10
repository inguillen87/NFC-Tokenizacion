import { proxyConsumerTapEligibility } from "../../_lib/consumer-tap-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return proxyConsumerTapEligibility(req);
}
