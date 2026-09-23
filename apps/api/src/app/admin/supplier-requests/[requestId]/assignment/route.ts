import { makeSupplierRequestAssignmentHandlers } from "../../../../../lib/supplier-request-assignment-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = makeSupplierRequestAssignmentHandlers();
export async function GET(req: Request, context: { params: Promise<{ requestId: string }> }) { return handlers.get(req, (await context.params).requestId); }
export async function POST(req: Request, context: { params: Promise<{ requestId: string }> }) { return handlers.post(req, (await context.params).requestId); }
