import { forwardSupplierRequest } from "../../../../../../lib/supplier-request-proxy";
export const runtime = "nodejs";
export async function POST(req: Request, context: { params: Promise<{ requestId: string }> }) { return forwardSupplierRequest(req, [(await context.params).requestId, "submit"]); }
