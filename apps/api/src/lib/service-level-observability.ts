import { sql } from "./db";

export const SERVICE_LEVEL_SCHEMA_VERSION = "nexid.service-levels.v1" as const;

export type ServiceLevelWindowId = "1h" | "24h" | "7d" | "30d";
export type ServiceLevelState = "healthy" | "breach" | "insufficient_data" | "no_data" | "ticket" | "page" | "unavailable";

type IndicatorDefinition = {
  id: string;
  name: string;
  objective: string;
  target: number;
  minimumSample: number;
  runbookId: string;
};

export type ServiceLevelIndicator = IndicatorDefinition & {
  source: "persisted_database_aggregate";
  eligibleEvents: number | null;
  goodEvents: number | null;
  badEvents: number | null;
  ratio: number | null;
  errorBudgetRemaining: number | null;
  burnRate: number | null;
  evaluationWindow: ServiceLevelWindowId;
  alertThresholds: { page: number | null; ticket: number | null };
  state: ServiceLevelState;
};

export type OperationalSignal = {
  id: string;
  name: string;
  source: "persisted_database_aggregate";
  value: number;
  unit: "count" | "seconds";
  warningThreshold: number;
  criticalThreshold: number;
  state: "healthy" | "ticket" | "page";
  runbookId: string;
};

export type ServiceLevelService = {
  id: "sun" | "canonical_event_outbox" | "webhooks" | "incidents" | "polygon_queue" | "iota_queue";
  name: string;
  availability: "ready" | "unavailable";
  reason: string | null;
  indicators: ServiceLevelIndicator[];
  signals: OperationalSignal[];
};

export type ServiceLevelAlert = {
  id: string;
  serviceId: ServiceLevelService["id"];
  severity: "ticket" | "page";
  sourceId: string;
  summary: string;
  runbookId: string;
};

const WINDOWS: Record<ServiceLevelWindowId, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export const SERVICE_LEVEL_BURN_THRESHOLDS: Record<
  ServiceLevelWindowId,
  { page: number | null; ticket: number | null }
> = {
  "1h": { page: 14.4, ticket: null },
  "24h": { page: 6, ticket: 3 },
  "7d": { page: null, ticket: 1 },
  "30d": { page: null, ticket: null },
};

export const SERVICE_LEVEL_DEFINITIONS = {
  sun: {
    id: "sun.persisted_adjudication_completeness",
    name: "SUN persisted adjudication completeness",
    objective: "Every persisted, non-demo SUN tap has a tenant, batch, result and normalized verdict. This does not measure requests that failed before persistence.",
    target: 0.9995,
    minimumSample: 20,
    runbookId: "sun-adjudication",
  },
  canonical: {
    id: "canonical_event_outbox.persistence_integrity",
    name: "Canonical event and outbox persistence integrity",
    objective: "Live canonical operations retain their partitioned event identity and every observed canonical delivery matches the operation tenant, event type and canonical event id.",
    target: 0.9999,
    minimumSample: 1,
    runbookId: "canonical-event-outbox",
  },
  webhooks: {
    id: "webhooks.terminal_delivery_success",
    name: "Webhook terminal delivery success",
    objective: "Delivered terminal attempts divided by delivered plus dead-letter terminal attempts; pending work is monitored separately as queue age.",
    target: 0.99,
    minimumSample: 20,
    runbookId: "webhook-delivery",
  },
  incidentAck: {
    id: "incidents.acknowledged_within_15m",
    name: "Incident acknowledgement within 15 minutes",
    objective: "Incidents old enough to evaluate have a first investigating, contained, resolved or dismissed transition within 15 minutes.",
    target: 0.95,
    minimumSample: 5,
    runbookId: "incident-response",
  },
  incidentDisposition: {
    id: "incidents.terminal_disposition_within_4h",
    name: "Incident terminal disposition within 4 hours",
    objective: "Incidents old enough to evaluate reach resolved or dismissed within four hours; dismissal is an audited disposition, not proof of remediation.",
    target: 0.9,
    minimumSample: 5,
    runbookId: "incident-response",
  },
  polygon: {
    id: "polygon_queue.terminal_anchor_success",
    name: "Polygon terminal anchor success",
    objective: "Real Polygon requests ending anchored divided by anchored plus failed; simulations are excluded and pending work is monitored separately.",
    target: 0.99,
    minimumSample: 5,
    runbookId: "polygon-queue",
  },
  iota: {
    id: "iota_queue.terminal_confirmation_success",
    name: "IOTA terminal confirmation success",
    objective: "Real IOTA anchors ending confirmed divided by confirmed plus failed; mock anchors are excluded and pending work is monitored separately.",
    target: 0.99,
    minimumSample: 5,
    runbookId: "iota-queue",
  },
} satisfies Record<string, IndicatorDefinition>;

