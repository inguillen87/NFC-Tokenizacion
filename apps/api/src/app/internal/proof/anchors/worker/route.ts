export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, timingSafeEqual } from "node:crypto";
import { json } from "../../../../../lib/http";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";
import {
  claimIotaEvidenceAnchors,
  processIotaEvidenceAnchor,
} from "../../../../../lib/iota-evidence-reconciler";
import { enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";

function secretMatches(provided: string, expected: string) {
  if (!provided || !expected) return false;
  const left = createHash("sha256").update(provided, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

function isAuthorized(req: Request) {
  const expected = String(process.env.INTERNAL_PROOF_ANCHOR_KEY || "").trim();
  const provided = String(req.headers.get("x-internal-proof-anchor-key") || "").trim();
  return Boolean(expected && secretMatches(provided, expected));
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return json({ ok: false, reason: "unauthorized" }, 401);
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "platform",
    subjectId: "internal:proof-anchor-worker",
    globalPrincipal: true,
  });
  if (rateLimited) return rateLimited;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const requestedLimit = Number(body.limit || 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 10;

  await ensureSupplierOpsSchema();
  const claimed = await claimIotaEvidenceAnchors(limit) as Array<{ id: string; tenant_id: string }>;
  const results: Array<Record<string, unknown>> = [];
  for (const row of claimed) {
    const result = await processIotaEvidenceAnchor(String(row.id), String(row.tenant_id));
    results.push({
      anchor_id: row.id,
      ok: result.ok,
      status: result.anchor?.status || null,
      reason: result.ok ? null : result.reason,
      tx_hash: result.anchor?.tx_hash || null,
      proof_id: result.anchor?.proof_id || null,
    });
  }

  return json({
    ok: true,
    claimed: claimed.length,
    confirmed: results.filter((result) => result.status === "confirmed").length,
    pending: results.filter((result) => ["pending", "submitted", "reconciling"].includes(String(result.status))).length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  });
}
