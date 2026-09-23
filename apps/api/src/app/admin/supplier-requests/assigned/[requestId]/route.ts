import { makeAssignedSupplierRequestHandlers } from "../../../../../lib/supplier-request-assigned-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = makeAssignedSupplierRequestHandlers();
export async function GET(req: Request, context: { params: Promise<{ requestId: string }> }) { return handlers.get(req, (await context.params).requestId); }