function finiteNonNegative(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function rounded(value: number, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function resolveServiceLevelWindow(value: unknown): ServiceLevelWindowId {
  const candidate = String(value || "24h").trim().toLowerCase();
  return candidate in WINDOWS ? candidate as ServiceLevelWindowId : "24h";
}

export function evaluateServiceLevelIndicator(
  definition: IndicatorDefinition,
  eligibleEvents: unknown,
  goodEvents: unknown,
  window: ServiceLevelWindowId = "24h",
): ServiceLevelIndicator {
  const total = Math.floor(finiteNonNegative(eligibleEvents));
  const good = Math.min(total, Math.floor(finiteNonNegative(goodEvents)));
  const bad = total - good;
  const ratio = total ? good / total : null;
  const budgetFraction = 1 - definition.target;
  const burnRate = ratio === null ? null : (1 - ratio) / budgetFraction;
  const budgetEvents = total * budgetFraction;
  const errorBudgetRemaining = total
    ? Math.max(0, Math.min(1, 1 - bad / Math.max(budgetEvents, Number.EPSILON)))
    : null;

  const alertThresholds = SERVICE_LEVEL_BURN_THRESHOLDS[window];
  let state: ServiceLevelState;
  if (!total) state = "no_data";
  else if (alertThresholds.page !== null && burnRate !== null && burnRate >= alertThresholds.page) state = "page";
  else if (alertThresholds.ticket !== null && burnRate !== null && burnRate >= alertThresholds.ticket) state = "ticket";
  else if (burnRate !== null && burnRate >= 1) state = "breach";
  else if (total < definition.minimumSample) state = "insufficient_data";
  else state = "healthy";

  return {
    ...definition,
    source: "persisted_database_aggregate",
    eligibleEvents: total,
    goodEvents: good,
    badEvents: bad,
    ratio: ratio === null ? null : rounded(ratio),
    errorBudgetRemaining: errorBudgetRemaining === null ? null : rounded(errorBudgetRemaining),
    burnRate: burnRate === null ? null : rounded(burnRate, 3),
    evaluationWindow: window,
    alertThresholds,
    state,
  };
}

function unavailableIndicator(definition: IndicatorDefinition, window: ServiceLevelWindowId): ServiceLevelIndicator {
  return {
    ...definition,
    source: "persisted_database_aggregate",
    eligibleEvents: null,
    goodEvents: null,
    badEvents: null,
    ratio: null,
    errorBudgetRemaining: null,
    burnRate: null,
    evaluationWindow: window,
    alertThresholds: SERVICE_LEVEL_BURN_THRESHOLDS[window],
    state: "unavailable",
  };
}

export function evaluateOperationalSignal(input: Omit<OperationalSignal, "source" | "state">): OperationalSignal {
  const value = finiteNonNegative(input.value);
  const state = value >= input.criticalThreshold ? "page" : value >= input.warningThreshold ? "ticket" : "healthy";
  return { ...input, value, source: "persisted_database_aggregate", state };
}

function safeQueryReason(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "required_schema_migration_not_applied") return "schema_watermark_unavailable";
  if (message === "DATABASE_URL is not set") return "database_unavailable";
  if (/relation .* does not exist/i.test(message)) return "schema_unavailable";
  return "query_unavailable";
}

function logQueryFailure(serviceId: ServiceLevelService["id"], reason: string) {
  console.error(JSON.stringify({
    level: "error",
    message: "service_level_query_failed",
    service: serviceId,
    reason,
  }));
}

async function serviceFromQuery(
  id: ServiceLevelService["id"],
  name: string,
  definitions: IndicatorDefinition[],
  window: ServiceLevelWindowId,
  query: () => Promise<ServiceLevelService>,
): Promise<ServiceLevelService> {
  try {
    return await query();
  } catch (error) {
    const reason = safeQueryReason(error);
    logQueryFailure(id, reason);
    return {
      id,
      name,
      availability: "unavailable",
      reason,
      indicators: definitions.map((definition) => unavailableIndicator(definition, window)),
      signals: [],
    };
  }
}

export async function resolveServiceLevelTenantId(tenantSlug: string) {
  const rows = await sql/*sql*/`
    SELECT id::text
    FROM tenants
    WHERE lower(slug) = ${tenantSlug}
    LIMIT 1
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
}

async function readSunService(tenantId: string | null, cutoff: string, window: ServiceLevelWindowId): Promise<ServiceLevelService> {
  const rows = await sql/*sql*/`
    SELECT
      count(*)::integer AS eligible,
      count(*) FILTER (
        WHERE e.tenant_id IS NOT NULL
          AND e.batch_id IS NOT NULL
          AND NULLIF(btrim(e.result), '') IS NOT NULL
          AND NULLIF(btrim(e.verdict), '') IS NOT NULL
      )::integer AS good
    FROM events e
    WHERE e.created_at >= ${cutoff}::timestamptz
      AND COALESCE(e.source::text, 'real') <> 'demo'
      AND e.event_type::text IN ('TAP_VALID', 'TAP_INVALID', 'REPLAY_SUSPECT')
      AND (${tenantId}::uuid IS NULL OR e.tenant_id = ${tenantId}::uuid)
  `;
  const row = rows[0] || {};
  return {
    id: "sun",
    name: "NFC SUN adjudication",
    availability: "ready",
    reason: null,
    indicators: [evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.sun, row.eligible, row.good, window)],
    signals: [],
  };
}

async function readCanonicalService(tenantId: string | null, cutoff: string, window: ServiceLevelWindowId): Promise<ServiceLevelService> {
  const rows = await sql/*sql*/`
    WITH scoped_operations AS MATERIALIZED (
      SELECT operation.*,
             event.id AS persisted_event_id
      FROM canonical_event_operations operation
      LEFT JOIN events event
        ON event.id = operation.event_id
       AND event.created_at = operation.event_created_at
       AND event.tenant_id = operation.tenant_id
      WHERE operation.created_at >= ${cutoff}::timestamptz
        AND operation.event_mode = 'live'
        AND (${tenantId}::uuid IS NULL OR operation.tenant_id = ${tenantId}::uuid)
    ),
    operation_quality AS (
      SELECT operation.id,
             operation.persisted_event_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1
               FROM webhook_deliveries delivery
               JOIN webhook_endpoints endpoint ON endpoint.id = delivery.endpoint_id
               WHERE delivery.event_id = 'evt_canonical_' || operation.id::text
                 AND (
                 endpoint.tenant_id <> operation.tenant_id
                  OR delivery.event_name <> operation.event_name
                  OR COALESCE(delivery.payload->>'schemaVersion', '') <> '1.0'
                  OR COALESCE(delivery.payload->>'id', '') <> delivery.event_id
                  OR COALESCE(delivery.payload->>'type', '') <> operation.event_name
                  OR COALESCE(delivery.payload #>> '{data,canonicalEventId}', '') <> operation.event_id::text
                )
             ) AS good
      FROM scoped_operations operation
    ),
    orphan_deliveries AS (
      SELECT count(*)::integer AS count
      FROM webhook_deliveries delivery
      JOIN webhook_endpoints endpoint ON endpoint.id = delivery.endpoint_id
      WHERE delivery.created_at >= ${cutoff}::timestamptz
        AND delivery.event_id LIKE 'evt_canonical_%'
        AND COALESCE(delivery.payload #>> '{data,eventMode}', 'live') = 'live'
        AND (${tenantId}::uuid IS NULL OR endpoint.tenant_id = ${tenantId}::uuid)
        AND NOT EXISTS (
          SELECT 1
          FROM canonical_event_operations operation
          WHERE 'evt_canonical_' || operation.id::text = delivery.event_id
            AND operation.tenant_id = endpoint.tenant_id
        )
    )
    SELECT
      (count(*) + (SELECT count FROM orphan_deliveries))::integer AS eligible,
      count(*) FILTER (WHERE good)::integer AS good
    FROM operation_quality
  `;
  const row = rows[0] || {};
  return {
    id: "canonical_event_outbox",
    name: "Canonical event and transactional outbox",
    availability: "ready",
    reason: null,
    indicators: [evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.canonical, row.eligible, row.good, window)],
    signals: [],
  };
}

async function readWebhookService(tenantId: string | null, cutoff: string, window: ServiceLevelWindowId): Promise<ServiceLevelService> {
  const rows = await sql/*sql*/`
    SELECT
      count(*) FILTER (
        WHERE delivery.created_at >= ${cutoff}::timestamptz
          AND delivery.status IN ('delivered', 'dead_letter')
      )::integer AS eligible,
      count(*) FILTER (
        WHERE delivery.created_at >= ${cutoff}::timestamptz
          AND delivery.status = 'delivered'
      )::integer AS good,
      count(*) FILTER (
        WHERE delivery.status IN ('pending', 'processing', 'retry_scheduled')
      )::integer AS queue_depth,
      count(*) FILTER (
        WHERE delivery.status IN ('pending', 'processing', 'retry_scheduled')
          AND COALESCE(delivery.next_attempt_at, delivery.created_at) < now()
      )::integer AS overdue,
      COALESCE(EXTRACT(EPOCH FROM (now() - min(delivery.created_at) FILTER (
        WHERE delivery.status IN ('pending', 'processing', 'retry_scheduled')
      ))), 0)::bigint AS oldest_age_seconds
    FROM webhook_deliveries delivery
    JOIN webhook_endpoints endpoint ON endpoint.id = delivery.endpoint_id
    WHERE (${tenantId}::uuid IS NULL OR endpoint.tenant_id = ${tenantId}::uuid)
      AND COALESCE(delivery.payload #>> '{data,eventMode}', 'live') NOT IN ('demo', 'simulated')
      AND COALESCE(delivery.payload #>> '{data,simulated}', 'false') <> 'true'
  `;
  const row = rows[0] || {};
  return {
    id: "webhooks",
    name: "Signed webhook delivery",
    availability: "ready",
    reason: null,
    indicators: [evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.webhooks, row.eligible, row.good, window)],
    signals: [
      evaluateOperationalSignal({
        id: "webhooks.oldest_open_delivery_age",
        name: "Oldest open delivery age",
        value: finiteNonNegative(row.oldest_age_seconds),
        unit: "seconds",
        warningThreshold: 300,
        criticalThreshold: 900,
        runbookId: "webhook-delivery",
      }),
      evaluateOperationalSignal({
        id: "webhooks.overdue_delivery_count",
        name: "Overdue delivery count",
        value: finiteNonNegative(row.overdue),
        unit: "count",
        warningThreshold: 1,
        criticalThreshold: 25,
        runbookId: "webhook-delivery",
      }),
    ],
  };
}

async function readIncidentService(tenantId: string | null, cutoff: string, window: ServiceLevelWindowId): Promise<ServiceLevelService> {
  const rows = await sql/*sql*/`
    WITH cohort_incidents AS MATERIALIZED (
      SELECT incident.*,
             progress.first_progress_at
      FROM event_incidents incident
      JOIN events event
        ON event.id = incident.event_id
       AND event.created_at = incident.event_created_at
      LEFT JOIN LATERAL (
        SELECT min(history.created_at) AS first_progress_at
        FROM event_incident_history history
        WHERE history.incident_id = incident.id
          AND history.to_status IN ('investigating', 'contained', 'resolved', 'dismissed')
          AND history.action <> 'opened'
      ) progress ON true
      WHERE incident.created_at >= ${cutoff}::timestamptz
        AND COALESCE(event.source::text, 'real') <> 'demo'
        AND (${tenantId}::uuid IS NULL OR incident.tenant_id = ${tenantId}::uuid)
    ),
    current_open_incidents AS MATERIALIZED (
      SELECT incident.created_at,
             incident.severity
      FROM event_incidents incident
      JOIN events event
        ON event.id = incident.event_id
       AND event.created_at = incident.event_created_at
      WHERE incident.status NOT IN ('resolved', 'dismissed')
        AND COALESCE(event.source::text, 'real') <> 'demo'
        AND (${tenantId}::uuid IS NULL OR incident.tenant_id = ${tenantId}::uuid)
    )
    SELECT
      count(*) FILTER (WHERE created_at <= now() - interval '15 minutes')::integer AS ack_eligible,
      count(*) FILTER (
        WHERE created_at <= now() - interval '15 minutes'
          AND first_progress_at <= created_at + interval '15 minutes'
      )::integer AS ack_good,
      count(*) FILTER (WHERE created_at <= now() - interval '4 hours')::integer AS disposition_eligible,
      count(*) FILTER (
        WHERE created_at <= now() - interval '4 hours'
          AND resolved_at <= created_at + interval '4 hours'
      )::integer AS disposition_good,
      (SELECT count(*)::integer
       FROM current_open_incidents
       WHERE severity IN ('high', 'critical')) AS open_high_critical,
      COALESCE((SELECT EXTRACT(EPOCH FROM (now() - min(created_at)))::bigint
                FROM current_open_incidents), 0)::bigint AS oldest_open_age_seconds
    FROM cohort_incidents
  `;
  const row = rows[0] || {};
  return {
    id: "incidents",
    name: "Incident response workflow",
    availability: "ready",
    reason: null,
    indicators: [
      evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.incidentAck, row.ack_eligible, row.ack_good, window),
      evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.incidentDisposition, row.disposition_eligible, row.disposition_good, window),
    ],
    signals: [
      evaluateOperationalSignal({
        id: "incidents.open_high_critical_count",
        name: "Open high or critical incidents",
        value: finiteNonNegative(row.open_high_critical),
        unit: "count",
        warningThreshold: 1,
        criticalThreshold: 3,
        runbookId: "incident-response",
      }),
      evaluateOperationalSignal({
        id: "incidents.oldest_open_age",
        name: "Oldest open incident age",
        value: finiteNonNegative(row.oldest_open_age_seconds),
        unit: "seconds",
        warningThreshold: 3600,
        criticalThreshold: 4 * 3600,
        runbookId: "incident-response",
      }),
    ],
  };
}

async function readPolygonService(tenantId: string | null, cutoff: string, window: ServiceLevelWindowId): Promise<ServiceLevelService> {
  const rows = await sql/*sql*/`
    SELECT
      count(*) FILTER (
        WHERE request.requested_at >= ${cutoff}::timestamptz
          AND request.status IN ('anchored', 'failed')
      )::integer AS eligible,
      count(*) FILTER (
        WHERE request.requested_at >= ${cutoff}::timestamptz
          AND request.status = 'anchored'
      )::integer AS good,
      count(*) FILTER (WHERE request.status = 'pending')::integer AS queue_depth,
      count(*) FILTER (
        WHERE request.status = 'pending'
          AND COALESCE(request.next_attempt_at, request.requested_at) < now()
      )::integer AS overdue,
      COALESCE(EXTRACT(EPOCH FROM (now() - min(request.requested_at) FILTER (
        WHERE request.status = 'pending'
      ))), 0)::bigint AS oldest_age_seconds
    FROM tokenization_requests request
    WHERE lower(COALESCE(request.network, '')) LIKE 'polygon%'
      AND COALESCE(request.meta->>'simulated', 'false') <> 'true'
      AND (${tenantId}::uuid IS NULL OR request.tenant_id = ${tenantId}::uuid)
  `;
  const row = rows[0] || {};
  return {
    id: "polygon_queue",
    name: "Polygon ownership queue",
    availability: "ready",
    reason: null,
    indicators: [evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.polygon, row.eligible, row.good, window)],
    signals: [
      evaluateOperationalSignal({
        id: "polygon_queue.oldest_pending_age",
        name: "Oldest pending Polygon request age",
        value: finiteNonNegative(row.oldest_age_seconds),
        unit: "seconds",
        warningThreshold: 900,
        criticalThreshold: 3600,
        runbookId: "polygon-queue",
      }),
      evaluateOperationalSignal({
        id: "polygon_queue.overdue_count",
        name: "Overdue Polygon requests",
        value: finiteNonNegative(row.overdue),
        unit: "count",
        warningThreshold: 1,
        criticalThreshold: 10,
        runbookId: "polygon-queue",
      }),
    ],
  };
}

async function readIotaService(tenantId: string | null, cutoff: string, window: ServiceLevelWindowId): Promise<ServiceLevelService> {
  const rows = await sql/*sql*/`
    SELECT
      count(*) FILTER (
        WHERE anchor.created_at >= ${cutoff}::timestamptz
          AND anchor.status IN ('confirmed', 'failed')
      )::integer AS eligible,
      count(*) FILTER (
        WHERE anchor.created_at >= ${cutoff}::timestamptz
          AND anchor.status = 'confirmed'
      )::integer AS good,
      count(*) FILTER (
        WHERE anchor.status IN ('pending', 'submitted', 'reconciling')
      )::integer AS queue_depth,
      count(*) FILTER (
        WHERE anchor.status IN ('pending', 'submitted', 'reconciling')
          AND COALESCE(anchor.next_attempt_at, anchor.created_at) < now()
      )::integer AS overdue,
      COALESCE(EXTRACT(EPOCH FROM (now() - min(anchor.created_at) FILTER (
        WHERE anchor.status IN ('pending', 'submitted', 'reconciling')
      ))), 0)::bigint AS oldest_age_seconds
    FROM evidence_anchors anchor
    WHERE lower(anchor.provider) = 'iota'
      AND COALESCE(anchor.error_code, '') <> 'mock_test_only'
      AND (${tenantId}::uuid IS NULL OR anchor.tenant_id = ${tenantId}::uuid)
  `;
  const row = rows[0] || {};
  return {
    id: "iota_queue",
    name: "IOTA evidence queue",
    availability: "ready",
    reason: null,
    indicators: [evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.iota, row.eligible, row.good, window)],
    signals: [
      evaluateOperationalSignal({
        id: "iota_queue.oldest_pending_age",
        name: "Oldest pending IOTA anchor age",
        value: finiteNonNegative(row.oldest_age_seconds),
        unit: "seconds",
        warningThreshold: 900,
        criticalThreshold: 3600,
        runbookId: "iota-queue",
      }),
      evaluateOperationalSignal({
        id: "iota_queue.overdue_count",
        name: "Overdue IOTA anchors",
        value: finiteNonNegative(row.overdue),
        unit: "count",
        warningThreshold: 1,
        criticalThreshold: 10,
        runbookId: "iota-queue",
      }),
    ],
  };
}

function alertsFromServices(services: ServiceLevelService[]): ServiceLevelAlert[] {
  const alerts: ServiceLevelAlert[] = [];
  for (const service of services) {
    for (const indicator of service.indicators) {
      if (indicator.state !== "ticket" && indicator.state !== "page") continue;
      alerts.push({
        id: `${service.id}:${indicator.id}:${indicator.state}`,
        serviceId: service.id,
        severity: indicator.state,
        sourceId: indicator.id,
        summary: `${indicator.name}: error-budget burn ${indicator.burnRate ?? "unknown"}x`,
        runbookId: indicator.runbookId,
      });
    }
    for (const signal of service.signals) {
      if (signal.state !== "ticket" && signal.state !== "page") continue;
      alerts.push({
        id: `${service.id}:${signal.id}:${signal.state}`,
        serviceId: service.id,
        severity: signal.state,
        sourceId: signal.id,
        summary: `${signal.name}: ${signal.value} ${signal.unit}`,
        runbookId: signal.runbookId,
      });
    }
  }
  return alerts.sort((a, b) => (a.severity === b.severity ? a.id.localeCompare(b.id) : a.severity === "page" ? -1 : 1));
}

export async function buildServiceLevelSnapshot(input: {
  tenantId: string | null;
  window: ServiceLevelWindowId;
  now?: Date;
}) {
  const observedAt = input.now || new Date();
  const cutoff = new Date(observedAt.getTime() - WINDOWS[input.window]).toISOString();
  const tenantId = input.tenantId || null;
  const services = await Promise.all([
    serviceFromQuery("sun", "NFC SUN adjudication", [SERVICE_LEVEL_DEFINITIONS.sun], input.window, () => readSunService(tenantId, cutoff, input.window)),
    serviceFromQuery("canonical_event_outbox", "Canonical event and transactional outbox", [SERVICE_LEVEL_DEFINITIONS.canonical], input.window, () => readCanonicalService(tenantId, cutoff, input.window)),
    serviceFromQuery("webhooks", "Signed webhook delivery", [SERVICE_LEVEL_DEFINITIONS.webhooks], input.window, () => readWebhookService(tenantId, cutoff, input.window)),
    serviceFromQuery("incidents", "Incident response workflow", [SERVICE_LEVEL_DEFINITIONS.incidentAck, SERVICE_LEVEL_DEFINITIONS.incidentDisposition], input.window, () => readIncidentService(tenantId, cutoff, input.window)),
    serviceFromQuery("polygon_queue", "Polygon ownership queue", [SERVICE_LEVEL_DEFINITIONS.polygon], input.window, () => readPolygonService(tenantId, cutoff, input.window)),
    serviceFromQuery("iota_queue", "IOTA evidence queue", [SERVICE_LEVEL_DEFINITIONS.iota], input.window, () => readIotaService(tenantId, cutoff, input.window)),
  ]);
  const selectedWindowThresholds = SERVICE_LEVEL_BURN_THRESHOLDS[input.window];

  return {
    ok: true,
    schemaVersion: SERVICE_LEVEL_SCHEMA_VERSION,
    observedAt: observedAt.toISOString(),
    scope: { kind: tenantId ? "tenant" as const : "global" as const },
    window: { id: input.window, startsAt: cutoff, endsAt: observedAt.toISOString() },
    provenance: {
      source: "persisted_database_aggregates" as const,
      synthetic: false,
      fixtures: false,
      demoExcluded: true,
      tenantIdentifiersExposed: false,
      limitation: "Database aggregates do not measure requests that fail before persistence. Runtime availability requires separately configured request telemetry.",
    },
    alertPolicy: {
      automated: false,
      snapshotAlertsAreCandidates: true,
      pageBurnRate: selectedWindowThresholds.page,
      ticketBurnRate: selectedWindowThresholds.ticket,
      evaluation: "single selected window candidates; automated paging must require both windows from the contracts below",
      contracts: [
        { severity: "page", fastWindow: "1h", fastBurnRate: 14.4, slowWindow: "24h", slowBurnRate: 6 },
        { severity: "ticket", fastWindow: "24h", fastBurnRate: 3, slowWindow: "7d", slowBurnRate: 1 },
      ],
    },
    services,
    alerts: alertsFromServices(services),
  };
}

export const SERVICE_LEVEL_SNAPSHOT_CACHE_TTL_MS = 10_000;
export const SERVICE_LEVEL_SNAPSHOT_CACHE_MAX_ENTRIES = 128;

type ServiceLevelSnapshot = Awaited<ReturnType<typeof buildServiceLevelSnapshot>>;
type CachedServiceLevelSnapshot = { expiresAt: number; snapshot: ServiceLevelSnapshot };

const serviceLevelSnapshotCache = new Map<string, CachedServiceLevelSnapshot>();
const serviceLevelSnapshotInflight = new Map<string, Promise<ServiceLevelSnapshot>>();

function serviceLevelSnapshotCacheKey(tenantId: string | null, window: ServiceLevelWindowId) {
  return `${tenantId ? `tenant:${tenantId}` : "global"}\u0000${window}`;
}

function pruneServiceLevelSnapshotCache(nowMs: number) {
  for (const [key, entry] of serviceLevelSnapshotCache) {
    if (entry.expiresAt <= nowMs) serviceLevelSnapshotCache.delete(key);
  }
  while (serviceLevelSnapshotCache.size >= SERVICE_LEVEL_SNAPSHOT_CACHE_MAX_ENTRIES) {
    const oldest = serviceLevelSnapshotCache.keys().next().value;
    if (typeof oldest !== "string") break;
    serviceLevelSnapshotCache.delete(oldest);
  }
}

export function resetServiceLevelSnapshotCacheForTests() {
  serviceLevelSnapshotCache.clear();
  serviceLevelSnapshotInflight.clear();
}

/**
 * Instance-local, short-lived coalescing for the expensive aggregate snapshot.
 * Cache keys are tenant UUID plus a bounded window; values contain aggregate
 * counts only and never credentials, payloads or raw tenant identifiers.
 * The durable distributed limiter remains authoritative across instances.
 */
export async function getCachedServiceLevelSnapshot(
  input: { tenantId: string | null; window: ServiceLevelWindowId },
  dependencies: { clock?: () => number } = {},
) {
  const nowMs = (dependencies.clock || Date.now)();
  const key = serviceLevelSnapshotCacheKey(input.tenantId || null, input.window);
  const cached = serviceLevelSnapshotCache.get(key);
  if (cached && cached.expiresAt > nowMs) {
    serviceLevelSnapshotCache.delete(key);
    serviceLevelSnapshotCache.set(key, cached);
    return cached.snapshot;
  }
  if (cached) serviceLevelSnapshotCache.delete(key);

  const existing = serviceLevelSnapshotInflight.get(key);
  if (existing) return existing;

  const build = buildServiceLevelSnapshot({ ...input, now: new Date(nowMs) });
  // Bound retained promises under a burst of distinct superadmin tenant views.
  if (serviceLevelSnapshotInflight.size >= SERVICE_LEVEL_SNAPSHOT_CACHE_MAX_ENTRIES) {
    return build;
  }
  serviceLevelSnapshotInflight.set(key, build);
  try {
    const snapshot = await build;
    pruneServiceLevelSnapshotCache(nowMs);
    serviceLevelSnapshotCache.set(key, {
      expiresAt: nowMs + SERVICE_LEVEL_SNAPSHOT_CACHE_TTL_MS,
      snapshot,
    });
    return snapshot;
  } finally {
    if (serviceLevelSnapshotInflight.get(key) === build) {
      serviceLevelSnapshotInflight.delete(key);
    }
  }
}
