export const runtime="nodejs";
export const dynamic="force-dynamic";
import {handleCampaignLaunch} from "../../../../../lib/campaign-launch-http";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return handleCampaignLaunch(req,(await params).id);}
