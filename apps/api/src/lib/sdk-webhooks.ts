import { createHash, randomUUID } from "node:crypto";

import { ensureSdkSchema } from "./commercial-runtime-schema";
import { sql } from "./db";
import { deliverWebhookRequest, safeWebhookError } from "./webhook-egress";
import {
  decryptWebhookSigningSecret,
  WebhookSecretCipherError,
} from "./webhook-secret-cipher";
import {
  createWebhookSignatureHeaders,
  normalizeWebhookSignatureVersion,
  webhookSigningSecretIssue,
} from "./webhook-signing";

const RETRY_DELAYS_SECONDS = [60, 300, 1_800, 7_200, 21_600, 86_400, 172_800];
export const WEBHOOK_EVENT_SCHEMA_VERSION = "1.0" as const;

type ClaimedWebhookDelivery = {
  id: string;
  endpoint_id: string;
  endpoint_url: string;
  endpoint_enabled: boolean;
  tenant_id: string;
  signing_secret: string | null;
  signature_version: string;
  event_id: string;
  event_name: string;
  payload: Record<string, unknown> | string;
  attempt_count: number;
  lock_token: string;
};

type WebhookDeliveryDependencies = {
  deliver?: typeof deliverWebhookRequest;
};

function webhookDeliveryTransport(dependencies: WebhookDeliveryDependencies) {
  if (!dependencies.deliver) return deliverWebhookRequest;
  if (process.env.NODE_ENV !== "test" || process.env.VERCEL_ENV !== "test") {
    throw new Error("webhook_delivery_test_transport_forbidden");
  }
  return dependencies.deliver;
}

function maxAttempts() {
  const parsed = Number(process.env.WEBHOOK_MAX_ATTEMPTS || 8);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 20) : 8;
}

export function deriveWebhookEventId(input: {
  tenantId: string;
  eventName: string;
  idempotencyKey?: string | null;
}) {
  const key = String(input.idempotencyKey || "").trim();
  if (!key) return `evt_${randomUUID()}`;
  const digest = createHash("sha256")
    .update(`${input.tenantId}\u0000${input.eventName}\u0000${key}`, "utf8")
    .digest("hex");
  return `evt_${digest}`;
}

export function webhookRetryDecision(input: { attemptCount: number; retryable: boolean; maxAttempts?: number }) {
  const attempts = Math.max(1, Math.floor(input.attemptCount));
  const configuredMax = Math.max(1, Math.floor(input.maxAttempts ?? maxAttempts()));
  if (!input.retryable || attempts >= configuredMax) {
    return { status: "dead_letter" as const, delaySeconds: null };
  }
  return {
    status: "retry_scheduled" as const,
    delaySeconds: RETRY_DELAYS_SECONDS[Math.min(attempts - 1, RETRY_DELAYS_SECONDS.length - 1)],
  };
}

/**
 * Durable SDK outbox producer. It intentionally does not perform network I/O:
 * SDK responses remain independent from tenant endpoint latency and failures.
 */
