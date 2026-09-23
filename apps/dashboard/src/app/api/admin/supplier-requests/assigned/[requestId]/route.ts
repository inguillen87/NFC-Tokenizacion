import { forwardSupplierRequest } from "../../../../../../lib/supplier-request-proxy";
export const runtime = "nodejs";
export async function GET(req: Request, context: { params: Promise<{ requestId: string }> }) { return forwardSupplierRequest(req, ["assigned", (await context.params).requestId]); }
