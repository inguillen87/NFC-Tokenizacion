export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || "";
  const limit = Number(searchParams.get("limit") || 100);

  const safeLimit = Math.min(Math.max(limit, 1), 500);
  let rows: unknown[] = [];
  try {
    rows = tenant
      ? await sql/*sql*/`
        SELECT
          e.id, e.result, e.reason, e.uid_hex, e.created_at, e.city, e.country_code, e.lat, e.lng,
          e.read_counter, e.source, e.device_label, e.meta,
          b.bid, tn.slug AS tenant_slug
        FROM events e
        JOIN batches b ON b.id = e.batch_id
        JOIN tenants tn ON tn.id = b.tenant_id
        WHERE tn.slug = ${tenant}
        ORDER BY e.created_at DESC
        LIMIT ${safeLimit}
      `
      : await sql/*sql*/`
        SELECT
          e.id, e.result, e.reason, e.uid_hex, e.created_at, e.city, e.country_code, e.lat, e.lng,
          e.read_counter, e.source, e.device_label, e.meta,
          b.bid, tn.slug AS tenant_slug
        FROM events e
        JOIN batches b ON b.id = e.batch_id
        JOIN tenants tn ON tn.id = b.tenant_id
        ORDER BY e.created_at DESC
        LIMIT ${safeLimit}
      `;
  } catch {
    rows = tenant
      ? await sql/*sql*/`
        SELECT e.id, e.result, e.reason, e.uid_hex, e.created_at, e.city, e.country_code, e.lat, e.lng, b.bid, tn.slug AS tenant_slug
        FROM events e
        JOIN batches b ON b.id = e.batch_id
        JOIN tenants tn ON tn.id = b.tenant_id
        WHERE tn.slug = ${tenant}
        ORDER BY e.created_at DESC
        LIMIT ${safeLimit}
      `
      : await sql/*sql*/`
        SELECT e.id, e.result, e.reason, e.uid_hex, e.created_at, e.city, e.country_code, e.lat, e.lng, b.bid, tn.slug AS tenant_slug
        FROM events e
        JOIN batches b ON b.id = e.batch_id
        JOIN tenants tn ON tn.id = b.tenant_id
        ORDER BY e.created_at DESC
        LIMIT ${safeLimit}
      `;
  }

  return json(rows);
}
