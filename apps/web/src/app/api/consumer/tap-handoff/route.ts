import { prepareConsumerTapHandoff } from "../../_lib/consumer-tap-handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return prepareConsumerTapHandoff(req);
}
