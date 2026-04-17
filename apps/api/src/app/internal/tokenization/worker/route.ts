export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { anchorTokenizationRequest } from "../../../../lib/tokenization-engine";

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

  const rows = await sql/*sql*/`
    SELECT id
    FROM tokenization_requests
    WHERE status IN ('pending', 'processing')
      AND COALESCE(next_attempt_at, requested_at) <= now()
    ORDER BY requested_at ASC
    LIMIT ${limit}
  `;

  const results: Array<Record<string, unknown>> = [];
  for (const row of rows as Array<{ id: string }>) {
    await sql/*sql*/`UPDATE tokenization_requests SET status = 'processing' WHERE id = ${row.id}::uuid`;
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
