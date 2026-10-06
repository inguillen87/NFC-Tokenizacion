import { getPublishedCustomerConfiguration, unavailableCustomerConfiguration } from "../../../../../lib/published-customer-configuration";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const headers = { "cache-control": "private, no-store, max-age=0" };
  if (!/^[1-9]\d{0,15}$/.test(eventId) || !Number.isSafeInteger(Number(eventId))) return Response.json({ ok: false, reason: "configuration_event_invalid" }, { status: 400, headers });
  const limited = await enforceCriticalRateLimit(req, {rateClass:"public",tenantId:"platform",subjectId:"public-customer-configuration"});
  if (limited) {limited.headers.set("cache-control",headers["cache-control"]);return limited;}
  try { return Response.json({ ok: true, configuration: await getPublishedCustomerConfiguration(eventId) }, { headers }); }
  catch { return Response.json({ ok: false, reason: "configuration_unavailable", configuration: unavailableCustomerConfiguration() }, { status: 503, headers }); }
}
