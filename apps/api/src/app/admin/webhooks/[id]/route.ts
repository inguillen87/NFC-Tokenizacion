export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminActor, getAdminPrincipal } from "../../../../lib/auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../../lib/bounded-request-body";
import { ensureSdkSchema } from "../../../../lib/commercial-runtime-schema";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { normalizeWebhookUrl, resolveWebhookDestination, safeWebhookError } from "../../../../lib/webhook-egress";
import {
  isWebhookEndpointId,
  normalizeWebhookName,
  parseWebhookEvents,
  safeWebhookEndpointProjection,
  WEBHOOK_ADMIN_BODY_MAX_BYTES,
  WEBHOOK_URL_MAX_LENGTH,
  webhookAuditRequestMeta,
  webhookLifecycleFailure,
} from "../../../../lib/webhook-lifecycle";
import { normalizeWebhookSignatureVersion } from "../../../../lib/webhook-signing";
import { checkWebhookPermission } from "../policy";

const SERVER_DERIVED_OR_SECRET_FIELDS = [
  "tenant",
  "tenant_id",
  "tenantId",
  "tenant_slug",
  "tenantSlug",
  "actor",
  "actor_id",
  "actorId",
  "created_by",
  "createdBy",
  "updated_by",
  "updatedBy",
  "deleted_at",
  "deletedAt",
  "deleted_by",
  "deletedBy",
  "disabled_at",
  "disabledAt",
  "disabled_by",
  "disabledBy",
  "reactivated_at",
  "reactivatedAt",
  "reactivated_by",
  "reactivatedBy",
  "signingSecret",
  "signing_secret",
  "secret",
  "signing_secret_version",
  "signingSecretVersion",
  "signing_secret_fingerprint",
  "signingSecretFingerprint",
  "signing_secret_previous",
  "signingSecretPrevious",
] as const;

