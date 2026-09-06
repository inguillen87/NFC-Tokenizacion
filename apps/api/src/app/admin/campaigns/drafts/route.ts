import { createCampaignDraftHandlers } from "../../../../lib/campaign-draft-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createCampaignDraftHandlers();
export const GET = handlers.list;
export const POST = handlers.create;
