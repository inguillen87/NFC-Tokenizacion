export const runtime="nodejs";
export const dynamic="force-dynamic";
import { passportStudioRequest } from "../../../../../lib/passport-editorial-http";
export async function GET(req:Request,ctx:{params:Promise<{bid:string}>}){return passportStudioRequest(req,(await ctx.params).bid);}
