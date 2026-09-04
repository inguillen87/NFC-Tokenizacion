export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The lifecycle rotates around four minutes, with bounded jitter, so EventSource
// reconnects with a fresh broker cursor before the five-minute compute ceiling.
export const maxDuration = 300;

import { checkAdminPermission, checkAdminWithPermission, getAdminTenantScope } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { REALTIME_DELIVERY_ID_PATTERN } from "../../../../lib/realtime-broker-payload";
import { subscribeRealtimeEvent } from "../../../../lib/realtime-events";
import { createBoundedRealtimeSseOutputQueue } from "../../../../lib/realtime-sse-output-queue";
import {
  normalizePersistedTenantTapRealtimeEvent,
  readEmbeddedTenantTapProjection,
} from "../../../../lib/realtime-tap-projection";
import {
  createBoundedRealtimeProjectionDeduper,
  runRealtimeStreamLifecycle,
} from "../../../../lib/realtime-stream-lifecycle";
import {
  REALTIME_STREAM_WINDOW_IDS,
  resolveRealtimeStreamWindow,
  type RealtimeStreamWindow,
} from "../../../../lib/realtime-stream-window";
import { resolveJitteredRealtimeDelay } from "../../../../lib/realtime-timing";
import { randomUUID } from "node:crypto";
import { type TenantTapRealtimeEvent } from "@product/core";
import {
  REALTIME_EVENT_SOURCE_FILTERS,
  allowRealtimeEventForScope,
  allowRealtimeEventForSource,
  parseRealtimeEventSourceFilter,
  type RealtimeEventSourceFilter,
} from "../../../../lib/realtime-stream-filter";

type EventRow = Record<string, unknown>;
type RealtimeAlertPayload = {
  event_type: "security_alert.created";
  alert_id: string;
  tenant_id?: string;
  tenant_slug?: string;
  type: string;
  severity: string;
  created_at: string;
};

type RealtimeIncidentPayload = {
  event_type: "incident.created" | "incident.updated";
  incident_id: string;
  incident_event_id: string;
  ticket_id: string;
  tenant_id?: string;
  tenant_slug?: string;
  incident_status: string;
  incident_severity: string;
  source?: string;
  created_at: string;
};

const OPERATIONAL_NOTIFICATION_EVENT_TYPES = new Set([
  "lead.created",
  "ticket.created",
  "order.created",
  "order_request.created",
  "marketplace.order_requested",
  "supplier_order.created",
  "sdk.external_event",
]);

function isSecurityAlertPayload(payload: Record<string, unknown>): payload is RealtimeAlertPayload {
  return String(payload.event_type || "") === "security_alert.created" && Boolean(payload.alert_id);
}

function isOperationalNotificationPayload(payload: Record<string, unknown>) {
  return OPERATIONAL_NOTIFICATION_EVENT_TYPES.has(String(payload.event_type || "").trim().toLowerCase());
}

const MAX_SEEN_EVENT_IDS = 10_000;
const MAX_PENDING_OUTPUT_FRAMES = 256;
const MAX_PENDING_OUTPUT_BYTES = 1024 * 1024;
const SSE_OUTPUT_HIGH_WATER_MARK_BYTES = 64 * 1024;

function safeOperationalErrorCode(error: unknown, fallback: string) {
  const candidate = typeof (error as { code?: unknown })?.code === "string"
    ? String((error as { code: string }).code).trim()
    : "";
  return /^[a-z0-9_]{1,32}$/i.test(candidate) ? candidate : fallback;
}

function isIncidentPayload(payload: Record<string, unknown>): payload is RealtimeIncidentPayload {
  const type = String(payload.event_type || "");
  return (type === "incident.created" || type === "incident.updated")
    && Boolean(payload.incident_id)
    && Boolean(payload.incident_event_id)
    && Boolean(payload.ticket_id);
}

