export const runtime="nodejs";
export const dynamic="force-dynamic";
import { passportStudioRequest } from "../../../../../../lib/passport-editorial-http";
export async function POST(req:Request,ctx:{params:Promise<{bid:string;action:string}>}){const {bid,action}=await ctx.params;return passportStudioRequest(req,bid,action);}
