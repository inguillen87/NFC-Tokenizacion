export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { aggregateTenantMetrics } from "@product/core";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || "";

  const rows = tenant
    ? await sql/*sql*/`
      SELECT
        COUNT(DISTINCT b.id)::int AS batches,
        COUNT(DISTINCT t.id)::int AS tags,
        COUNT(e.id)::int AS scans,
        COUNT(*) FILTER (WHERE e.verdict IN ('replay_suspect', 'blocked_replay') OR e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
        COUNT(*) FILTER (WHERE e.verdict IN ('tampered', 'not_registered', 'not_active', 'invalid') OR e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE','INVALID'))::int AS tamper,
        COUNT(*) FILTER (WHERE e.verdict = 'valid' OR e.result IN ('VALID', 'TAP_VALID'))::int AS valid,
        COUNT(*) FILTER (WHERE e.verdict = 'revoked' OR e.result = 'REVOKED')::int AS revoked
      FROM tenants tn
      LEFT JOIN batches b ON b.tenant_id = tn.id
      LEFT JOIN tags t ON t.batch_id = b.id
      LEFT JOIN events e ON e.batch_id = b.id
      WHERE tn.slug = ${tenant}
    `
    : await sql/*sql*/`
      SELECT
        COUNT(DISTINCT b.id)::int AS batches,
        COUNT(DISTINCT t.id)::int AS tags,
        COUNT(e.id)::int AS scans,
        COUNT(*) FILTER (WHERE e.verdict IN ('replay_suspect', 'blocked_replay') OR e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
        COUNT(*) FILTER (WHERE e.verdict IN ('tampered', 'not_registered', 'not_active', 'invalid') OR e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE','INVALID'))::int AS tamper,
        COUNT(*) FILTER (WHERE e.verdict = 'valid' OR e.result IN ('VALID', 'TAP_VALID'))::int AS valid,
        COUNT(*) FILTER (WHERE e.verdict = 'revoked' OR e.result = 'REVOKED')::int AS revoked
      FROM batches b
      LEFT JOIN tags t ON t.batch_id = b.id
      LEFT JOIN events e ON e.batch_id = b.id
    `;

  const stats = rows[0] || { batches: 0, tags: 0, scans: 0, duplicates: 0, tamper: 0, valid: 0, revoked: 0 };
  const metrics = aggregateTenantMetrics({
    counts: {
      scans: Number(stats.scans || 0),
      valid: Number(stats.valid || 0),
      invalid: Math.max(Number(stats.scans || 0) - Number(stats.valid || 0), 0),
      duplicates: Number(stats.duplicates || 0),
      tamper: Number(stats.tamper || 0),
      revoked: Number(stats.revoked || 0),
    },
  });

  return json({ ...stats, riskScore: metrics.riskScore, riskBreakdown: metrics.riskBreakdown });
}
