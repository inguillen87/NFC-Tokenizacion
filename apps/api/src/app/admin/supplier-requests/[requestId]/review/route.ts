import { makeSupplierRequestReviewHandlers } from "../../../../../lib/supplier-request-review-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = makeSupplierRequestReviewHandlers();
export async function GET(req: Request, context: { params: Promise<{ requestId: string }> }) { return handlers.get(req, (await context.params).requestId); }
export async function POST(req: Request, context: { params: Promise<{ requestId: string }> }) { return handlers.post(req, (await context.params).requestId); }
