import { forwardSupplierRequest } from "../../../../../../lib/supplier-request-proxy";
export const runtime = "nodejs";
type Context = { params: Promise<{ requestId: string }> };
export async function GET(req: Request, context: Context) { return forwardSupplierRequest(req, [(await context.params).requestId, "review"]); }
export async function POST(req: Request, context: Context) { return forwardSupplierRequest(req, [(await context.params).requestId, "review"]); }
