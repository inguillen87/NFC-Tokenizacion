export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import {
  checkAdmin,
  getAdminActor,
  getAdminPrincipal,
} from "../../../../../../../lib/auth";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../../lib/bounded-request-body";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../../../../lib/critical-rate-limit";
import { sql } from "../../../../../../../lib/db";
import { json } from "../../../../../../../lib/http";
import { getRequestMeta } from "../../../../../../../lib/request-meta";
import { ensureSupplierOpsSchema } from "../../../../../../../lib/supplier-ops-schema";
import {
  normalizeTenantVaultDownloadIdempotencyKey,
  normalizeTenantVaultDownloadReason,
  tenantVaultDownloadFilename,
} from "../../../../../../../lib/tenant-vault";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const MAX_REQUEST_BYTES = 4 * 1024;
const MAX_ENCRYPTED_PACK_BYTES = 64 * 1024 * 1024;

function responseHeaders(extra: Record<string, string> = {}) {
  return {
    "cache-control": "private, no-store, max-age=0",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...extra,
  };
}

function failure(reason: string, status: number, extra: Record<string, unknown> = {}) {
  return json({ ok: false, reason, ...extra }, status, responseHeaders());
}

function safeDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown_error";
  const code = String((error as { code?: unknown }).code || "");
  return /^[A-Za-z0-9_-]{1,32}$/.test(code) ? code : "unknown_error";
}

