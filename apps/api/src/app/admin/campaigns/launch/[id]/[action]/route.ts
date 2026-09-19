export const runtime="nodejs";
export const dynamic="force-dynamic";
import {handleCampaignLaunch} from "../../../../../../lib/campaign-launch-http";
export async function POST(req:Request,{params}:{params:Promise<{id:string;action:string}>}){const p=await params;return handleCampaignLaunch(req,p.id,p.action);}