export async function dispatchTenantWebhooks(input: {
  tenantId: string | null | undefined;
  eventName: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
}) {
  if (!input.tenantId) return { attempted: 0, confirmed: 0, queued: 0, deduplicated: 0, delivered: 0, eventId: null };
  await ensureSdkSchema();

  const eventId = deriveWebhookEventId({
    tenantId: input.tenantId,
    eventName: input.eventName,
    idempotencyKey: input.idempotencyKey,
  });
  const payload = {
    schemaVersion: WEBHOOK_EVENT_SCHEMA_VERSION,
    id: eventId,
    type: input.eventName,
    createdAt: new Date().toISOString(),
    data: input.payload,
  };

  const receiptRows = await sql/*sql*/`
    WITH matching_endpoints AS MATERIALIZED (
      SELECT id, url
      FROM webhook_endpoints
      WHERE tenant_id = ${input.tenantId}
        AND enabled = true
        AND deleted_at IS NULL
        AND (events ? ${input.eventName} OR events ? '*')
      ORDER BY updated_at DESC
      LIMIT 25
    ),
    existing_deliveries AS MATERIALIZED (
      SELECT wd.endpoint_id
      FROM webhook_deliveries wd
      JOIN matching_endpoints endpoint ON endpoint.id = wd.endpoint_id
      WHERE wd.event_id = ${eventId}
    ),
    inserted_deliveries AS (
      INSERT INTO webhook_deliveries (
        endpoint_id,
        endpoint_url,
        event_id,
        event_name,
        payload,
        status,
        attempt_count,
        next_attempt_at
      )
      SELECT
        endpoint.id,
        endpoint.url,
        ${eventId},
        ${input.eventName},
        ${JSON.stringify(payload)}::jsonb,
        'pending',
        0,
        now()
      FROM matching_endpoints endpoint
      ON CONFLICT (endpoint_id, event_id) DO NOTHING
      RETURNING endpoint_id
    )
    SELECT
      (SELECT count(*)::integer FROM matching_endpoints) AS attempted,
      (SELECT count(*)::integer FROM existing_deliveries) AS deduplicated,
      (SELECT count(*)::integer FROM inserted_deliveries) AS queued
  `;
  const receipt = (receiptRows[0] || {}) as Record<string, unknown>;
  const attempted = Number(receipt.attempted || 0);
  const queued = Number(receipt.queued || 0);
  const deduplicated = Number(receipt.deduplicated || 0);
  return { attempted, confirmed: queued + deduplicated, queued, deduplicated, delivered: 0, eventId };
}

export async function claimWebhookDeliveries(limit = 10) {
  await ensureSdkSchema();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
  const lockToken = randomUUID();
  return await sql/*sql*/`
    WITH picked AS (
      SELECT
        wd.id,
        we.id AS endpoint_id,
        we.tenant_id,
        we.signing_secret,
        we.signature_version
      FROM webhook_deliveries wd
      JOIN webhook_endpoints we ON we.id = wd.endpoint_id
      WHERE (
          (
            wd.status IN ('pending', 'retry_scheduled')
            AND COALESCE(wd.next_attempt_at, wd.created_at) <= now()
          ) OR (
            wd.status = 'processing'
            AND COALESCE(wd.locked_at, wd.last_attempt_at, wd.created_at) <= now() - interval '10 minutes'
          )
        )
        AND we.enabled = true
        AND we.deleted_at IS NULL
      ORDER BY COALESCE(wd.next_attempt_at, wd.created_at) ASC, wd.created_at ASC
      FOR UPDATE OF wd, we SKIP LOCKED
      LIMIT ${safeLimit}
    )
    UPDATE webhook_deliveries wd
    SET status = 'processing',
        attempt_count = wd.attempt_count + 1,
        last_attempt_at = now(),
        locked_at = now(),
        lock_token = ${lockToken}
    FROM picked
    WHERE wd.id = picked.id
    RETURNING
      wd.id::text AS id,
      wd.endpoint_id::text AS endpoint_id,
      wd.endpoint_url,
      true AS endpoint_enabled,
      picked.tenant_id::text AS tenant_id,
      picked.signing_secret,
      picked.signature_version,
      wd.event_id,
      wd.event_name,
      wd.payload,
      wd.attempt_count,
      wd.lock_token
  ` as unknown as Array<ClaimedWebhookDelivery>;
}

