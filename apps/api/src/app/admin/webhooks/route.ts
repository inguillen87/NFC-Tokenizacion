export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminPrincipal } from "../../../lib/auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/bounded-request-body";
import { ensureSdkSchema } from "../../../lib/commercial-runtime-schema";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { normalizeWebhookUrl, resolveWebhookDestination, safeWebhookError } from "../../../lib/webhook-egress";
import {
  generateWebhookSigningSecret,
  normalizeWebhookName,
  parseWebhookEvents,
  resolveWebhookTenant,
  safeWebhookEndpointProjection,
  WEBHOOK_ADMIN_BODY_MAX_BYTES,
  WEBHOOK_URL_MAX_LENGTH,
  webhookAuditRequestMeta,
  webhookLifecycleFailure,
  webhookSecretFingerprint,
} from "../../../lib/webhook-lifecycle";
import {
  encryptWebhookSigningSecret,
  WebhookSecretCipherError,
} from "../../../lib/webhook-secret-cipher";
import { normalizeWebhookSignatureVersion } from "../../../lib/webhook-signing";
import { checkWebhookPermission } from "./policy";

const DEFAULT_EVENTS = ["sdk.verify", "sdk.claim.created", "sdk.external_event", "sdk.pos.activated"];
const SERVER_DERIVED_FIELDS = [
  "id",
  "tenant_id",
  "tenantId",
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
  "signingSecret",
  "signing_secret",
  "secret",
  "signing_secret_version",
  "signingSecretVersion",
  "signing_secret_fingerprint",
  "signingSecretFingerprint",
] as const;

