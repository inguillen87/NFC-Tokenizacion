import { createHash, randomUUID } from "node:crypto";

import { ensureSdkSchema } from "./commercial-runtime-schema";
import { sql } from "./db";
import { deliverWebhookRequest, safeWebhookError } from "./webhook-egress";
import {
  createWebhookSignatureHeaders,
  webhookSigningSecretIssue,
} from "./webhook-signing";

const RETRY_DELAYS_SECONDS = [60, 300, 1_800, 7_200, 21_600, 86_400, 172_800];

type ClaimedWebhookDelivery = {
  id: string;
  endpoint_id: string;
  endpoint_url: string;
  endpoint_enabled: boolean;
  signing_secret: string | null;
  event_id: string;
  event_name: string;
  payload: Record<string, unknown> | string;
  attempt_count: number;
  lock_token: string;
};

function parseEvents(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parseEvents(parsed);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function endpointMatches(events: string[], eventName: string) {
  return events.includes("*") || events.includes(eventName);
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
  if (!input.tenantId) return { attempted: 0, queued: 0, delivered: 0 };
  await ensureSdkSchema();

  const endpoints = await sql/*sql*/`
    SELECT id::text AS id, url, events
    FROM webhook_endpoints
    WHERE tenant_id = ${input.tenantId}
      AND enabled = true
    ORDER BY updated_at DESC
    LIMIT 25
  `;

  const eventId = deriveWebhookEventId({
    tenantId: input.tenantId,
    eventName: input.eventName,
    idempotencyKey: input.idempotencyKey,
  });
  const payload = {
    id: eventId,
    type: input.eventName,
    createdAt: new Date().toISOString(),
    data: input.payload,
  };

  let attempted = 0;
  let queued = 0;
  for (const endpoint of endpoints as Array<Record<string, unknown>>) {
    if (!endpointMatches(parseEvents(endpoint.events), input.eventName)) continue;
    attempted += 1;
    const rows = await sql/*sql*/`
      INSERT INTO webhook_deliveries (
        endpoint_id,
        endpoint_url,
        event_id,
        event_name,
        payload,
        status,
        attempt_count,
        next_attempt_at
      ) VALUES (
        ${String(endpoint.id)},
        ${String(endpoint.url)},
        ${eventId},
        ${input.eventName},
        ${JSON.stringify(payload)}::jsonb,
        'pending',
        0,
        now()
      )
      ON CONFLICT (endpoint_id, event_id) DO NOTHING
      RETURNING id::text AS id
    `;
    if (rows[0]) queued += 1;
  }

  return { attempted, queued, delivered: 0, eventId };
}

export async function claimWebhookDeliveries(limit = 10) {
  await ensureSdkSchema();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
  const lockToken = randomUUID();
  return await sql/*sql*/`
    WITH picked AS (
      SELECT wd.id
      FROM webhook_deliveries wd
      WHERE (
          wd.status IN ('pending', 'retry_scheduled')
          AND COALESCE(wd.next_attempt_at, wd.created_at) <= now()
        ) OR (
          wd.status = 'processing'
          AND COALESCE(wd.locked_at, wd.last_attempt_at, wd.created_at) <= now() - interval '10 minutes'
        )
      ORDER BY COALESCE(wd.next_attempt_at, wd.created_at) ASC, wd.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${safeLimit}
    )
    UPDATE webhook_deliveries wd
    SET status = 'processing',
        attempt_count = wd.attempt_count + 1,
        last_attempt_at = now(),
        locked_at = now(),
        lock_token = ${lockToken}
    FROM picked, webhook_endpoints we
    WHERE wd.id = picked.id
      AND we.id = wd.endpoint_id
    RETURNING
      wd.id::text AS id,
      wd.endpoint_id::text AS endpoint_id,
      wd.endpoint_url,
      we.enabled AS endpoint_enabled,
      we.signing_secret,
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

export async function processClaimedWebhookDelivery(row: ClaimedWebhookDelivery) {
  const id = String(row.id);
  const lockToken = String(row.lock_token || "");
  const attemptCount = Number(row.attempt_count || 1);
  let errorInfo: { code: string; retryable: boolean; statusCode: number | null } | null = null;

  if (!row.endpoint_enabled) {
    errorInfo = { code: "webhook_endpoint_disabled", retryable: false, statusCode: null };
  } else {
    const payload = deliveryPayload(row.payload);
    const body = JSON.stringify(payload);
    const secret = String(row.signing_secret || "");
    const secretIssue = webhookSigningSecretIssue(secret, { required: true });
    if (secretIssue) {
      errorInfo = { code: secretIssue, retryable: false, statusCode: null };
    } else try {
      const signatureHeaders = createWebhookSignatureHeaders({
        secret,
        keyId: String(row.endpoint_id),
        deliveryId: id,
        eventId: String(row.event_id || ""),
        rawBody: body,
      });
      const response = await deliverWebhookRequest({
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
      errorInfo = error instanceof Error && error.name === "WebhookSigningError"
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