async function fetchRows(
  search: URLSearchParams,
  realtimeWindow: RealtimeStreamWindow,
  forcedTenantSlug = "",
  sourceFilter: RealtimeEventSourceFilter = "all",
): Promise<EventRow[]> {
  const requestedLimit = Number(search.get("limit") || 40);
  const limit = Math.max(1, Math.min(200, Number(requestedLimit) || 40));
  const tenant = (forcedTenantSlug || String(search.get("tenant") || "")).trim().toLowerCase();
  const verdict = String(search.get("verdict") || "").trim().toUpperCase();
  const risk = String(search.get("risk") || "").trim().toUpperCase();
  const { interval } = realtimeWindow;
  const rows = tenant
    ? await sql/*sql*/`
        SELECT
          e.id,
          e.tenant_id,
          e.batch_id,
          e.tag_id,
          COALESCE(
            NULLIF(e.product_name, ''),
            NULLIF(b.sdm_config->>'product_name', ''),
            NULLIF(b.sdm_config #>> '{sun,product,name}', ''),
            NULLIF(b.sdm_config->>'sku', ''),
            NULLIF(b.sdm_config #>> '{sun,product,sku}', '')
          ) AS product_name,
          e.result,
          e.event_type,
          e.verdict,
          e.risk_level,
          e.cmac_ok,
          e.allowlisted,
          (
            SELECT COUNT(DISTINCT actor_history.consumer_id)::int
            FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id
              AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor_count,
          EXISTS (
            SELECT 1
            FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id
              AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor,
          COALESCE(ARRAY(
            SELECT DISTINCT CASE
              WHEN LOWER(consent.scope) IN ('whatsapp', 'whatsapp_marketing') THEN 'whatsapp'
              WHEN LOWER(consent.scope) = 'phone_marketing' THEN 'phone'
              WHEN LOWER(consent.scope) IN ('email', 'email_marketing') THEN 'email'
            END
            FROM consumer_tap_history consent_history
            JOIN consumer_tenant_consents consent
              ON consent.tenant_id = consent_history.tenant_id
             AND consent.consumer_id = consent_history.consumer_id
            WHERE consent_history.tenant_id = e.tenant_id
              AND consent_history.tap_event_id = e.id
              AND consent_history.consumer_id IS NOT NULL
              AND consent.granted = true
              AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN (
                'whatsapp', 'whatsapp_marketing', 'phone_marketing',
                'email', 'email_marketing'
              )
          ), ARRAY[]::text[]) AS commercial_consent_channels,
          EXISTS (
            SELECT 1
            FROM consumer_tap_history cth
            JOIN consumer_tenant_consents consent
              ON consent.tenant_id = cth.tenant_id
             AND consent.consumer_id = cth.consumer_id
            WHERE cth.tenant_id = e.tenant_id
              AND cth.tap_event_id = e.id
              AND cth.consumer_id IS NOT NULL
              AND consent.granted = true
              AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN (
                'whatsapp', 'whatsapp_marketing', 'phone_marketing',
                'email', 'email_marketing'
              )
          ) AS commercial_consent_granted,
          e.reason,
          e.uid_hex,
          e.created_at,
          e.city,
          e.country_code,
          e.lat,
          e.lng,
          e.location_source,
          e.location_accuracy_m,
          to_jsonb(e)->'post_tap_location_observation' AS post_tap_location_observation,
          e.device_label,
          e.user_agent,
          e.meta,
          COALESCE(NULLIF(e.bid, ''), b.bid) AS bid,
          e.source,
          t.slug AS tenant_slug
        FROM events e
        JOIN batches b
          ON b.id = e.batch_id
         AND b.tenant_id = e.tenant_id
        JOIN tenants t ON t.id = e.tenant_id
        WHERE t.slug = ${tenant}
          AND (
            ${sourceFilter} = 'all'
            OR (${sourceFilter} = 'production' AND LOWER(COALESCE(e.source::text, '')) IN ('real', 'imported'))
            OR (${sourceFilter} IN ('demo', 'real', 'imported') AND LOWER(COALESCE(e.source::text, '')) = ${sourceFilter})
          )
          AND (${verdict} = '' OR UPPER(e.result) = ${verdict})
          AND (
            ${risk} = ''
            OR (
              CASE
                WHEN LOWER(COALESCE(e.verdict, '')) IN ('replay_suspect', 'blocked_replay', 'tampered') OR UPPER(COALESCE(e.result, '')) IN ('DUPLICATE', 'REPLAY_SUSPECT', 'BLOCKED_REPLAY', 'TAMPER', 'TAMPER_RISK', 'TAMPER_UNVERIFIED', 'TAMPERED') THEN 'HIGH'
                WHEN LOWER(COALESCE(e.verdict, '')) IN ('revoked', 'broken') OR UPPER(COALESCE(e.result, '')) IN ('REVOKED', 'BROKEN') THEN 'CRITICAL'
                WHEN LOWER(COALESCE(e.verdict, '')) = 'invalid' OR UPPER(COALESCE(e.result, '')) IN ('INVALID', 'TAP_INVALID') OR (UPPER(COALESCE(e.result, '')) LIKE 'BLOCKED_%' AND UPPER(COALESCE(e.result, '')) <> 'BLOCKED_REPLAY') THEN 'MEDIUM'
                WHEN LOWER(COALESCE(e.verdict, '')) = 'valid' OR UPPER(COALESCE(e.result, '')) IN ('VALID', 'TAP_VALID') OR UPPER(COALESCE(e.result, '')) LIKE 'VALID_%' THEN 'NONE'
                ELSE 'LOW'
              END
            ) = ${risk}
          )
          AND (${interval} = '' OR e.created_at >= now() - ${interval}::interval)
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT ${limit}
      `
    : await sql/*sql*/`
        SELECT
          e.id,
          e.tenant_id,
          e.batch_id,
          e.tag_id,
          COALESCE(
            NULLIF(e.product_name, ''),
            NULLIF(b.sdm_config->>'product_name', ''),
            NULLIF(b.sdm_config #>> '{sun,product,name}', ''),
            NULLIF(b.sdm_config->>'sku', ''),
            NULLIF(b.sdm_config #>> '{sun,product,sku}', '')
          ) AS product_name,
          e.result,
          e.event_type,
          e.verdict,
          e.risk_level,
          e.cmac_ok,
          e.allowlisted,
          (
            SELECT COUNT(DISTINCT actor_history.consumer_id)::int
            FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id
              AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor_count,
          EXISTS (
            SELECT 1
            FROM consumer_tap_history actor_history
            WHERE actor_history.tenant_id = e.tenant_id
              AND actor_history.tap_event_id = e.id
              AND actor_history.consumer_id IS NOT NULL
          ) AS known_actor,
          COALESCE(ARRAY(
            SELECT DISTINCT CASE
              WHEN LOWER(consent.scope) IN ('whatsapp', 'whatsapp_marketing') THEN 'whatsapp'
              WHEN LOWER(consent.scope) = 'phone_marketing' THEN 'phone'
              WHEN LOWER(consent.scope) IN ('email', 'email_marketing') THEN 'email'
            END
            FROM consumer_tap_history consent_history
            JOIN consumer_tenant_consents consent
              ON consent.tenant_id = consent_history.tenant_id
             AND consent.consumer_id = consent_history.consumer_id
            WHERE consent_history.tenant_id = e.tenant_id
              AND consent_history.tap_event_id = e.id
              AND consent_history.consumer_id IS NOT NULL
              AND consent.granted = true
              AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN (
                'whatsapp', 'whatsapp_marketing', 'phone_marketing',
                'email', 'email_marketing'
              )
          ), ARRAY[]::text[]) AS commercial_consent_channels,
          EXISTS (
            SELECT 1
            FROM consumer_tap_history cth
            JOIN consumer_tenant_consents consent
              ON consent.tenant_id = cth.tenant_id
             AND consent.consumer_id = cth.consumer_id
            WHERE cth.tenant_id = e.tenant_id
              AND cth.tap_event_id = e.id
              AND cth.consumer_id IS NOT NULL
              AND consent.granted = true
              AND consent.revoked_at IS NULL
              AND LOWER(consent.scope) IN (
                'whatsapp', 'whatsapp_marketing', 'phone_marketing',
                'email', 'email_marketing'
              )
          ) AS commercial_consent_granted,
          e.reason,
          e.uid_hex,
          e.created_at,
          e.city,
          e.country_code,
          e.lat,
          e.lng,
          e.location_source,
          e.location_accuracy_m,
          to_jsonb(e)->'post_tap_location_observation' AS post_tap_location_observation,
          e.device_label,
          e.user_agent,
          e.meta,
          COALESCE(NULLIF(e.bid, ''), b.bid) AS bid,
          e.source,
          t.slug AS tenant_slug
        FROM events e
        JOIN batches b
          ON b.id = e.batch_id
         AND b.tenant_id = e.tenant_id
        JOIN tenants t ON t.id = e.tenant_id
        WHERE (
            ${sourceFilter} = 'all'
            OR (${sourceFilter} = 'production' AND LOWER(COALESCE(e.source::text, '')) IN ('real', 'imported'))
            OR (${sourceFilter} IN ('demo', 'real', 'imported') AND LOWER(COALESCE(e.source::text, '')) = ${sourceFilter})
          )
          AND (${verdict} = '' OR UPPER(e.result) = ${verdict})
          AND (
            ${risk} = ''
            OR (
              CASE
                WHEN LOWER(COALESCE(e.verdict, '')) IN ('replay_suspect', 'blocked_replay', 'tampered') OR UPPER(COALESCE(e.result, '')) IN ('DUPLICATE', 'REPLAY_SUSPECT', 'BLOCKED_REPLAY', 'TAMPER', 'TAMPER_RISK', 'TAMPER_UNVERIFIED', 'TAMPERED') THEN 'HIGH'
                WHEN LOWER(COALESCE(e.verdict, '')) IN ('revoked', 'broken') OR UPPER(COALESCE(e.result, '')) IN ('REVOKED', 'BROKEN') THEN 'CRITICAL'
                WHEN LOWER(COALESCE(e.verdict, '')) = 'invalid' OR UPPER(COALESCE(e.result, '')) IN ('INVALID', 'TAP_INVALID') OR (UPPER(COALESCE(e.result, '')) LIKE 'BLOCKED_%' AND UPPER(COALESCE(e.result, '')) <> 'BLOCKED_REPLAY') THEN 'MEDIUM'
                WHEN LOWER(COALESCE(e.verdict, '')) = 'valid' OR UPPER(COALESCE(e.result, '')) IN ('VALID', 'TAP_VALID') OR UPPER(COALESCE(e.result, '')) LIKE 'VALID_%' THEN 'NONE'
                ELSE 'LOW'
              END
            ) = ${risk}
          )
          AND (${interval} = '' OR e.created_at >= now() - ${interval}::interval)
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT ${limit}
      `;
  return Array.isArray(rows) ? rows : [];
}