function normalizeTenantIdentifier(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return UUID_PATTERN.test(normalized) || TENANT_SLUG_PATTERN.test(normalized) ? normalized : "";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; artifactId: string }> },
) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;

  const principal = getAdminPrincipal(req);
  const actor = getAdminActor(req);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    ...adminCriticalRateLimitIdentity(req),
    tenantWide: true,
  });
  if (limited) return limited;
  if (!principal.mfaVerified) {
    return failure("tenant_vault_download_mfa_required", 403);
  }

  const { tenantId, artifactId } = await params;
  const requestedTenant = normalizeTenantIdentifier(tenantId);
  if (!requestedTenant || !UUID_PATTERN.test(artifactId)) {
    return failure("tenant_vault_artifact_not_found", 404);
  }

  const idempotencyKey = normalizeTenantVaultDownloadIdempotencyKey(req.headers.get("idempotency-key"));
  if (!idempotencyKey) {
    return failure("tenant_vault_download_idempotency_key_required", 400);
  }

  let body: { reason?: unknown };
  try {
    body = await readBoundedJsonBody<{ reason?: unknown }>(req, MAX_REQUEST_BYTES);
  } catch (error) {
    return failure(
      error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json",
      error instanceof RequestBodyTooLargeError ? 413 : 400,
    );
  }
  const reason = normalizeTenantVaultDownloadReason(body.reason);
  if (!reason) {
    return failure("tenant_vault_download_reason_required", 400, { min_length: 12, max_length: 240 });
  }

  const meta = getRequestMeta(req);
  try {
    await ensureSupplierOpsSchema();
    const tenantRows = UUID_PATTERN.test(requestedTenant)
      ? await sql/*sql*/`SELECT id FROM tenants WHERE id = ${requestedTenant}::uuid LIMIT 1`
      : await sql/*sql*/`SELECT id FROM tenants WHERE lower(slug) = ${requestedTenant} LIMIT 1`;
    const tenant = tenantRows[0];
    if (!tenant) return failure("tenant_vault_artifact_not_found", 404);

    const rows = await sql/*sql*/`
      WITH authorized_session AS MATERIALIZED (
        SELECT auth_session.id
        FROM auth_sessions auth_session
        JOIN users session_actor
          ON session_actor.id = auth_session.user_id
        JOIN memberships membership
          ON membership.user_id = session_actor.id
         AND membership.role = auth_session.role
         AND membership.tenant_id IS NOT DISTINCT FROM auth_session.tenant_id
        WHERE auth_session.id = ${principal.sessionId}::uuid
          AND auth_session.user_id = ${actor.id}::uuid
          AND auth_session.role::text = 'super_admin'
          AND auth_session.tenant_id IS NULL
          AND auth_session.mfa_verified IS TRUE
          AND auth_session.revoked_at IS NULL
          AND auth_session.expires_at > now()
          AND session_actor.admin_status::text = 'active'
          AND membership.role::text = 'super_admin'
          AND membership.tenant_id IS NULL
        FOR SHARE OF auth_session, session_actor, membership
      ),
      target AS MATERIALIZED (
        SELECT
          artifact.id,
          artifact.tenant_id,
          artifact.content_hash,
          artifact.mime_type,
          artifact.encrypted_payload_base64,
          artifact.metadata_json,
          artifact.download_count,
          artifact.last_downloaded_at,
          lower(regexp_replace(artifact.content_hash, '^sha256:', '')) =
            encode(digest(decode(artifact.encrypted_payload_base64, 'base64'), 'sha256'), 'hex') AS integrity_ok,
          octet_length(decode(artifact.encrypted_payload_base64, 'base64'))::int AS payload_bytes
        FROM vault_artifacts artifact
        WHERE artifact.id = ${artifactId}::uuid
          AND artifact.tenant_id = ${tenant.id}::uuid
          AND artifact.artifact_type = 'supplier_pack_zip_encrypted'
          AND artifact.status = 'active'
          AND artifact.delivery_status = 'ready'
          AND artifact.encrypted_payload_base64 IS NOT NULL
        FOR UPDATE OF artifact
      ),
      existing_download AS MATERIALIZED (
        SELECT download.*
        FROM vault_artifact_downloads download
        JOIN target ON target.id = download.artifact_id
        JOIN authorized_session ON true
        WHERE download.idempotency_key = ${idempotencyKey}
          AND download.actor_id = ${actor.id}::uuid
          AND download.auth_session_id = ${principal.sessionId}::uuid
          AND download.reason = ${reason}
        LIMIT 1
      ),
      download_candidate AS MATERIALIZED (
        SELECT
          target.*,
          'sha256:' || encode(digest(convert_to(
            concat_ws(':', target.tenant_id::text, target.id::text, ${actor.id}, ${principal.sessionId}, ${idempotencyKey}, ${reason}, target.content_hash),
            'UTF8'
          ), 'sha256'), 'hex') AS receipt_sha256
        FROM target
        WHERE target.integrity_ok
          AND target.payload_bytes BETWEEN 1 AND ${MAX_ENCRYPTED_PACK_BYTES}
          AND EXISTS (SELECT 1 FROM authorized_session)
          AND NOT EXISTS (SELECT 1 FROM existing_download)
      ),
      inserted_download AS (
        INSERT INTO vault_artifact_downloads (
          tenant_id, artifact_id, actor_id, auth_session_id, idempotency_key,
          reason, content_hash, receipt_sha256, request_id
        )
        SELECT
          candidate.tenant_id, candidate.id, ${actor.id}::uuid, ${principal.sessionId}::uuid,
          ${idempotencyKey}, ${reason}, candidate.content_hash, candidate.receipt_sha256, ${meta.traceId}
        FROM download_candidate candidate
        ON CONFLICT (artifact_id, idempotency_key) DO NOTHING
        RETURNING *
      ),
      effective_download AS MATERIALIZED (
        SELECT inserted_download.*, false AS replayed
        FROM inserted_download
        UNION ALL
        SELECT existing_download.*, true AS replayed
        FROM existing_download
        WHERE NOT EXISTS (SELECT 1 FROM inserted_download)
        LIMIT 1
      ),
      updated_artifact AS (
        UPDATE vault_artifacts artifact
        SET download_count = artifact.download_count + 1,
            last_downloaded_at = inserted_download.downloaded_at
        FROM inserted_download
        WHERE artifact.id = inserted_download.artifact_id
        RETURNING artifact.download_count, artifact.last_downloaded_at
      ),
      inserted_audit AS (
        INSERT INTO audit_logs (
          actor_id, tenant_id, action, resource_type, resource_id,
          after_hash, user_agent, request_id
        )
        SELECT
          inserted_download.actor_id, inserted_download.tenant_id,
          'supplier_pack_downloaded', 'vault_artifact', inserted_download.artifact_id::text,
          replace(inserted_download.receipt_sha256, 'sha256:', ''), ${req.headers.get("user-agent") || null}, ${meta.traceId}
        FROM inserted_download
        RETURNING id
      )
      SELECT
        target.id,
        target.content_hash,
        target.mime_type,
        target.encrypted_payload_base64,
        target.metadata_json,
        target.integrity_ok,
        target.payload_bytes,
        EXISTS (SELECT 1 FROM authorized_session) AS authorized_session_ok,
        COALESCE(updated_artifact.download_count, target.download_count) AS download_count,
        COALESCE(updated_artifact.last_downloaded_at, target.last_downloaded_at) AS last_downloaded_at,
        effective_download.receipt_sha256,
        effective_download.replayed,
        (SELECT id FROM inserted_audit LIMIT 1) AS audit_id
      FROM target
      LEFT JOIN effective_download ON true
      LEFT JOIN updated_artifact ON true
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return failure("tenant_vault_artifact_not_found", 404);
    if (row.authorized_session_ok !== true) {
      return failure("tenant_vault_download_session_not_current", 403);
    }
    if (row.integrity_ok !== true) return failure("tenant_vault_artifact_integrity_failed", 409);
    if (Number(row.payload_bytes || 0) < 1) {
      return failure("tenant_vault_artifact_integrity_failed", 409);
    }
    if (Number(row.payload_bytes || 0) > MAX_ENCRYPTED_PACK_BYTES) {
      return failure("tenant_vault_artifact_too_large", 413);
    }
    if (!row.receipt_sha256) return failure("tenant_vault_download_idempotency_conflict", 409);

    const encoded = String(row.encrypted_payload_base64 || "");
    const payload = Buffer.from(encoded, "base64");
    const expectedHash = String(row.content_hash || "").toLowerCase().replace(/^sha256:/, "");
    const actualHash = createHash("sha256").update(payload).digest("hex");
    if (!payload.length || payload.length > MAX_ENCRYPTED_PACK_BYTES || actualHash !== expectedHash) {
      return failure("tenant_vault_artifact_integrity_failed", 409);
    }

    const metadata = row.metadata_json && typeof row.metadata_json === "object" && !Array.isArray(row.metadata_json)
      ? row.metadata_json as Record<string, unknown>
      : {};
    const filename = tenantVaultDownloadFilename(metadata.filename, row.id);
    return new Response(payload, {
      status: 200,
      headers: responseHeaders({
        "content-type": "application/vnd.nexid.supplier-pack+json",
        "content-disposition": `attachment; filename="${filename}"`,
        "content-length": String(payload.length),
        "x-nexid-artifact-sha256": `sha256:${actualHash}`,
        "x-nexid-audit-receipt": String(row.receipt_sha256),
        "x-nexid-download-count": String(Number(row.download_count || 0)),
        "x-nexid-idempotent-replay": row.replayed === true ? "true" : "false",
      }),
    });
  } catch (error) {
    const code = safeDatabaseErrorCode(error);
    console.error("[tenant_vault_download_failed]", code);
    return failure("tenant_vault_download_unavailable", 503, {
      ...(new Set(["42P01", "42703"]).has(code)
        ? { required_migration: "20260802190000_0084_tenant_vault_audited_download.sql" }
        : {}),
    });
  }
}
