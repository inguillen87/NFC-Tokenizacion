export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, timingSafeEqual } from "node:crypto";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { anchorTokenizationRequest } from "../../../../lib/tokenization-engine";
import { ensureTokenizationCommercialScopeSchema } from "../../../../lib/tokenization-schema";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { tokenizationExecutionGovernanceError } from "../../../../lib/tokenization-execution-policy";

const MAX_TOKENIZATION_WORKER_BODY_BYTES = 1024;

function secretMatches(provided: string, expected: string) {
  if (!provided || !expected) return false;
  const left = createHash("sha256").update(provided, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

function isAuthorized(req: Request) {
  const expected = String(process.env.INTERNAL_TOKENIZATION_KEY || "").trim();
  const provided = String(req.headers.get("x-internal-tokenization-key") || "").trim();
  const production = [process.env.VERCEL_ENV, process.env.NODE_ENV]
    .some((value) => String(value || "").trim().toLowerCase() === "production");
  if (production && Buffer.byteLength(expected, "utf8") < 32) return false;
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

  let body: Record<string, unknown>;
  try {
    const parsed = await readBoundedJsonBody<unknown>(req, MAX_TOKENIZATION_WORKER_BODY_BYTES);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ ok: false, reason: "tokenization_worker_body_invalid" }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json({ ok: false, reason: "request_body_too_large" }, 413);
    }
    return json({ ok: false, reason: "tokenization_worker_body_invalid" }, 400);
  }
  if (Object.keys(body).some((field) => field !== "limit")) {
    return json({ ok: false, reason: "tokenization_worker_body_fields_invalid" }, 400);
  }
  const requestedLimit = body.limit === undefined ? 10 : Number(body.limit);
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
    return json({ ok: false, reason: "tokenization_worker_limit_invalid" }, 400);
  }
  const limit = requestedLimit;

  let rows: Array<Record<string, unknown>>;
  try {
    await ensureTokenizationCommercialScopeSchema();
    // This is only a candidate read. The database prepare function owns the
    // atomic lease/CAS. In particular, processing and reconciling rows are
    // never recycled into a second send by elapsed wall-clock time. Expired
    // processing leases are selected only so prepare can quarantine them as
    // reconciling; it never authorizes another external call.
    rows = await sql/*sql*/`
      SELECT id, tenant_id
      FROM tokenization_requests
      WHERE tenant_id IS NOT NULL
        AND (
          (status = 'pending' AND COALESCE(next_attempt_at, requested_at) <= now())
          OR (status = 'processing' AND lease_expires_at <= now())
        )
        AND execution_class IN ('simulation', 'testnet_trial', 'live_chain')
        AND network IN ('polygon-amoy', 'polygon')
      ORDER BY requested_at ASC
      LIMIT ${limit}
    `;
  } catch (error) {
    console.error("[tokenization_worker_candidates]", error instanceof Error ? error.message : "unavailable");
    const mapped = tokenizationExecutionGovernanceError(error);
    return json({
      ok: false,
      reason: mapped.reason,
      ...(mapped.requiredMigration ? { required_migration: mapped.requiredMigration } : {}),
    }, mapped.status);
  }

  const results: Array<Record<string, unknown>> = [];
  for (const row of rows as Array<{ id: string; tenant_id: string | null }>) {
    if (!row.tenant_id) {
      results.push({ ok: false, request_id: row.id, reason: "tenant_id_required", status: "blocked" });
      continue;
    }
    try {
      const result = await anchorTokenizationRequest({
        requestId: row.id,
        tenantId: String(row.tenant_id),
        processor: "internal_worker",
      });
      results.push(result as unknown as Record<string, unknown>);
    } catch (error) {
      console.error("[tokenization_worker_request]", row.id, error instanceof Error ? error.message : "unavailable");
      results.push({
        ok: false,
        request_id: row.id,
        reason: "tokenization_execution_governance_unavailable",
        status: "blocked",
      });
    }
  }

  const success = results.filter((item) => item.ok === true).length;
  const failed = results.length - success;
  const allFailed = results.length > 0 && success === 0;
  return json({
    ok: !allFailed,
    processed: results.length,
    success,
    failed,
    results,
  }, allFailed ? 503 : 200);
}
