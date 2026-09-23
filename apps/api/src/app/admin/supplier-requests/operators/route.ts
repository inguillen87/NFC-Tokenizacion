import { makeSupplierRequestAssignmentHandlers } from "../../../../lib/supplier-request-assignment-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = makeSupplierRequestAssignmentHandlers();
export async function GET(req: Request) { return handlers.candidates(req); }
