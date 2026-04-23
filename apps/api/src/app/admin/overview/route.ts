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
  const scansTotal = Number(stats.scans || 0);

  // Phase 9: Implement riskScore computation in backend matching the frontend formula
  // riskScore = clamp(replayRate * 45 + invalidRate * 25 + tamperRate * 50 + revokedTapRate * 35 + geoAnomalyRate * 20, 0, 100)
  let riskScore = 0;
  if (scansTotal > 0) {
    const replayRate = Number(stats.duplicates || 0) / scansTotal;
    // Approximation for invalid vs tamper since we aggregated them broadly,
    // but we can at least use tamper directly if available.
    const tamperRate = Number(stats.tamper || 0) / scansTotal;
    const revokedRate = Number(stats.revoked || 0) / scansTotal;
    const rawScore = (replayRate * 45) + (tamperRate * 50) + (revokedRate * 35);
    riskScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  }

  return json({ ...stats, riskScore });
}
