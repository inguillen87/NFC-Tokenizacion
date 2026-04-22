export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";

export async function GET(req: Request) {
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
  const body = await req.json().catch(() => ({}));
  const rows = await sql/*sql*/`
    UPDATE consumers
    SET display_name = COALESCE(${body.displayName || null}, display_name),
        preferred_locale = COALESCE(${body.preferredLocale || null}, preferred_locale),
        country = COALESCE(${body.country || null}, country),
        city = COALESCE(${body.city || null}, city),
        updated_at = now()
    WHERE id = ${consumer.id}
    RETURNING *
  `;
  return json({ ok: true, consumer: rows[0] });
}
