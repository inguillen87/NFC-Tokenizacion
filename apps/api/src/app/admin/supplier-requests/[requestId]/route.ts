import { makeSupplierRequestHandlers } from "../../../../lib/supplier-request-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = makeSupplierRequestHandlers();
type Context = { params: Promise<{ requestId: string }> };
export async function GET(req: Request, context: Context) { return handlers.get(req, (await context.params).requestId); }
export async function PATCH(req: Request, context: Context) { return handlers.patch(req, (await context.params).requestId); }
