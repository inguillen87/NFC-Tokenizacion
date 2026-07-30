export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, checkAdminPermission, getAdminTenantScope } from "../../../../lib/auth";
import { effectiveTenantFilter } from "../../../../lib/admin-tenant-filter";
import { resolveTokenizationRequestTenantId } from "../../../../lib/admin-tokenization-scope";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { anchorTokenizationRequest } from "../../../../lib/tokenization-engine";
import { ensureTokenizationCommercialScopeSchema } from "../../../../lib/tokenization-schema";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { tokenizationExecutionGovernanceError } from "../../../../lib/tokenization-execution-policy";

const MAX_TOKENIZATION_EXECUTION_BODY_BYTES = 4 * 1024;

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function GET(req: Request): Promise<Response> {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "tokenization:read");
  if (permission) return permission;

  const { searchParams } = new URL(req.url);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 100), 1), 500);
  const tenant = effectiveTenantFilter({
    forcedTenantSlug,
    requestedTenantSlug: searchParams.get("tenant"),
  });
  const status = clean(searchParams.get("status"));

  try {
    await ensureTokenizationCommercialScopeSchema();

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
    return json({ ok: false, reason: "tokenization_requests_unavailable" }, 503);
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "tokenization:write");
  if (permission) return permission;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;

  const { forcedTenantSlug } = getAdminTenantScope(req);
  let body: Record<string, unknown>;
  try {
    const parsed = await readBoundedJsonBody<unknown>(req, MAX_TOKENIZATION_EXECUTION_BODY_BYTES);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ ok: false, reason: "tokenization_execution_body_invalid" }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json({ ok: false, reason: "request_body_too_large" }, 413);
    }
    return json({ ok: false, reason: "tokenization_execution_body_invalid" }, 400);
  }
  const allowedFields = new Set(["request_id", "id", "network", "issuer_wallet"]);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    return json({ ok: false, reason: "tokenization_execution_body_fields_invalid" }, 400);
  }
  const requestId = clean(body.request_id || body.id);
  // Legacy clients may echo these values, but the engine only accepts them as
  // equality assertions. The persisted request and DB prepare function remain
  // authoritative for network, execution class and recipient.
  const network = clean(body.network) || undefined;
  const issuerWallet = body.issuer_wallet == null ? undefined : clean(body.issuer_wallet);

  if (!requestId) return json({ ok: false, reason: "request_id required" }, 400);

  try {
    await ensureTokenizationCommercialScopeSchema();
    const tenantId = await resolveTokenizationRequestTenantId({ requestId, forcedTenantSlug });
    if (!tenantId) return json({ ok: false, reason: "request not found" }, 404);

    const result = await anchorTokenizationRequest({
      requestId,
      tenantId,
      network,
      issuerWallet,
      processor: "admin_tokenize_endpoint",
    });
    if (!result.ok && result.reason === "request_not_found") return json({ ok: false, reason: "request not found" }, 404);
    if (!result.ok && result.status === "reconciling") return json(result, 202);
    if (!result.ok && ["processing", "blocked"].includes(String(result.status || ""))) return json(result, 409);
    if (!result.ok) return json(result, 503);
    return json(result);
  } catch (error) {
    console.error("[admin_tokenization_requests_post]", error instanceof Error ? error.message : "unavailable");
    const mapped = tokenizationExecutionGovernanceError(error);
    return json({
      ok: false,
      reason: mapped.reason,
      ...(mapped.requiredMigration ? { required_migration: mapped.requiredMigration } : {}),
    }, mapped.status);
  }
}
