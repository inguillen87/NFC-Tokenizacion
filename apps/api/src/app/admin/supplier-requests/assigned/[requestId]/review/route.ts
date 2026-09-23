import { makeAssignedSupplierRequestHandlers } from "../../../../../../lib/supplier-request-assigned-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = makeAssignedSupplierRequestHandlers();
export async function GET(req: Request, context: { params: Promise<{ requestId: string }> }) { return handlers.reviewGet(req, (await context.params).requestId); }
export async function POST(req: Request, context: { params: Promise<{ requestId: string }> }) { return handlers.reviewPost(req, (await context.params).requestId); }
