export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { getSunDiagnosticSnapshot } from "../../../../lib/sun-diagnostics";

export async function GET(req: Request, { params }: { params: Promise<{ diagnosticId: string }> }) {
  const { diagnosticId } = await params;
  const url = new URL(req.url);
  const trace = String(url.searchParams.get("trace") || "").trim();
  const fresh = String(url.searchParams.get("fresh") || url.searchParams.get("fresh_token") || "").trim();
  const snapshot = await getSunDiagnosticSnapshot(diagnosticId, trace, fresh);

  if (!snapshot) {
    return json({ ok: false, reason: "snapshot_not_found" }, 404, {
      "cache-control": "no-store",
    });
  }

  return json(snapshot, 200, {
    "cache-control": "no-store",
  });
}