export async function GET(req: Request): Promise<Response> {
  const auth = await checkAdminWithPermission(req, "events.read_sensitive");
  if (auth) return auth;
  const canReadIncidents = checkAdminPermission(req, "incidents:read") === null;
  const { scope, forcedTenantSlug } = getAdminTenantScope(req);

  const { searchParams } = new URL(req.url);
  const sourceFilter = parseRealtimeEventSourceFilter(searchParams.get("source"));
  if (!sourceFilter) {
    return new Response(JSON.stringify({
      ok: false,
      reason: "invalid_source_filter",
      allowed: REALTIME_EVENT_SOURCE_FILTERS,
    }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const realtimeWindow = resolveRealtimeStreamWindow(searchParams.get("window"));
  if (!realtimeWindow) {
    return new Response(JSON.stringify({
      ok: false,
      reason: "invalid_window",
      allowed: REALTIME_STREAM_WINDOW_IDS,
    }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const requestId = req.headers.get("x-request-id") || req.headers.get("x-nexid-request-id") || randomUUID();
  const resumeCursor = String(req.headers.get("last-event-id") || "").trim();
  const encoder = new TextEncoder();
  if ((scope === "tenant_admin" || scope === "tenant_operator" || scope === "reseller") && forcedTenantSlug) {
    const requestedTenant = String(searchParams.get("tenant") || "").trim().toLowerCase();
    if (requestedTenant && requestedTenant !== forcedTenantSlug) {
      return new Response(JSON.stringify({ ok: false, reason: "forbidden_tenant_scope" }), { status: 403, headers: { "content-type": "application/json" } });
    }
  }
  console.info("[admin_sse_access]", JSON.stringify({ requestId, scope: scope || "none", forcedTenantSlug: forcedTenantSlug || null, sourceFilter }));

  let cancelled = false;
  let cancelStream: ((closeController: boolean) => void) | null = null;
  let flushOutput: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const tenant = (forcedTenantSlug || String(searchParams.get("tenant") || "")).trim().toLowerCase();
      const verdict = String(searchParams.get("verdict") || "").trim().toUpperCase();
      const risk = String(searchParams.get("risk") || "").trim().toUpperCase();
      const reconnectRetryMs = resolveJitteredRealtimeDelay(3_000, { jitterRatio: 0.15 });
      const encodeEventFrame = (event: string, payload: unknown, eventId = "") => encoder.encode(
        `${eventId ? `id: ${eventId}\n` : ""}event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
      );
      const outputQueue = createBoundedRealtimeSseOutputQueue({
        controller,
        maxPendingFrames: MAX_PENDING_OUTPUT_FRAMES,
        maxPendingBytes: MAX_PENDING_OUTPUT_BYTES,
        overflowFrame: encoder.encode(`id:\nevent: warning\ndata: ${JSON.stringify({
          id: `warning-${Date.now()}`,
          stream_request_id: requestId,
          source: sourceFilter,
          availability: "upstream_error",
          reason: "output_backpressure_overflow",
          recovery: "snapshot_reset",
        })}\n\n`),
        onOverflow: () => {
          closed = true;
          console.warn("[admin_sse_output_backpressure_overflow]", JSON.stringify({
            requestId,
            sourceFilter,
            maxPendingFrames: MAX_PENDING_OUTPUT_FRAMES,
            maxPendingBytes: MAX_PENDING_OUTPUT_BYTES,
          }));
          cancelStream?.(false);
        },
      });
      flushOutput = outputQueue.flush;
      const send = (event: string, payload: unknown, transportCursor = "") => {
        if (closed || cancelled) return;
        const durableEventId = event === "event" && typeof payload === "object" && payload && "eventId" in (payload as Record<string, unknown>)
          ? String((payload as Record<string, unknown>).eventId || "").trim()
          : "";
        const eventId = /^\d+-\d+$/.test(transportCursor)
          ? transportCursor
          : /^\d+$/.test(durableEventId)
            ? durableEventId
            : "";
        outputQueue.write(encodeEventFrame(event, payload, eventId));
      };
      outputQueue.write(encoder.encode(`retry: ${reconnectRetryMs}\n\n`));

      const rememberEvent = createBoundedRealtimeProjectionDeduper<TenantTapRealtimeEvent>(
        (event) => String(event.eventId || ""),
        (event) => JSON.stringify({
          ...event,
          commercialConsentChannels: [...event.commercialConsentChannels].sort(),
        }),
        MAX_SEEN_EVENT_IDS,
      );
      const rememberDelivery = createBoundedRealtimeProjectionDeduper<Record<string, unknown>>(
        (payload) => String(payload.realtime_delivery_id || ""),
        () => "delivered",
        MAX_SEEN_EVENT_IDS,
      );
      const emitTapEvent = (rawPayload: Record<string, unknown>, transportCursor = "") => {
        const embeddedProjection = readEmbeddedTenantTapProjection(rawPayload.tap_projection);
        const normalized = embeddedProjection || normalizePersistedTenantTapRealtimeEvent(rawPayload);
        if (!allowRealtimeEventForSource(sourceFilter, embeddedProjection?.eventSource ?? rawPayload.source)) return;
        // Only complete persisted projections may cross a tenant stream. Raw
        // in-process notifications remain harmless and cannot replace truth.
        if (!normalized.tenantId || !normalized.tenantSlug || !normalized.batchId) return;
        if (!allowRealtimeEventForScope({
          scope,
          forcedTenantSlug,
          requestedTenant: tenant,
          eventTenantSlug: normalized.tenantSlug,
        })) return;
        if (verdict && String(normalized.verdict || "").toUpperCase() !== verdict) return;
        if (risk && String(normalized.riskLevel || "").toUpperCase() !== risk) return;
        if (realtimeWindow.maxAgeMs !== null) {
          const createdAt = new Date(String(normalized.occurredAt || Date.now()));
          if (Number.isNaN(createdAt.getTime())) return;
          if (createdAt.getTime() < Date.now() - realtimeWindow.maxAgeMs) return;
        }
        if (!rememberEvent(normalized)) return;
        const emittedAt = new Date();
        const createdAtMs = normalized.occurredAt ? new Date(String(normalized.occurredAt)).getTime() : NaN;
        const streamLatencyMs = Number.isFinite(createdAtMs) ? Math.max(0, emittedAt.getTime() - createdAtMs) : null;
        send("event", {
          ...normalized,
          stream_sent_at: emittedAt.toISOString(),
          stream_latency_ms: streamLatencyMs,
          stream_request_id: requestId,
          realtime_delivery_id: String(rawPayload.realtime_delivery_id || "") || null,
          request_id: requestId,
        }, transportCursor);
      };
      const handleRealtimePayload = (rawPayload: Record<string, unknown>) => {
        const transportCursor = String(rawPayload.realtime_cursor || "").trim();
        if (String(rawPayload.event_type || "") === "realtime.transport_reset") {
          send("warning", {
            reason: String(rawPayload.reason || "realtime_transport_reset"),
            source: sourceFilter,
            availability: "upstream_error",
            stream_request_id: requestId,
          });
          return;
        }
        const deliveryId = String(rawPayload.realtime_delivery_id || "").trim();
        if (deliveryId) {
          if (!REALTIME_DELIVERY_ID_PATTERN.test(deliveryId)) return;
          if (!rememberDelivery(rawPayload)) return;
        }
        if (isSecurityAlertPayload(rawPayload)) {
          // Alerts do not yet carry the source of their originating tap. Keep them
          // on explicit mixed streams only instead of guessing demo/production.
          if (sourceFilter !== "all") return;
          if (!allowRealtimeEventForScope({
            scope,
            forcedTenantSlug,
            requestedTenant: tenant,
            eventTenantSlug: typeof rawPayload.tenant_slug === "string" ? rawPayload.tenant_slug : null,
          })) return;
          send("event", {
            event_type: "security_alert.created",
            alert_id: String(rawPayload.alert_id),
            tenant_id: rawPayload.tenant_id ? String(rawPayload.tenant_id) : null,
            tenant_slug: rawPayload.tenant_slug ? String(rawPayload.tenant_slug) : null,
            type: String(rawPayload.type || ""),
            severity: String(rawPayload.severity || ""),
            created_at: String(rawPayload.created_at || new Date().toISOString()),
            stream_sent_at: new Date().toISOString(),
            stream_request_id: requestId,
            realtime_delivery_id: deliveryId || null,
            request_id: requestId,
          }, transportCursor);
          return;
        }

        if (isIncidentPayload(rawPayload)) {
          if (!canReadIncidents) return;
          if (!allowRealtimeEventForSource(sourceFilter, rawPayload.source)) return;
          if (!allowRealtimeEventForScope({
            scope,
            forcedTenantSlug,
            requestedTenant: tenant,
            eventTenantSlug: typeof rawPayload.tenant_slug === "string" ? rawPayload.tenant_slug : null,
          })) return;
          send("event", {
            event_type: rawPayload.event_type,
            incident_id: String(rawPayload.incident_id),
            incident_event_id: String(rawPayload.incident_event_id),
            ticket_id: String(rawPayload.ticket_id),
            tenant_id: rawPayload.tenant_id ? String(rawPayload.tenant_id) : null,
            tenant_slug: rawPayload.tenant_slug ? String(rawPayload.tenant_slug) : null,
            incident_status: String(rawPayload.incident_status || ""),
            incident_severity: String(rawPayload.incident_severity || ""),
            source: rawPayload.source ? String(rawPayload.source) : null,
            created_at: String(rawPayload.created_at || new Date().toISOString()),
            stream_sent_at: new Date().toISOString(),
            stream_request_id: requestId,
            realtime_delivery_id: deliveryId || null,
            request_id: requestId,
          }, transportCursor);
          return;
        }

        if (isOperationalNotificationPayload(rawPayload)) {
          if (!allowRealtimeEventForSource(sourceFilter, rawPayload.source)) return;
          if (!allowRealtimeEventForScope({
            scope,
            forcedTenantSlug,
            requestedTenant: tenant,
            eventTenantSlug: typeof rawPayload.tenant_slug === "string" ? rawPayload.tenant_slug : null,
          })) return;
          send("event", {
            event_type: String(rawPayload.event_type || "").trim().toLowerCase(),
            tenant_id: rawPayload.tenant_id ? String(rawPayload.tenant_id) : null,
            tenant_slug: rawPayload.tenant_slug ? String(rawPayload.tenant_slug) : null,
            lead_id: rawPayload.lead_id ? String(rawPayload.lead_id) : null,
            ticket_id: rawPayload.ticket_id ? String(rawPayload.ticket_id) : null,
            sdk_event_id: rawPayload.sdk_event_id ? String(rawPayload.sdk_event_id) : null,
            status: rawPayload.status ? String(rawPayload.status) : null,
            source: rawPayload.source ? String(rawPayload.source) : null,
            created_at: String(rawPayload.created_at || new Date().toISOString()),
            stream_sent_at: new Date().toISOString(),
            stream_request_id: requestId,
            realtime_delivery_id: deliveryId || null,
            request_id: requestId,
          }, transportCursor);
          return;
        }

        emitTapEvent(rawPayload, transportCursor);
      };

      void runRealtimeStreamLifecycle<TenantTapRealtimeEvent, Record<string, unknown>>({
        signal: req.signal,
        subscribe: (listener) => subscribeRealtimeEvent(
          listener,
          tenant
            ? { tenantSlug: tenant, after: resumeCursor || null, signal: req.signal }
            : { global: true, after: resumeCursor || null, signal: req.signal },
        ),
        fetchSnapshot: async () => {
          const snapshotRows = await fetchRows(searchParams, realtimeWindow, forcedTenantSlug, sourceFilter);
          return snapshotRows.map((row) => normalizePersistedTenantTapRealtimeEvent(row));
        },
        rememberSnapshotRow: rememberEvent,
        emitConnected: (subscription) => {
          send("connected", {
            id: `connected-${Date.now()}`,
            stream_request_id: requestId,
            source: sourceFilter,
            transport: subscription.transport,
            availability: "ready",
            ts: new Date().toISOString(),
          });
        },
        emitSnapshot: (rows, subscription) => {
          const resetResumeCursor = subscription.replay === "snapshot_reset";
          // An empty SSE id field clears EventSource's stored Last-Event-ID.
          // Without it, a trimmed/invalid cursor would be sent forever on every
          // automatic reconnect even though this durable snapshot recovered it.
          if (resetResumeCursor) outputQueue.write(encoder.encode("id:\n"));
          send("snapshot", {
            id: `snapshot-${Date.now()}`,
            stream_request_id: requestId,
            source: sourceFilter,
            availability: "ready",
            scope: { tenant: tenant || "global", window: realtimeWindow.id },
            replay: {
              mode: subscription.replay || "snapshot_only",
              cursor_reset: resetResumeCursor,
              reset_reason: subscription.replayResetReason || null,
            },
            rows,
          });
        },
        handlePayload: handleRealtimePayload,
        isTerminalPayload: (payload) => String(payload.event_type || "") === "realtime.transport_reset",
        emitTransportUnavailable: () => {
          send("warning", {
            id: `warning-${Date.now()}`,
            stream_request_id: requestId,
            source: sourceFilter,
            availability: "upstream_error",
            reason: "realtime_transport_unavailable",
          });
        },
        emitSnapshotUnavailable: (error) => {
          const errorCode = safeOperationalErrorCode(error, "snapshot_query_failed");
          console.warn("[admin_sse_snapshot_unavailable]", JSON.stringify({
            requestId,
            errorCode,
          }));
          send("warning", {
            id: `warning-${Date.now()}`,
            stream_request_id: requestId,
            source: sourceFilter,
            availability: "upstream_error",
            reason: "snapshot_unavailable",
          });
        },
        emitStartupBufferOverflow: () => {
          send("warning", {
            id: `warning-${Date.now()}`,
            stream_request_id: requestId,
            source: sourceFilter,
            availability: "upstream_error",
            reason: "startup_buffer_overflow",
          });
        },
        emitHeartbeat: (now) => {
          outputQueue.write(encoder.encode(`: ping ${now}\n\n`));
          send("heartbeat", { id: `hb-${now}`, ts: now, stream_request_id: requestId });
        },
        closeController: () => {
          closed = true;
          flushOutput = null;
          outputQueue.close();
        },
        isExternallyCancelled: () => cancelled,
        registerShutdown: (shutdown) => {
          cancelStream = shutdown;
        },
      }).catch((error) => {
        if (closed || cancelled) return;
        console.warn("[admin_sse_lifecycle_failed]", JSON.stringify({
          requestId,
          errorCode: safeOperationalErrorCode(error, "realtime_lifecycle_failed"),
        }));
        send("warning", {
          id: `warning-${Date.now()}`,
          stream_request_id: requestId,
          source: sourceFilter,
          availability: "upstream_error",
          reason: "realtime_lifecycle_failed",
        });
        cancelStream?.(false);
        closed = true;
        flushOutput = null;
        outputQueue.close();
      });
    },
    pull() {
      flushOutput?.();
    },
    cancel() {
      cancelled = true;
      flushOutput = null;
      cancelStream?.(false);
    },
  }, {
    highWaterMark: SSE_OUTPUT_HIGH_WATER_MARK_BYTES,
    size: (chunk) => chunk.byteLength,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
      "x-nexid-request-id": requestId,
    },
  });
}
