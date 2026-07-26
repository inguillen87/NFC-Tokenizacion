export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, timingSafeEqual } from "node:crypto";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { anchorTokenizationRequest } from "../../../../lib/tokenization-engine";
import { ensureTokenizationRequestsSchema } from "../../../../lib/tokenization-schema";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

function secretMatches(provided: string, expected: string) {
  if (!provided || !expected) return false;
  const left = createHash("sha256").update(provided, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

function isAuthorized(req: Request) {
  const expected = String(process.env.INTERNAL_TOKENIZATION_KEY || "").trim();
  const provided = String(req.headers.get("x-internal-tokenization-key") || "").trim();
  return Boolean(expected && secretMatches(provided, expected));
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return json({ ok: false, reason: "unauthorized" }, 401);
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "platform",
    subjectId: "internal:tokenization-worker",
    globalPrincipal: true,
  });
  if (rateLimited) return rateLimited;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const limit = Math.min(Math.max(Number(body.limit || 10), 1), 100);

  await ensureTokenizationRequestsSchema();
  const rows = await sql/*sql*/`
    WITH picked AS (
      SELECT id, tenant_id
      FROM tokenization_requests
      WHERE tenant_id IS NOT NULL
        AND (
          (
            status IN ('pending', 'failed')
            AND COALESCE(next_attempt_at, requested_at) <= now()
          )
          OR (
            status = 'processing'
            AND COALESCE(NULLIF(meta->>'locked_at', '')::timestamptz, next_attempt_at, requested_at) <= now() - interval '10 minutes'
          )
        )
      ORDER BY requested_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE tokenization_requests tr
    SET status = 'processing',
        meta = COALESCE(tr.meta, '{}'::jsonb) || ${JSON.stringify({ locked_by: "internal_worker", locked_at: new Date().toISOString() })}::jsonb
    FROM picked
    WHERE tr.id = picked.id
    RETURNING tr.id, tr.tenant_id
  `;

  const results: Array<Record<string, unknown>> = [];
  for (const row of rows as Array<{ id: string; tenant_id: string | null }>) {
    if (!row.tenant_id) {
      results.push({ ok: false, request_id: row.id, reason: "tenant_id_required", status: "blocked" });
      continue;
    }
    const result = await anchorTokenizationRequest({
      requestId: row.id,
      tenantId: String(row.tenant_id),
      processor: "internal_worker",
    });
    results.push(result as unknown as Record<string, unknown>);
  }

  return json({
    ok: true,
    processed: results.length,
    success: results.filter((item) => item.ok === true).length,
    failed: results.filter((item) => item.ok !== true).length,
    results,
  });
}
