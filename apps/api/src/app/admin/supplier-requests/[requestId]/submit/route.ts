import { makeSupplierRequestHandlers } from "../../../../../lib/supplier-request-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = makeSupplierRequestHandlers();
export async function POST(req: Request, context: { params: Promise<{ requestId: string }> }) { return handlers.submit(req, (await context.params).requestId); }
