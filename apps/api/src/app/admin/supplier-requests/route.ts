import { makeSupplierRequestHandlers } from "../../../lib/supplier-request-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = makeSupplierRequestHandlers();
export const GET = handlers.list;
export const POST = handlers.create;
