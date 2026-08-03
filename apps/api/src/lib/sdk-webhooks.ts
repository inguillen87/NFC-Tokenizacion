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
  destination_version: string | number;
  endpoint_enabled: boolean;
  tenant_id: string;
  signing_secret: string | null;
  signature_version: string;
  event_id: string;
  event_name: string;
  payload: Record<string, unknown> | string;
  attempt_count: number;
  attempt_cycle_count?: number;
  lock_token: string;
};

type WebhookDeliveryDependencies = {
  deliver?: typeof deliverWebhookRequest;
  prepare?: WebhookDeliveryPreparation;
};

type WebhookDeliveryPreparation = (row: ClaimedWebhookDelivery) => Promise<{
  delivery: ClaimedWebhookDelivery | null;
  rejected: { status: "dead_letter" | "lease_lost"; reason: string } | null;
}>;

function webhookDeliveryTransport(dependencies: WebhookDeliveryDependencies) {
  if (!dependencies.deliver) return deliverWebhookRequest;
  if (process.env.NODE_ENV !== "test" || process.env.VERCEL_ENV !== "test") {
    throw new Error("webhook_delivery_test_transport_forbidden");
  }
  return dependencies.deliver;
}

function webhookDeliveryPreparation(dependencies: WebhookDeliveryDependencies): WebhookDeliveryPreparation {
  if (!dependencies.prepare) return renewAndVerifyWebhookDeliveryLease;
  if (process.env.NODE_ENV !== "test" || process.env.VERCEL_ENV !== "test") {
    throw new Error("webhook_delivery_test_preparation_forbidden");
  }
  return dependencies.prepare;
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
      SELECT id, url, destination_version
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
        destination_version,
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
        endpoint.destination_version,
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
        we.signature_version,
        we.destination_version
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
        AND wd.endpoint_url = we.url
        AND wd.destination_version = we.destination_version
      ORDER BY COALESCE(wd.next_attempt_at, wd.created_at) ASC, wd.created_at ASC
      FOR UPDATE OF wd, we SKIP LOCKED
      LIMIT ${safeLimit}
    )
    UPDATE webhook_deliveries wd
    SET status = 'processing',
        attempt_count = wd.attempt_count + 1,
        attempt_cycle_count = wd.attempt_cycle_count + 1,
        last_attempt_at = now(),
        locked_at = now(),
        lock_token = ${lockToken}
    FROM picked
    WHERE wd.id = picked.id
    RETURNING
      wd.id::text AS id,
      wd.endpoint_id::text AS endpoint_id,
      wd.endpoint_url,
      wd.destination_version,
      true AS endpoint_enabled,
      picked.tenant_id::text AS tenant_id,
      picked.signing_secret,
      picked.signature_version,
      wd.event_id,
      wd.event_name,
      wd.payload,
      wd.attempt_count,
      wd.attempt_cycle_count,
      wd.lock_token
  ` as unknown as Array<ClaimedWebhookDelivery>;
}

async function renewAndVerifyWebhookDeliveryLease(row: ClaimedWebhookDelivery) {
  const id = String(row.id);
  const endpointId = String(row.endpoint_id || "");
  const endpointUrl = String(row.endpoint_url || "");
  const destinationVersion = String(row.destination_version ?? "");
  const lockToken = String(row.lock_token || "");
  if (!endpointId || !endpointUrl || !/^\d+$/.test(destinationVersion) || !lockToken) {
    await appendWebhookLeaseLostAttempt(row, { errorCode: "webhook_delivery_identity_invalid" });
    return {
      delivery: null,
      rejected: { status: "lease_lost" as const, reason: "webhook_delivery_identity_invalid" },
    };
  }

  const renewed = await sql/*sql*/`
    WITH endpoint AS MATERIALIZED (
      SELECT
        we.id,
        we.tenant_id,
        we.url,
        we.destination_version,
        we.enabled,
        we.deleted_at,
        we.signing_secret,
        we.signature_version
      FROM webhook_endpoints we
      WHERE we.id = ${endpointId}::uuid
      FOR SHARE
    )
    UPDATE webhook_deliveries wd
    SET locked_at = now()
    FROM endpoint
    WHERE wd.id::text = ${id}
      AND wd.status = 'processing'
      AND wd.lock_token = ${lockToken}
      AND wd.endpoint_id = endpoint.id
      AND wd.endpoint_id::text = ${endpointId}
      AND wd.endpoint_url = ${endpointUrl}
      AND wd.destination_version = ${destinationVersion}::bigint
      AND endpoint.enabled = true
      AND endpoint.deleted_at IS NULL
      AND wd.endpoint_url = endpoint.url
      AND wd.destination_version = endpoint.destination_version
    RETURNING
      wd.id::text AS id,
      wd.endpoint_id::text AS endpoint_id,
      wd.endpoint_url,
      wd.destination_version,
      true AS endpoint_enabled,
      endpoint.tenant_id::text AS tenant_id,
      endpoint.signing_secret,
      endpoint.signature_version,
      wd.event_id,
      wd.event_name,
      wd.payload,
      wd.attempt_count,
      wd.attempt_cycle_count,
      wd.lock_token
  ` as unknown as Array<ClaimedWebhookDelivery>;
  if (renewed[0]) return { delivery: renewed[0], rejected: null };

  // No network call is allowed after a failed renewal. If this worker still
  // owns the lease and the durable destination became invalid, make that row
  // terminal and append its attempt receipt in the same statement. This keeps
  // the claim counters and immutable attempt history aligned without copying
  // destination, payload, or signing-secret material into the receipt.
  // Otherwise another worker/cutover won and this is a lease loss.
  const requestId = webhookRequestId(row);
  const terminal = await sql/*sql*/`
    WITH endpoint AS MATERIALIZED (
      SELECT
        we.id,
        we.tenant_id,
        we.url,
        we.destination_version,
        we.enabled,
        we.deleted_at
      FROM webhook_endpoints we
      WHERE we.id = ${endpointId}::uuid
      FOR SHARE
    ),
    terminal_delivery AS (
      UPDATE webhook_deliveries wd
      SET status = 'dead_letter',
          ok = false,
          status_code = NULL,
          next_attempt_at = NULL,
          last_error = CASE
            WHEN endpoint.enabled IS DISTINCT FROM true OR endpoint.deleted_at IS NOT NULL
              THEN 'webhook_endpoint_disabled'
            ELSE 'webhook_destination_changed'
          END,
          delivered_at = NULL,
          locked_at = NULL,
          lock_token = NULL
      FROM endpoint
      WHERE wd.id::text = ${id}
        AND wd.status = 'processing'
        AND wd.lock_token = ${lockToken}
        AND wd.endpoint_id = endpoint.id
        AND (
          endpoint.enabled IS DISTINCT FROM true
          OR endpoint.deleted_at IS NOT NULL
          OR wd.endpoint_url IS DISTINCT FROM endpoint.url
          OR wd.destination_version IS DISTINCT FROM endpoint.destination_version
        )
      RETURNING
        wd.id,
        wd.endpoint_id,
        endpoint.tenant_id,
        wd.attempt_count,
        wd.last_error,
        LEAST(COALESCE(wd.last_attempt_at, statement_timestamp()), statement_timestamp()) AS attempt_started_at
    ),
    terminal_attempt AS (
      INSERT INTO webhook_delivery_attempts (
        delivery_id, endpoint_id, tenant_id, attempt_number, outcome,
        status_code, latency_ms, error_code, request_id, started_at, completed_at
      )
      SELECT
        delivery.id,
        delivery.endpoint_id,
        delivery.tenant_id,
        delivery.attempt_count,
        'dead_letter',
        NULL,
        LEAST(
          GREATEST(
            floor(EXTRACT(EPOCH FROM (statement_timestamp() - delivery.attempt_started_at)) * 1000),
            0
          ),
          600000
        )::integer,
        delivery.last_error,
        ${requestId},
        delivery.attempt_started_at,
        statement_timestamp()
      FROM terminal_delivery delivery
      RETURNING delivery_id
    )
    SELECT delivery.id::text AS id, delivery.last_error
    FROM terminal_delivery delivery
    JOIN terminal_attempt attempt ON attempt.delivery_id = delivery.id
  `;
  if (!terminal[0]) {
    await appendWebhookLeaseLostAttempt(row, { errorCode: "webhook_delivery_lease_lost" });
  }
  return {
    delivery: null,
    rejected: terminal[0]
      ? { status: "dead_letter" as const, reason: String(terminal[0].last_error || "webhook_destination_changed") }
      : { status: "lease_lost" as const, reason: "webhook_delivery_lease_lost" },
  };
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

function webhookRequestId(row: ClaimedWebhookDelivery) {
  const payload = deliveryPayload(row.payload);
  const data = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : {};
  const candidate = String(data.request_id || data.requestId || row.event_id || row.id).trim();
  return candidate && candidate.length <= 256 && !/[\u0000-\u001f\u007f]/.test(candidate)
    ? candidate
    : String(row.event_id || row.id).slice(0, 256);
}

async function appendWebhookLeaseLostAttempt(
  row: ClaimedWebhookDelivery,
  input: { startedAt?: Date; statusCode?: number | null; errorCode: string },
) {
  const id = String(row.id || "");
  const endpointId = String(row.endpoint_id || "");
  const attemptNumber = Number(row.attempt_count);
  if (
    !/^[1-9][0-9]{0,18}$/.test(id)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(endpointId)
    || !Number.isSafeInteger(attemptNumber)
    || attemptNumber < 1
    || attemptNumber > 10_000
  ) return false;

  const requestedStartedAt = input.startedAt && Number.isFinite(input.startedAt.getTime())
    ? input.startedAt.toISOString()
    : null;
  const statusCode = Number.isInteger(input.statusCode)
    && Number(input.statusCode) >= 100
    && Number(input.statusCode) <= 599
    ? Number(input.statusCode)
    : null;
  const errorCode = String(input.errorCode || "webhook_delivery_lease_lost").slice(0, 160);
  const requestId = webhookRequestId(row);
  const receipt = await sql/*sql*/`
    WITH receipt_source AS (
      SELECT
        delivery.id,
        delivery.endpoint_id,
        endpoint.tenant_id,
        LEAST(
          COALESCE(${requestedStartedAt}::timestamptz, delivery.last_attempt_at, statement_timestamp()),
          statement_timestamp()
        ) AS attempt_started_at
      FROM webhook_deliveries delivery
      JOIN webhook_endpoints endpoint ON endpoint.id = delivery.endpoint_id
      WHERE delivery.id::text = ${id}
        AND delivery.endpoint_id::text = ${endpointId}
        AND delivery.attempt_count >= ${attemptNumber}
    )
    INSERT INTO webhook_delivery_attempts (
      delivery_id, endpoint_id, tenant_id, attempt_number, outcome,
      status_code, latency_ms, error_code, request_id, started_at, completed_at
    )
    SELECT
      source.id,
      source.endpoint_id,
      source.tenant_id,
      ${attemptNumber},
      'lease_lost',
      ${statusCode},
      LEAST(
        GREATEST(
          floor(EXTRACT(EPOCH FROM (statement_timestamp() - source.attempt_started_at)) * 1000),
          0
        ),
        600000
      )::integer,
      ${errorCode},
      ${requestId},
      source.attempt_started_at,
      statement_timestamp()
    FROM receipt_source source
    ON CONFLICT (delivery_id, attempt_number) DO NOTHING
    RETURNING delivery_id::text AS id
  `;
  return Boolean(receipt[0]);
}

export async function processClaimedWebhookDelivery(
  row: ClaimedWebhookDelivery,
  dependencies: WebhookDeliveryDependencies = {},
) {
  const id = String(row.id);
  const prepared = await webhookDeliveryPreparation(dependencies)(row);
  if (!prepared.delivery) {
    return {
      id,
      ok: false,
      status: prepared.rejected?.status || "lease_lost",
      attemptCount: Number(row.attempt_count || 1),
      reason: prepared.rejected?.reason || "webhook_delivery_lease_lost",
      nextAttemptInSeconds: null,
    };
  }
  row = prepared.delivery;
  const lockToken = String(row.lock_token || "");
  const attemptCount = Number(row.attempt_count || 1);
  const attemptCycleCount = Number(row.attempt_cycle_count || attemptCount);
  const attemptStartedAt = new Date();
  const attemptStartedMs = Date.now();
  const requestId = webhookRequestId(row);
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
          "x-nexid-request-id": requestId,
          ...signatureHeaders,
        },
      });
      const latencyMs = Math.min(Math.max(Date.now() - attemptStartedMs, 0), 600_000);
      const updated = await sql/*sql*/`
        WITH updated_delivery AS (
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
          RETURNING id, endpoint_id
        )
        INSERT INTO webhook_delivery_attempts (
          delivery_id, endpoint_id, tenant_id, attempt_number, outcome,
          status_code, latency_ms, error_code, request_id, started_at, completed_at
        )
        SELECT id, endpoint_id, ${row.tenant_id}::uuid, ${attemptCount}, 'delivered',
          ${response.statusCode}, ${latencyMs}, NULL, ${requestId}, ${attemptStartedAt.toISOString()}::timestamptz, now()
        FROM updated_delivery
        RETURNING delivery_id::text AS id
      `;
      if (!updated[0]) {
        await appendWebhookLeaseLostAttempt(row, {
          startedAt: attemptStartedAt,
          statusCode: response.statusCode,
          errorCode: "webhook_delivery_lease_lost",
        });
      }
      return { id, ok: Boolean(updated[0]), status: updated[0] ? "delivered" : "lease_lost", attemptCount };
    } catch (error) {
      errorInfo = error instanceof Error && error.message === "webhook_signature_version_invalid"
        ? { code: "webhook_signature_version_invalid", retryable: false, statusCode: null }
        : error instanceof Error && error.name === "WebhookSigningError"
          ? { code: "invalid_webhook_signature_input", retryable: false, statusCode: null }
          : safeWebhookError(error);
    }
  }

  const decision = webhookRetryDecision({ attemptCount: attemptCycleCount, retryable: errorInfo.retryable });
  const latencyMs = Math.min(Math.max(Date.now() - attemptStartedMs, 0), 600_000);
  const updated = decision.status === "retry_scheduled"
    ? await sql/*sql*/`
      WITH updated_delivery AS (
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
        RETURNING id, endpoint_id
      )
      INSERT INTO webhook_delivery_attempts (
        delivery_id, endpoint_id, tenant_id, attempt_number, outcome,
        status_code, latency_ms, error_code, request_id, started_at, completed_at
      )
      SELECT id, endpoint_id, ${row.tenant_id}::uuid, ${attemptCount}, 'retry_scheduled',
        ${errorInfo.statusCode}, ${latencyMs}, ${errorInfo.code}, ${requestId}, ${attemptStartedAt.toISOString()}::timestamptz, now()
      FROM updated_delivery
      RETURNING delivery_id::text AS id
    `
    : await sql/*sql*/`
      WITH updated_delivery AS (
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
        RETURNING id, endpoint_id
      )
      INSERT INTO webhook_delivery_attempts (
        delivery_id, endpoint_id, tenant_id, attempt_number, outcome,
        status_code, latency_ms, error_code, request_id, started_at, completed_at
      )
      SELECT id, endpoint_id, ${row.tenant_id}::uuid, ${attemptCount}, 'dead_letter',
        ${errorInfo.statusCode}, ${latencyMs}, ${errorInfo.code}, ${requestId}, ${attemptStartedAt.toISOString()}::timestamptz, now()
      FROM updated_delivery
      RETURNING delivery_id::text AS id
    `;
  if (!updated[0]) {
    await appendWebhookLeaseLostAttempt(row, {
      startedAt: attemptStartedAt,
      statusCode: errorInfo.statusCode,
      errorCode: "webhook_delivery_lease_lost",
    });
  }
  return {
    id,
    ok: false,
    status: updated[0] ? decision.status : "lease_lost",
    attemptCount,
    attemptCycleCount,
    reason: errorInfo.code,
    nextAttemptInSeconds: decision.delaySeconds,
  };
}

export async function processWebhookDeliveryBatch(limit = 10) {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
  const results: Array<Record<string, unknown>> = [];
  // Claim just in time so a slow destination cannot age the leases of every
  // later row in a preclaimed batch before those rows reach egress.
  for (let index = 0; index < safeLimit; index += 1) {
    const claimed = await claimWebhookDeliveries(1);
    if (!claimed[0]) break;
    results.push(await processClaimedWebhookDelivery(claimed[0]));
  }
  return results;
}
