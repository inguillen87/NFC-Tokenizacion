import { createCampaignDraftHandlers } from "../../../../../lib/campaign-draft-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createCampaignDraftHandlers();
type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  return handlers.get(req, (await context.params).id);
}

export async function PATCH(req: Request, context: Context) {
  return handlers.patch(req, (await context.params).id);
}
