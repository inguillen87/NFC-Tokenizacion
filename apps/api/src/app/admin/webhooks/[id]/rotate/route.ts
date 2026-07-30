export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminActor, getAdminPrincipal } from "../../../../../lib/auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../../../lib/bounded-request-body";
import { ensureSdkSchema } from "../../../../../lib/commercial-runtime-schema";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import {
  generateWebhookSigningSecret,
  isWebhookEndpointId,
  normalizeWebhookExpectedSecretVersion,
  normalizeWebhookSecretOverlapSeconds,
  WEBHOOK_ADMIN_BODY_MAX_BYTES,
  webhookAuditRequestMeta,
  webhookLifecycleFailure,
  webhookSecretFingerprint,
} from "../../../../../lib/webhook-lifecycle";
import {
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
  WebhookSecretCipherError,
} from "../../../../../lib/webhook-secret-cipher";
import { checkWebhookPermission } from "../../policy";

function tenantScopeId(req: Request) {
  const principal = getAdminPrincipal(req);
  return principal.scope === "super_admin" ? null : principal.tenantId;
}

function secretStorageError(error: unknown) {
  const reason = error instanceof WebhookSecretCipherError
    ? error.code
    : "webhook_signing_secret_storage_unavailable";
  return json({ ok: false, reason }, 503, { "cache-control": "no-store" });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkWebhookPermission(req, "write");
  if (permission) return permission;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "webhook",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;
  const actor = getAdminActor(req);
  const { id } = await context.params;
  if (!isWebhookEndpointId(id)) return json({ ok: false, reason: "webhook_not_found" }, 404);

  let body: Record<string, unknown>;
  try {
    const parsed = await readBoundedJsonBody<unknown>(req, WEBHOOK_ADMIN_BODY_MAX_BYTES);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SyntaxError("invalid_json_body");
    body = parsed as Record<string, unknown>;
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json_body" }, tooLarge ? 413 : 400);
  }
  for (const forbidden of ["secret", "signingSecret", "signing_secret", "tenant", "tenantId", "tenant_id", "actor", "actorId", "actor_id"]) {
    if (Object.prototype.hasOwnProperty.call(body, forbidden)) {
      return json({ ok: false, reason: "webhook_secret_and_context_server_derived", rejected_field: forbidden }, 400);
    }
  }
  const expectedSecretVersion = normalizeWebhookExpectedSecretVersion(body.expectedSecretVersion ?? body.expected_secret_version);
  if (expectedSecretVersion === null) {
    return json({ ok: false, reason: "webhook_expected_secret_version_required" }, 400);
  }
  const overlapSeconds = normalizeWebhookSecretOverlapSeconds(body.overlapSeconds ?? body.overlap_seconds);
  if (overlapSeconds === null) return json({ ok: false, reason: "webhook_secret_overlap_invalid" }, 400);

  const tenantId = tenantScopeId(req);
  let current: Record<string, any> | undefined;
  try {
    await ensureSdkSchema();
    const rows = await sql/*sql*/`
      SELECT
        id::text AS id,
        tenant_id::text AS tenant_id,
        deleted_at,
        signing_secret,
        signing_secret_version,
        signing_secret_fingerprint,
        updated_at
      FROM webhook_endpoints
      WHERE id = ${id}::uuid
        AND (${tenantId}::uuid IS NULL OR tenant_id = ${tenantId}::uuid)
      LIMIT 1
    `;
    current = rows[0];
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
  if (!current) return json({ ok: false, reason: "webhook_not_found" }, 404);
  if (current.deleted_at) return json({ ok: false, reason: "webhook_explicit_reactivation_required" }, 409);
  if (Number(current.signing_secret_version) !== expectedSecretVersion) {
    return json({ ok: false, reason: "webhook_secret_version_conflict", current_version: Number(current.signing_secret_version) }, 409);
  }
  if (!current.signing_secret) return json({ ok: false, reason: "webhook_signing_secret_missing" }, 409);

  const oneTimeSecret = generateWebhookSigningSecret();
  const fingerprint = webhookSecretFingerprint(oneTimeSecret);
  let encryptedCurrentSecret: string;
  let encryptedPreviousSecret: string;
  let previousFingerprint: string;
  try {
    const previousPlaintext = decryptWebhookSigningSecret(current.signing_secret, { tenantId: String(current.tenant_id) });
    if (!previousPlaintext) return json({ ok: false, reason: "webhook_signing_secret_missing" }, 409);
    previousFingerprint = current.signing_secret_fingerprint || webhookSecretFingerprint(previousPlaintext);
    encryptedPreviousSecret = encryptWebhookSigningSecret(previousPlaintext, { tenantId: String(current.tenant_id) });
    encryptedCurrentSecret = encryptWebhookSigningSecret(oneTimeSecret, { tenantId: String(current.tenant_id) });
  } catch (error) {
    return secretStorageError(error);
  }
  const meta = webhookAuditRequestMeta(req);

  try {
    const rows = await sql/*sql*/`
      WITH locked AS MATERIALIZED (
        SELECT we.*
        FROM webhook_endpoints we
        WHERE we.id = ${id}::uuid
          AND (${tenantId}::uuid IS NULL OR we.tenant_id = ${tenantId}::uuid)
          AND we.deleted_at IS NULL
          AND we.signing_secret_version = ${expectedSecretVersion}
          AND NULLIF(we.signing_secret, '') IS NOT NULL
        FOR UPDATE
      ), eligible AS MATERIALIZED (
        SELECT locked.*
        FROM locked
        WHERE NOT EXISTS (
          SELECT 1
          FROM webhook_deliveries wd
          WHERE wd.endpoint_id = locked.id
            AND wd.status = 'processing'
            AND wd.locked_at > now() - interval '10 minutes'
        )
      ), updated AS (
        UPDATE webhook_endpoints we
        SET
          signing_secret_previous = ${encryptedPreviousSecret},
          signing_secret_previous_version = eligible.signing_secret_version,
          signing_secret_previous_fingerprint = ${previousFingerprint},
          signing_secret_previous_valid_until = now() + (${overlapSeconds} * interval '1 second'),
          signing_secret = ${encryptedCurrentSecret},
          signing_secret_version = eligible.signing_secret_version + 1,
          signing_secret_fingerprint = ${fingerprint},
          signing_secret_rotated_at = now(),
          signing_secret_rotated_by = ${actor.id}::uuid,
          signature_version = 'v2',
          updated_by = ${actor.id}::uuid,
          updated_at = now()
        FROM eligible
        WHERE we.id = eligible.id
        RETURNING we.*
      ), audit AS (
        INSERT INTO webhook_endpoint_audit_events (
          endpoint_id,
          tenant_id,
          actor_id,
          event_type,
          secret_version,
          secret_fingerprint,
          previous_secret_version,
          previous_secret_fingerprint,
          overlap_valid_until,
          request_id,
          ip_address,
          user_agent,
          metadata_json
        )
        SELECT
          updated.id,
          updated.tenant_id,
          ${actor.id}::uuid,
          'webhook_secret_rotated',
          updated.signing_secret_version,
          updated.signing_secret_fingerprint,
          updated.signing_secret_previous_version,
          updated.signing_secret_previous_fingerprint,
          updated.signing_secret_previous_valid_until,
          ${meta.requestId},
          ${meta.ipAddress},
          ${meta.userAgent},
          ${JSON.stringify({ overlap_seconds: overlapSeconds, signature_version: "v2" })}::jsonb
        FROM updated
        RETURNING id
      )
      SELECT
        updated.id::text AS id,
        updated.enabled,
        updated.signature_version,
        updated.signing_secret_version,
        updated.signing_secret_fingerprint,
        updated.signing_secret_previous_version,
        updated.signing_secret_previous_fingerprint,
        updated.signing_secret_previous_valid_until,
        updated.signing_secret_rotated_at,
        EXISTS (SELECT 1 FROM audit) AS audit_committed
      FROM updated
    `;
    if (!rows[0]) return json({ ok: false, reason: "webhook_rotation_busy_or_changed" }, 409);
    return json({
      ok: true,
      endpoint: rows[0],
      secret: oneTimeSecret,
      warning: "Store this secret now. nexID will not show it again.",
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
}
