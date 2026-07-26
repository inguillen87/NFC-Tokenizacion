export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

export async function POST(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: 'unauthorized' }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:privacy-export` });
  if (limited) return limited;
  await ensureConsumerPortalSchema();
  const products = await sql/*sql*/`SELECT * FROM consumer_products WHERE consumer_id = ${consumer.id}`;
  const taps = await sql/*sql*/`SELECT * FROM consumer_tap_history WHERE consumer_id = ${consumer.id}`;
  const consents = await sql/*sql*/`SELECT * FROM consumer_tenant_consents WHERE consumer_id = ${consumer.id}`;
  return json({ ok: true, export: { consumer, products, taps, consents, exportedAt: new Date().toISOString() } });
}