function deliveryPayload(value: ClaimedWebhookDelivery["payload"]) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function processClaimedWebhookDelivery(
  row: ClaimedWebhookDelivery,
  dependencies: WebhookDeliveryDependencies = {},
) {
  const id = String(row.id);
  const lockToken = String(row.lock_token || "");
  const attemptCount = Number(row.attempt_count || 1);
  let errorInfo: { code: string; retryable: boolean; statusCode: number | null } | null = null;

  if (!row.endpoint_enabled) {
    errorInfo = { code: "webhook_endpoint_disabled", retryable: false, statusCode: null };
  } else {
    const payload = deliveryPayload(row.payload);
    const body = JSON.stringify(payload);
    let secret = "";
    try {
      secret = decryptWebhookSigningSecret(row.signing_secret, { tenantId: String(row.tenant_id || "") });
    } catch (error) {
      const code = error instanceof WebhookSecretCipherError
        ? error.code
        : "webhook_signing_secret_decryption_failed";
      const retryable = code === "webhook_signing_master_key_required"
        || code === "webhook_signing_master_key_invalid"
        || code === "webhook_signing_legacy_plaintext_disabled";
      errorInfo = { code, retryable, statusCode: null };
    }

    const secretIssue = errorInfo ? null : webhookSigningSecretIssue(secret, { required: true });
    if (secretIssue) {
      errorInfo = { code: secretIssue, retryable: false, statusCode: null };
    } else if (!errorInfo) try {
      const signatureVersion = normalizeWebhookSignatureVersion(row.signature_version);
      if (!signatureVersion) {
        throw new Error("webhook_signature_version_invalid");
      }
      const signatureHeaders = createWebhookSignatureHeaders({
        secret,
        keyId: String(row.endpoint_id),
        deliveryId: id,
        eventId: String(row.event_id || ""),
        rawBody: body,
        version: signatureVersion,
      });
      const response = await webhookDeliveryTransport(dependencies)({
        url: String(row.endpoint_url),
        body,
        headers: {
          "content-type": "application/json",
          "user-agent": "nexID-webhooks/2.0",
          "x-nexid-event": String(row.event_name),
          "x-nexid-delivery": id,
          ...signatureHeaders,
        },
      });
      const updated = await sql/*sql*/`
        UPDATE webhook_deliveries
        SET status = 'delivered',
            ok = true,
            status_code = ${response.statusCode},
            next_attempt_at = NULL,
            last_error = NULL,
            delivered_at = now(),
            locked_at = NULL,
            lock_token = NULL
        WHERE id::text = ${id}
          AND status = 'processing'
          AND lock_token = ${lockToken}
        RETURNING id::text AS id
      `;
      return { id, ok: Boolean(updated[0]), status: updated[0] ? "delivered" : "lease_lost", attemptCount };
    } catch (error) {
      errorInfo = error instanceof Error && error.message === "webhook_signature_version_invalid"
        ? { code: "webhook_signature_version_invalid", retryable: false, statusCode: null }
        : error instanceof Error && error.name === "WebhookSigningError"
          ? { code: "invalid_webhook_signature_input", retryable: false, statusCode: null }
          : safeWebhookError(error);
    }
  }

  const decision = webhookRetryDecision({ attemptCount, retryable: errorInfo.retryable });
  const updated = decision.status === "retry_scheduled"
    ? await sql/*sql*/`
      UPDATE webhook_deliveries
      SET status = 'retry_scheduled',
          ok = false,
          status_code = ${errorInfo.statusCode},
          next_attempt_at = now() + (${decision.delaySeconds} * interval '1 second'),
          last_error = ${errorInfo.code},
          delivered_at = NULL,
          locked_at = NULL,
          lock_token = NULL
      WHERE id::text = ${id}
        AND status = 'processing'
        AND lock_token = ${lockToken}
      RETURNING id::text AS id
    `
    : await sql/*sql*/`
      UPDATE webhook_deliveries
      SET status = 'dead_letter',
          ok = false,
          status_code = ${errorInfo.statusCode},
          next_attempt_at = NULL,
          last_error = ${errorInfo.code},
          delivered_at = NULL,
          locked_at = NULL,
          lock_token = NULL
      WHERE id::text = ${id}
        AND status = 'processing'
        AND lock_token = ${lockToken}
      RETURNING id::text AS id
    `;
  return {
    id,
    ok: false,
    status: updated[0] ? decision.status : "lease_lost",
    attemptCount,
    reason: errorInfo.code,
    nextAttemptInSeconds: decision.delaySeconds,
  };
}

export async function processWebhookDeliveryBatch(limit = 10) {
  const claimed = await claimWebhookDeliveries(limit);
  const results: Array<Record<string, unknown>> = [];
  for (const row of claimed) results.push(await processClaimedWebhookDelivery(row));
  return results;
}
