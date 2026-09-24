import { makeSupplierQuoteHandlers } from "../../../../../lib/supplier-request-quote-http";
const handlers=makeSupplierQuoteHandlers();type Context={params:Promise<{requestId:string}>};
export async function GET(req:Request,ctx:Context){return handlers.get(req,(await ctx.params).requestId);}
export async function POST(req:Request,ctx:Context){return handlers.post(req,(await ctx.params).requestId);}
