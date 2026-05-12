export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { anchorTokenizationRequest } from "../../../../lib/tokenization-engine";
import { ensureTokenizationRequestsSchema } from "../../../../lib/tokenization-schema";

function isAuthorized(req: Request) {
  const expected = (process.env.INTERNAL_TOKENIZATION_KEY || "").trim();
  if (!expected) return false;
  const provided = (req.headers.get("x-internal-tokenization-key") || "").trim();
  return provided && provided === expected;
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return json({ ok: false, reason: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const limit = Math.min(Math.max(Number(body.limit || 10), 1), 100);

  await ensureTokenizationRequestsSchema();
  const rows = await sql/*sql*/`
    WITH picked AS (
      SELECT id
      FROM tokenization_requests
      WHERE (
          status IN ('pending', 'failed')
          AND COALESCE(next_attempt_at, requested_at) <= now()
        )
        OR (
          status = 'processing'
          AND COALESCE(NULLIF(meta->>'locked_at', '')::timestamptz, next_attempt_at, requested_at) <= now() - interval '10 minutes'
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
    RETURNING tr.id
  `;

  const results: Array<Record<string, unknown>> = [];
  for (const row of rows as Array<{ id: string }>) {
    const result = await anchorTokenizationRequest({
      requestId: row.id,
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
