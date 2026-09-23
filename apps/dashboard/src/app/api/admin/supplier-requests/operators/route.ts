import { forwardSupplierRequest } from "../../../../../lib/supplier-request-proxy";
export const runtime = "nodejs";
export async function GET(req: Request) { return forwardSupplierRequest(req, ["operators"]); }
