export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, checkAdminPermission, getAdminTenantScope } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { onRealtimeEvent } from "../../../../lib/realtime-events";
import { randomUUID } from "node:crypto";
import { normalizeTenantTapRealtimeEvent } from "@product/core";
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
  incident_title: string;
  source?: string;
  created_at: string;
};

function isSecurityAlertPayload(payload: Record<string, unknown>): payload is RealtimeAlertPayload {
  return String(payload.event_type || "") === "security_alert.created" && Boolean(payload.alert_id);
}

function resolveWindow(search: URLSearchParams) {
  const raw = String(search.get("window") || "24h").toLowerCase();
  const map: Record<string, string> = {
    "5m": "5 minutes",
    "1h": "1 hour",
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
    all: "",
  };
  return { raw, interval: map[raw] ?? "24 hours" };
}

function resolveWindowMs(raw: string): number | null {
  const map: Record<string, number> = {
    "5m": 5 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  return map[raw] ?? null;
}

function isIncidentPayload(payload: Record<string, unknown>): payload is RealtimeIncidentPayload {
  const type = String(payload.event_type || "");
  return (type === "incident.created" || type === "incident.updated")
    && Boolean(payload.incident_id)
    && Boolean(payload.incident_event_id)
    && Boolean(payload.ticket_id);
}

let eventLocationContextSchemaReady: Promise<void> | null = null;

async function ensureEventLocationContextSchema() {
  if (!eventLocationContextSchemaReady) {
    eventLocationContextSchemaReady = (async () => {
      await sql/*sql*/`ALTER TABLE events ADD COLUMN IF NOT EXISTS location_accuracy_m double precision`;
      await sql/*sql*/`ALTER TABLE events ADD COLUMN IF NOT EXISTS location_source text`;
      await sql/*sql*/`ALTER TABLE events ADD COLUMN IF NOT EXISTS location_updated_at timestamptz`;
    })().catch((error) => {
      eventLocationContextSchemaReady = null;
      throw error;
    });
  }
  return eventLocationContextSchemaReady;
}

async function fetchRows(
  search: URLSearchParams,
  forcedTenantSlug = "",
  sourceFilter: RealtimeEventSourceFilter = "all",
): Promise<EventRow[]> {
  await ensureEventLocationContextSchema().catch(() => null);
  const limit = Math.max(1, Math.min(200, Number(search.get("limit") || 40)));
  const tenant = (forcedTenantSlug || String(search.get("tenant") || "")).trim().toLowerCase();
  const verdict = String(search.get("verdict") || "").trim().toUpperCase();
  const risk = String(search.get("risk") || "").trim().toUpperCase();
  const { interval } = resolveWindow(search);
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
          e.verdict,
          e.risk_level,
          e.reason,
          e.uid_hex,
          e.created_at,
          e.city,
          e.country_code,
          e.lat,
          e.lng,
          e.location_source,
          e.location_accuracy_m,
          e.device_label,
          e.user_agent,
          e.meta,
          COALESCE(NULLIF(e.bid, ''), b.bid) AS bid,
          e.source,
          t.slug AS tenant_slug
        FROM events e
        LEFT JOIN batches b ON b.id = e.batch_id
        LEFT JOIN tenants t ON t.id = COALESCE(b.tenant_id, e.tenant_id)
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
        ORDER BY e.created_at DESC
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
          e.verdict,
          e.risk_level,
          e.reason,
          e.uid_hex,
          e.created_at,
          e.city,
          e.country_code,
          e.lat,
          e.lng,
          e.location_source,
          e.location_accuracy_m,
          e.device_label,
          e.user_agent,
          e.meta,
          COALESCE(NULLIF(e.bid, ''), b.bid) AS bid,
          e.source,
          t.slug AS tenant_slug
        FROM events e
        LEFT JOIN batches b ON b.id = e.batch_id
        LEFT JOIN tenants t ON t.id = COALESCE(b.tenant_id, e.tenant_id)
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
        ORDER BY e.created_at DESC
        LIMIT ${limit}
      `;
  return Array.isArray(rows) ? rows : [];
}

export async function GET(req: Request): Promise<Response> {
  const auth = await checkAdmin(req);
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
  const requestId = req.headers.get("x-request-id") || req.headers.get("x-nexid-request-id") || randomUUID();
  const encoder = new TextEncoder();
  if ((scope === "tenant_admin" || scope === "reseller") && forcedTenantSlug) {
    const requestedTenant = String(searchParams.get("tenant") || "").trim().toLowerCase();
    if (requestedTenant && requestedTenant !== forcedTenantSlug) {
      return new Response(JSON.stringify({ ok: false, reason: "forbidden_tenant_scope" }), { status: 403, headers: { "content-type": "application/json" } });
    }
  }
  console.info("[admin_sse_access]", JSON.stringify({ requestId, scope: scope || "none", forcedTenantSlug: forcedTenantSlug || null, sourceFilter }));

  let cancelled = false;
  let cancelStream: ((closeController: boolean) => void) | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const tenant = (forcedTenantSlug || String(searchParams.get("tenant") || "")).trim().toLowerCase();
      const verdict = String(searchParams.get("verdict") || "").trim().toUpperCase();
      const risk = String(searchParams.get("risk") || "").trim().toUpperCase();
      const { raw } = resolveWindow(searchParams);
      const windowMs = resolveWindowMs(raw);
      const send = (event: string, payload: unknown) => {
        if (closed || cancelled) return;
        const eventId = typeof payload === "object" && payload && "eventId" in (payload as Record<string, unknown>)
          ? String((payload as Record<string, unknown>).eventId)
          : String(Date.now());
        controller.enqueue(encoder.encode(`id: ${eventId}\n`));
        controller.enqueue(encoder.encode("retry: 5000\n"));
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        send("connected", { id: `connected-${Date.now()}`, stream_request_id: requestId, source: sourceFilter, availability: "ready", ts: new Date().toISOString() });
        const snapshotRows = await fetchRows(searchParams, forcedTenantSlug, sourceFilter);
        send("snapshot", { id: `snapshot-${Date.now()}`, stream_request_id: requestId, source: sourceFilter, availability: "ready", rows: snapshotRows.map((row) => normalizeTenantTapRealtimeEvent(row)) });
      } catch (error) {
        const errorCode = typeof (error as { code?: unknown })?.code === "string"
          ? String((error as { code: string }).code).slice(0, 32)
          : "snapshot_query_failed";
        const diagnostic = process.env.NODE_ENV === "test" && process.env.VERCEL_ENV === "test"
          ? String(error instanceof Error ? error.message : "snapshot_query_failed")
            .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted_database_url]")
            .slice(0, 240)
          : null;
        console.warn("[admin_sse_snapshot_unavailable]", JSON.stringify({
          requestId,
          errorCode,
          ...(diagnostic ? { diagnostic } : {}),
        }));
        send("warning", { id: `warning-${Date.now()}`, stream_request_id: requestId, reason: "snapshot_unavailable" });
      }

      if (cancelled) return;

      const unsubscribe = onRealtimeEvent((payload) => {
        const rawPayload = payload as Record<string, unknown>;
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
            request_id: requestId,
          });
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
            incident_title: String(rawPayload.incident_title || ""),
            source: rawPayload.source ? String(rawPayload.source) : null,
            created_at: String(rawPayload.created_at || new Date().toISOString()),
            stream_sent_at: new Date().toISOString(),
            stream_request_id: requestId,
            request_id: requestId,
          });
          return;
        }

        if (!allowRealtimeEventForSource(sourceFilter, rawPayload.source)) return;
        const normalized = normalizeTenantTapRealtimeEvent(rawPayload);
        if (!allowRealtimeEventForScope({
          scope,
          forcedTenantSlug,
          requestedTenant: tenant,
          eventTenantSlug: normalized.tenantSlug,
        })) return;
        if (verdict && String(normalized.verdict || "").toUpperCase() !== verdict.toUpperCase()) return;
        if (risk && String(normalized.riskLevel || "").toUpperCase() !== risk.toUpperCase()) return;
        if (windowMs) {
          const createdAt = new Date(String(normalized.occurredAt || Date.now()));
          if (Number.isNaN(createdAt.getTime())) return;
          const lowerBound = new Date(Date.now() - windowMs);
          if (createdAt < lowerBound) return;
        }
        const emittedAt = new Date();
        const createdAtMs = normalized.occurredAt ? new Date(String(normalized.occurredAt)).getTime() : NaN;
        const streamLatencyMs = Number.isFinite(createdAtMs) ? Math.max(0, emittedAt.getTime() - createdAtMs) : null;
        send("event", {
          ...normalized,
          stream_sent_at: emittedAt.toISOString(),
          stream_latency_ms: streamLatencyMs,
          stream_request_id: requestId,
          origin_trace_id: typeof rawPayload.trace_id === "string" && rawPayload.trace_id ? rawPayload.trace_id : null,
          request_id: requestId,
        });
      });

      const heartbeat = setInterval(() => {
        const now = Date.now();
        controller.enqueue(encoder.encode(`: ping ${now}\n\n`));
        send("heartbeat", { id: `hb-${now}`, ts: now, stream_request_id: requestId });
      }, 15000);

      const onAbort = () => shutdown();
      let lifetime: ReturnType<typeof setTimeout> | null = null;
      const shutdown = (closeController = true) => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        if (lifetime) clearTimeout(lifetime);
        unsubscribe();
        req.signal.removeEventListener("abort", onAbort);
        cancelStream = null;
        if (closeController) controller.close();
      };
      cancelStream = shutdown;

      lifetime = setTimeout(() => {
        shutdown();
      }, 4 * 60 * 1000);

      req.signal.addEventListener("abort", onAbort, { once: true });
    },
    cancel() {
      cancelled = true;
      cancelStream?.(false);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-nexid-request-id": requestId,
    },
  });
}
