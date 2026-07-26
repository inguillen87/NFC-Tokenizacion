export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";

export async function GET(req: Request) {
  await ensureConsumerPortalSchema();
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);

  const stats = await sql/*sql*/`
    SELECT
      (SELECT COUNT(*)::int FROM consumer_products WHERE consumer_id = ${consumer.id}) AS products,
      (SELECT COUNT(*)::int FROM consumer_tap_history WHERE consumer_id = ${consumer.id}) AS taps,
      (SELECT COUNT(*)::int FROM tenant_consumer_memberships WHERE consumer_id = ${consumer.id}) AS memberships,
      (SELECT COUNT(*)::int FROM consumer_notifications WHERE consumer_id = ${consumer.id} AND read_at IS NULL) AS unread
  `;

  return json({ ok: true, consumer, stats: stats[0] });
}

export async function PATCH(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:profile` });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 16 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  await ensureConsumerPortalSchema();
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : null;
  const preferredLocale = typeof body.preferredLocale === "string" ? body.preferredLocale.trim().slice(0, 12) : null;
  const country = typeof body.country === "string" ? body.country.trim().slice(0, 80) : null;
  const city = typeof body.city === "string" ? body.city.trim().slice(0, 120) : null;
  const rows = await sql/*sql*/`
    UPDATE consumers
    SET display_name = COALESCE(${displayName}, display_name),
        preferred_locale = COALESCE(${preferredLocale}, preferred_locale),
        country = COALESCE(${country}, country),
        city = COALESCE(${city}, city),
        updated_at = now()
    WHERE id = ${consumer.id}
    RETURNING *
  `;
  return json({ ok: true, consumer: rows[0] });
}
