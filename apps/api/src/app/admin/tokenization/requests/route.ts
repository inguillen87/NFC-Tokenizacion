export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { anchorTokenizationRequest } from "../../../../lib/tokenization-engine";
import { ensureTokenizationRequestsSchema } from "../../../../lib/tokenization-schema";

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function GET(req: Request): Promise<Response> {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 500);
  const tenant = clean(searchParams.get("tenant"));
  const status = clean(searchParams.get("status"));

  try {
    await ensureTokenizationRequestsSchema();

    const rows = tenant
      ? await sql/*sql*/`
        SELECT
          tr.id,
          tr.status,
          tr.network,
          tn.slug AS tenant_slug,
          tr.bid,
          tr.uid_hex,
          tr.asset_ref,
          tr.issuer_wallet,
          tr.tx_hash,
          tr.token_id,
          tr.anchor_hash,
          tr.external_ref,
          tr.requested_by,
          tr.requested_at,
          tr.processed_at,
          tr.processed_at AS anchored_at,
          tr.attempt_count,
          tr.last_error,
          tr.next_attempt_at,
          tr.meta
        FROM tokenization_requests tr
        LEFT JOIN tenants tn ON tn.id = tr.tenant_id
        WHERE tn.slug = ${tenant}
          AND (${status || null}::text IS NULL OR tr.status = ${status})
        ORDER BY tr.requested_at DESC
        LIMIT ${limit}
      `
      : await sql/*sql*/`
        SELECT
          tr.id,
          tr.status,
          tr.network,
          tn.slug AS tenant_slug,
          tr.bid,
          tr.uid_hex,
          tr.asset_ref,
          tr.issuer_wallet,
          tr.tx_hash,
          tr.token_id,
          tr.anchor_hash,
          tr.external_ref,
          tr.requested_by,
          tr.requested_at,
          tr.processed_at,
          tr.processed_at AS anchored_at,
          tr.attempt_count,
          tr.last_error,
          tr.next_attempt_at,
          tr.meta
        FROM tokenization_requests tr
        LEFT JOIN tenants tn ON tn.id = tr.tenant_id
        WHERE (${status || null}::text IS NULL OR tr.status = ${status})
        ORDER BY tr.requested_at DESC
        LIMIT ${limit}
      `;
    return json({ ok: true, rows });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "tokenization_requests_unavailable";
    console.error("[admin_tokenization_requests_get]", reason);
    return json({ ok: false, reason: "tokenization_requests_unavailable", detail: reason }, 500);
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const requestId = clean(body.request_id || body.id);
  const network = clean(body.network) || "polygon-amoy";
  const issuerWallet = clean(body.issuer_wallet) || null;

  if (!requestId) return json({ ok: false, reason: "request_id required" }, 400);

  await ensureTokenizationRequestsSchema();
  const result = await anchorTokenizationRequest({
    requestId,
    network,
    issuerWallet,
    processor: "admin_tokenize_endpoint",
  });
  if (!result.ok && result.reason === "request_not_found") return json({ ok: false, reason: "request not found" }, 404);
  if (!result.ok) return json(result, 400);
  return json(result);
}
