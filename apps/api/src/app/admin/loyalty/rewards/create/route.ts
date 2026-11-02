export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleAdminRewardPost } from "../../../../../lib/admin-reward-request";

export async function POST(req: Request) {
  return handleAdminRewardPost(req, "strict-create");
}
