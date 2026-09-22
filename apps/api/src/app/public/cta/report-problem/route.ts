import { handleSupportReport } from "../../../../lib/support-report-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) { return handleSupportReport(req); }