function hasOwn(input: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function secretStorageError(error: unknown) {
  const reason = error instanceof WebhookSecretCipherError
    ? error.code
    : "webhook_signing_secret_storage_unavailable";
  return json({ ok: false, reason }, 503, { "cache-control": "no-store" });
}

function invalidBody(error: unknown) {
  const tooLarge = error instanceof RequestBodyTooLargeError;
  return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json_body" }, tooLarge ? 413 : 400);
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkWebhookPermission(req, "read");
  if (permission) return permission;
  const principal = getAdminPrincipal(req);

  try {
    await ensureSdkSchema();
    const requestedTenant = new URL(req.url).searchParams.get("tenant");
    const tenant = await resolveWebhookTenant(principal, requestedTenant);
    if ((principal.scope !== "super_admin" || requestedTenant) && !tenant) {
      return json({ ok: false, reason: "tenant_not_found" }, 404);
    }

    const rows = tenant
      ? await sql/*sql*/`
        SELECT
          we.id::text AS id,
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
        WHERE we.tenant_id = ${tenant.id}::uuid
        ORDER BY we.updated_at DESC
        LIMIT 200
      `
      : await sql/*sql*/`
        SELECT
          we.id::text AS id,
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
        ORDER BY we.updated_at DESC
        LIMIT 200
      `;

    return json(rows.map((row) => safeWebhookEndpointProjection(row)), 200, { "cache-control": "no-store" });
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
}

export async function POST(req: Request) {
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

  let body: Record<string, unknown>;
  try {
    const parsed = await readBoundedJsonBody<unknown>(req, WEBHOOK_ADMIN_BODY_MAX_BYTES);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SyntaxError("invalid_json_body");
    body = parsed as Record<string, unknown>;
  } catch (error) {
    return invalidBody(error);
  }
  const forgedFields = SERVER_DERIVED_FIELDS.filter((field) => hasOwn(body, field));
  if (forgedFields.length) {
    return json({ ok: false, reason: "webhook_secret_and_context_server_derived", rejected_fields: forgedFields }, 400);
  }

  const name = normalizeWebhookName(body.name);
  if (!name) return json({ ok: false, reason: "webhook_name_too_long" }, 400);
  const rawUrl = String(body.url || "").trim();
  if (!rawUrl) return json({ ok: false, reason: "webhook_url_required" }, 400);
  if (rawUrl.length > WEBHOOK_URL_MAX_LENGTH) return json({ ok: false, reason: "webhook_url_too_long" }, 400);
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return json({ ok: false, reason: "webhook_enabled_invalid" }, 400);
  }
  const enabled = body.enabled === true;
  const eventsResult = parseWebhookEvents(body.events === undefined ? DEFAULT_EVENTS : body.events);
  if (!eventsResult.ok) return json({ ok: false, reason: eventsResult.reason }, 400);

  const rawSignatureVersion = String(body.signatureVersion || body.signature_version || "v2").trim();
  const signatureVersion = normalizeWebhookSignatureVersion(rawSignatureVersion);
  if (signatureVersion !== "v2") {
    return json({ ok: false, reason: "webhook_signature_v2_required" }, 400);
  }

  let url: string;
  try {
    url = normalizeWebhookUrl(rawUrl).toString();
    if (enabled) await resolveWebhookDestination(url);
  } catch (error) {
    return json({ ok: false, reason: safeWebhookError(error).code }, 400);
  }

  let tenant;
  try {
    await ensureSdkSchema();
    tenant = await resolveWebhookTenant(principal, body.tenant || body.tenantSlug);
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
  if (!tenant) return json({ ok: false, reason: "tenant_required_or_not_found" }, 400);

  const oneTimeSecret = generateWebhookSigningSecret();
  const fingerprint = webhookSecretFingerprint(oneTimeSecret);
  let encryptedSecret: string;
  try {
    encryptedSecret = encryptWebhookSigningSecret(oneTimeSecret, { tenantId: tenant.id });
  } catch (error) {
    return secretStorageError(error);
  }
  const meta = webhookAuditRequestMeta(req);

  try {
    const rows = await sql/*sql*/`
      WITH inserted AS (
        INSERT INTO webhook_endpoints (
          tenant_id,
          name,
          url,
          signing_secret,
          signature_version,
          enabled,
          events,
          created_by,
          updated_by,
          disabled_at,
          disabled_by,
          signing_secret_version,
          signing_secret_fingerprint,
          updated_at
        ) VALUES (
          ${tenant.id}::uuid,
          ${name},
          ${url},
          ${encryptedSecret},
          'v2',
          ${enabled},
          ${JSON.stringify(eventsResult.events)}::jsonb,
          ${principal.userId}::uuid,
          ${principal.userId}::uuid,
          CASE WHEN ${enabled} THEN NULL ELSE now() END,
          CASE WHEN ${enabled} THEN NULL ELSE ${principal.userId}::uuid END,
          1,
          ${fingerprint},
          now()
        )
        ON CONFLICT (tenant_id, url) DO NOTHING
        RETURNING *
      ), audit AS (
        INSERT INTO webhook_endpoint_audit_events (
          endpoint_id,
          tenant_id,
          actor_id,
          event_type,
          secret_version,
          secret_fingerprint,
          request_id,
          ip_address,
          user_agent,
          metadata_json
        )
        SELECT
          inserted.id,
          inserted.tenant_id,
          ${principal.userId}::uuid,
          'webhook_endpoint_created',
          inserted.signing_secret_version,
          inserted.signing_secret_fingerprint,
          ${meta.requestId},
          ${meta.ipAddress},
          ${meta.userAgent},
          ${JSON.stringify({ enabled, signature_version: "v2", event_count: eventsResult.events.length })}::jsonb
        FROM inserted
        RETURNING id
      )
      SELECT
        inserted.id::text AS id,
        inserted.name,
        inserted.url,
        inserted.enabled,
        CASE WHEN inserted.enabled THEN 'active' ELSE 'disabled' END AS lifecycle_status,
        inserted.events,
        inserted.signature_version,
        true AS has_signing_secret,
        inserted.signing_secret_version,
        inserted.signing_secret_fingerprint,
        inserted.created_at,
        inserted.updated_at,
        EXISTS (SELECT 1 FROM audit) AS audit_committed
      FROM inserted
    `;
    if (!rows[0]) return json({ ok: false, reason: "webhook_endpoint_conflict" }, 409);
    return json({
      ok: true,
      tenant: { slug: tenant.slug, name: tenant.name },
      endpoint: safeWebhookEndpointProjection(rows[0]),
      secret: oneTimeSecret,
      warning: "Store this secret now. nexID will not show it again.",
    }, 201, { "cache-control": "no-store" });
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
}
