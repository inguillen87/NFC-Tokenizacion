import { json } from "../../../../lib/http";
import { recordDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";

export async function POST(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, 400);
  const { bid, uid } = target;

  const auth = requireShareToken(req, bid, target.shareUid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);

  const saved = await recordDemoCta("report_problem", bid, uid, {
    ...body,
    reported_at: new Date().toISOString(),
    trace_id: traceId,
    share_token_status: auth.share_token_status,
  });

  return json({
    ok: true,
    action: "report_problem",
    id: saved.id,
    created_at: saved.created_at,
    trace_id: traceId,
    share_token_status: auth.share_token_status,
  });
}