function hasOwn(input: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function tenantScopeId(req: Request) {
  const principal = getAdminPrincipal(req);
  return principal.scope === "super_admin" ? null : principal.tenantId;
}

function invalidBody(error: unknown) {
  const tooLarge = error instanceof RequestBodyTooLargeError;
  return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json_body" }, tooLarge ? 413 : 400);
}

async function endpointState(id: string, tenantId: string | null) {
  const rows = await sql/*sql*/`
    SELECT
      id::text AS id,
      tenant_id::text AS tenant_id,
      url,
      enabled,
      deleted_at,
      signing_secret_version,
      updated_at
    FROM webhook_endpoints
    WHERE id = ${id}::uuid
      AND (${tenantId}::uuid IS NULL OR tenant_id = ${tenantId}::uuid)
    LIMIT 1
  `;
  return rows[0] as {
    id: string;
    tenant_id: string;
    url: string;
    enabled: boolean;
    deleted_at: string | null;
    signing_secret_version: number;
    updated_at: string;
  } | undefined;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkWebhookPermission(req, "read");
  if (permission) return permission;
  const { id } = await context.params;
  if (!isWebhookEndpointId(id)) return json({ ok: false, reason: "webhook_not_found" }, 404);
  const tenantId = tenantScopeId(req);

  try {
    await ensureSdkSchema();
    const rows = await sql/*sql*/`
      SELECT
        we.id::text AS id,
        we.tenant_id::text AS tenant_id,
        tn.slug AS tenant_slug,
        we.name,
        we.url,
        we.enabled,
        CASE WHEN we.deleted_at IS NOT NULL THEN 'deleted' WHEN we.enabled THEN 'active' ELSE 'disabled' END AS lifecycle_status,
        we.events,
        we.signature_version,
        (we.signing_secret IS NOT NULL AND we.signing_secret <> '') AS has_signing_secret,
        we.signing_secret_version,
        we.signing_secret_fingerprint,
        we.signing_secret_previous_version,
        we.signing_secret_previous_fingerprint,
        we.signing_secret_previous_valid_until,
        COALESCE(we.signing_secret_previous_valid_until > now(), false) AS previous_secret_overlap_active,
        we.signing_secret_rotated_at,
        we.disabled_at,
        we.deleted_at,
        we.reactivated_at,
        we.created_at,
        we.updated_at
      FROM webhook_endpoints we
      JOIN tenants tn ON tn.id = we.tenant_id
      WHERE we.id = ${id}::uuid
        AND (${tenantId}::uuid IS NULL OR we.tenant_id = ${tenantId}::uuid)
      LIMIT 1
    `;
    if (!rows[0]) return json({ ok: false, reason: "webhook_not_found" }, 404);
    const history = await sql/*sql*/`
      SELECT
        id::text AS id,
        event_type,
        secret_version,
        secret_fingerprint,
        previous_secret_version,
        previous_secret_fingerprint,
        overlap_valid_until,
        request_id,
        metadata_json,
        created_at
      FROM webhook_endpoint_audit_events
      WHERE endpoint_id = ${id}::uuid
        AND tenant_id = ${rows[0].tenant_id}::uuid
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `;
    return json({ ok: true, endpoint: safeWebhookEndpointProjection(rows[0]), history }, 200, { "cache-control": "no-store" });
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkWebhookPermission(req, "write");
  if (permission) return permission;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "webhook",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;
  const principal = getAdminPrincipal(req);
  const actor = getAdminActor(req);
  const { id } = await context.params;
  if (!isWebhookEndpointId(id)) return json({ ok: false, reason: "webhook_not_found" }, 404);

  let body: Record<string, unknown>;
  try {
    const parsed = await readBoundedJsonBody<unknown>(req, WEBHOOK_ADMIN_BODY_MAX_BYTES);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SyntaxError("invalid_json_body");
    body = parsed as Record<string, unknown>;
  } catch (error) {
    return invalidBody(error);
  }
  const forgedFields = SERVER_DERIVED_OR_SECRET_FIELDS.filter((field) => hasOwn(body, field));
  if (forgedFields.length) {
    return json({ ok: false, reason: "webhook_secret_rotation_route_required", rejected_fields: forgedFields }, 400);
  }
  if (body.enabled === true) {
    return json({ ok: false, reason: "webhook_explicit_reactivation_required" }, 409);
  }
  if (body.enabled !== undefined && body.enabled !== false) {
    return json({ ok: false, reason: "webhook_enabled_invalid" }, 400);
  }

  const nameProvided = hasOwn(body, "name");
  const name = nameProvided ? normalizeWebhookName(body.name) : null;
  if (nameProvided && !name) return json({ ok: false, reason: "webhook_name_invalid" }, 400);
  const urlProvided = hasOwn(body, "url");
  const rawUrl = urlProvided ? String(body.url || "").trim() : "";
  if (urlProvided && !rawUrl) return json({ ok: false, reason: "webhook_url_required" }, 400);
  if (rawUrl.length > WEBHOOK_URL_MAX_LENGTH) return json({ ok: false, reason: "webhook_url_too_long" }, 400);

  const eventsProvided = hasOwn(body, "events");
  const eventsResult = eventsProvided ? parseWebhookEvents(body.events) : null;
  if (eventsResult && !eventsResult.ok) return json({ ok: false, reason: eventsResult.reason }, 400);
  const rawSignatureVersion = hasOwn(body, "signatureVersion") || hasOwn(body, "signature_version")
    ? String(body.signatureVersion || body.signature_version || "").trim()
    : "";
  const signatureVersion = rawSignatureVersion ? normalizeWebhookSignatureVersion(rawSignatureVersion) : null;
  if (rawSignatureVersion && signatureVersion !== "v2") {
    return json({ ok: false, reason: "webhook_signature_v2_required" }, 400);
  }
  const disableRequested = body.enabled === false;
  if (!nameProvided && !urlProvided && !eventsProvided && !rawSignatureVersion && !disableRequested) {
    return json({ ok: false, reason: "webhook_update_required" }, 400);
  }

  const tenantId = tenantScopeId(req);
  let current;
  try {
    await ensureSdkSchema();
    current = await endpointState(id, tenantId);
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
  if (!current) return json({ ok: false, reason: "webhook_not_found" }, 404);
  if (current.deleted_at) return json({ ok: false, reason: "webhook_explicit_reactivation_required" }, 409);

  let url: string | null = null;
  try {
    url = urlProvided ? normalizeWebhookUrl(rawUrl).toString() : null;
    if (current.enabled && !disableRequested) await resolveWebhookDestination(url || current.url);
  } catch (error) {
    return json({ ok: false, reason: safeWebhookError(error).code }, 400);
  }

  const changedFields = [
    nameProvided ? "name" : null,
    urlProvided ? "url" : null,
    eventsProvided ? "events" : null,
    rawSignatureVersion ? "signature_version" : null,
    disableRequested ? "enabled" : null,
  ].filter(Boolean);
  const meta = webhookAuditRequestMeta(req);

  try {
    const rows = await sql/*sql*/`
      WITH locked AS MATERIALIZED (
        SELECT we.*
        FROM webhook_endpoints we
        WHERE we.id = ${id}::uuid
          AND (${tenantId}::uuid IS NULL OR we.tenant_id = ${tenantId}::uuid)
          AND we.deleted_at IS NULL
          AND we.updated_at = ${current.updated_at}::timestamptz
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
          name = COALESCE(${name}, we.name),
          url = COALESCE(${url}, we.url),
          events = COALESCE(${eventsResult?.ok ? JSON.stringify(eventsResult.events) : null}::jsonb, we.events),
          signature_version = COALESCE(${signatureVersion}, we.signature_version),
          enabled = CASE WHEN ${disableRequested} THEN false ELSE we.enabled END,
          disabled_at = CASE WHEN ${disableRequested} AND eligible.enabled THEN now() ELSE we.disabled_at END,
          disabled_by = CASE WHEN ${disableRequested} AND eligible.enabled THEN ${actor.id}::uuid ELSE we.disabled_by END,
          updated_by = ${actor.id}::uuid,
          updated_at = now()
        FROM eligible
        WHERE we.id = eligible.id
        RETURNING
          we.*,
          eligible.enabled AS previous_enabled
      ), cancelled_deliveries AS (
        UPDATE webhook_deliveries wd
        SET
          status = 'dead_letter',
          ok = false,
          next_attempt_at = NULL,
          last_error = 'webhook_endpoint_disabled',
          locked_at = NULL,
          lock_token = NULL
        FROM updated
        WHERE ${disableRequested}
          AND wd.endpoint_id = updated.id
          AND wd.status IN ('pending', 'retry_scheduled')
        RETURNING wd.id
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
          CASE WHEN updated.previous_enabled AND NOT updated.enabled THEN 'webhook_endpoint_disabled' ELSE 'webhook_endpoint_updated' END,
          updated.signing_secret_version,
          updated.signing_secret_fingerprint,
          updated.signing_secret_previous_version,
          updated.signing_secret_previous_fingerprint,
          updated.signing_secret_previous_valid_until,
          ${meta.requestId},
          ${meta.ipAddress},
          ${meta.userAgent},
          jsonb_build_object(
            'changed_fields', ${JSON.stringify(changedFields)}::jsonb,
            'cancelled_deliveries', (SELECT count(*) FROM cancelled_deliveries)
          )
        FROM updated
        RETURNING id
      )
      SELECT
        updated.id::text AS id,
        updated.tenant_id::text AS tenant_id,
        updated.name,
        updated.url,
        updated.enabled,
        CASE WHEN updated.enabled THEN 'active' ELSE 'disabled' END AS lifecycle_status,
        updated.events,
        updated.signature_version,
        (updated.signing_secret IS NOT NULL AND updated.signing_secret <> '') AS has_signing_secret,
        updated.signing_secret_version,
        updated.signing_secret_fingerprint,
        updated.signing_secret_previous_version,
        updated.signing_secret_previous_fingerprint,
        updated.signing_secret_previous_valid_until,
        updated.disabled_at,
        updated.updated_at,
        EXISTS (SELECT 1 FROM audit) AS audit_committed
      FROM updated
    `;
    if (!rows[0]) return json({ ok: false, reason: "webhook_endpoint_busy_or_changed" }, 409);
    return json({ ok: true, endpoint: safeWebhookEndpointProjection(rows[0]) }, 200, { "cache-control": "no-store" });
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
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
  const tenantId = tenantScopeId(req);
  const meta = webhookAuditRequestMeta(req);

  try {
    await ensureSdkSchema();
    const rows = await sql/*sql*/`
      WITH locked AS MATERIALIZED (
        SELECT we.*
        FROM webhook_endpoints we
        WHERE we.id = ${id}::uuid
          AND (${tenantId}::uuid IS NULL OR we.tenant_id = ${tenantId}::uuid)
        FOR UPDATE
      ), eligible AS MATERIALIZED (
        SELECT locked.*
        FROM locked
        WHERE locked.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM webhook_deliveries wd
            WHERE wd.endpoint_id = locked.id
              AND wd.status = 'processing'
              AND wd.locked_at > now() - interval '10 minutes'
          )
      ), updated AS (
        UPDATE webhook_endpoints we
        SET
          enabled = false,
          disabled_at = COALESCE(we.disabled_at, now()),
          disabled_by = COALESCE(we.disabled_by, ${actor.id}::uuid),
          deleted_at = now(),
          deleted_by = ${actor.id}::uuid,
          updated_by = ${actor.id}::uuid,
          signing_secret = NULL,
          signing_secret_previous = NULL,
          signing_secret_previous_version = NULL,
          signing_secret_previous_fingerprint = NULL,
          signing_secret_previous_valid_until = NULL,
          updated_at = now()
        FROM eligible
        WHERE we.id = eligible.id
        RETURNING
          we.*,
          eligible.signing_secret_version AS audit_secret_version,
          eligible.signing_secret_fingerprint AS audit_secret_fingerprint,
          eligible.signing_secret_previous_version AS audit_previous_secret_version,
          eligible.signing_secret_previous_fingerprint AS audit_previous_secret_fingerprint,
          eligible.signing_secret_previous_valid_until AS audit_overlap_valid_until
      ), cancelled_deliveries AS (
        UPDATE webhook_deliveries wd
        SET
          status = 'dead_letter',
          ok = false,
          next_attempt_at = NULL,
          last_error = 'webhook_endpoint_deleted',
          locked_at = NULL,
          lock_token = NULL
        FROM updated
        WHERE wd.endpoint_id = updated.id
          AND wd.status IN ('pending', 'retry_scheduled')
        RETURNING wd.id
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
          'webhook_endpoint_deleted',
          updated.audit_secret_version,
          updated.audit_secret_fingerprint,
          updated.audit_previous_secret_version,
          updated.audit_previous_secret_fingerprint,
          updated.audit_overlap_valid_until,
          ${meta.requestId},
          ${meta.ipAddress},
          ${meta.userAgent},
          jsonb_build_object(
            'secret_material_destroyed', true,
            'cancelled_deliveries', (SELECT count(*) FROM cancelled_deliveries)
          )
        FROM updated
        RETURNING id
      )
      SELECT
        updated.id::text AS id,
        updated.deleted_at,
        updated.signing_secret_fingerprint,
        updated.signing_secret_version,
        EXISTS (SELECT 1 FROM audit) AS audit_committed
      FROM updated
    `;
    if (rows[0]) {
      return json({ ok: true, deleted: rows[0].id, lifecycle_status: "deleted", deleted_at: rows[0].deleted_at }, 200, { "cache-control": "no-store" });
    }
    const current = await endpointState(id, tenantId);
    if (!current) return json({ ok: false, reason: "webhook_not_found" }, 404);
    if (current.deleted_at) {
      return json({ ok: true, deleted: current.id, lifecycle_status: "deleted", already_deleted: true }, 200, { "cache-control": "no-store" });
    }
    return json({ ok: false, reason: "webhook_endpoint_busy" }, 409);
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
}
