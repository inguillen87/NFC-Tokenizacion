import { forwardSupplierRequest } from "../../../../lib/supplier-request-proxy";
export const runtime = "nodejs";
export const GET = (req: Request) => forwardSupplierRequest(req);
export const POST = (req: Request) => forwardSupplierRequest(req);
