import type { SqlExecutor } from "./db";

export const CONSUMER_NETWORK_DATA_MODES = [
  "operational_tap",
  "declared_demo",
  "imported",
  "legacy_unclassified",
  "mixed",
] as const;

export type ConsumerNetworkDataMode = (typeof CONSUMER_NETWORK_DATA_MODES)[number];

export type ConsumerNetworkProvenanceCounts = {
  operationalTap: number;
  declaredDemo: number;
  imported: number;
  legacyUnclassified: number;
  mixed: number;
};

export type ConsumerNetworkEventEvidence = {
  source?: unknown;
  eventType?: unknown;
  meta?: unknown;
  hasExactTenantAssetBinding?: boolean;
  hasCanonicalOperation?: boolean;
};

const TAP_EVENT_TYPES = new Set(["TAP_VALID", "TAP_INVALID", "REPLAY_SUSPECT"]);

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function flag(value: unknown) {
  return value === true || text(value).toLowerCase() === "true";
}

function falseFlag(value: unknown) {
  return value === false || text(value).toLowerCase() === "false";
}

function hasDeclaredDemoEvidence(source: string, meta: Record<string, unknown>) {
  const eventMode = text(meta.event_mode).toLowerCase();
  const replayClass = text(meta.replay_execution_class).toLowerCase();
  const corpus = text(meta.corpus).toLowerCase();
  return source === "demo"
    || eventMode === "demo"
    || eventMode === "simulated"
    || replayClass === "demo"
    || flag(meta.simulated)
    || flag(meta.demoEmitter)
    || (flag(meta.seed) && corpus.startsWith("demo"));
}

function hasCurrentWriterOperationalEvidence(meta: Record<string, unknown>) {
  const replayClass = text(meta.replay_execution_class).toLowerCase();
  return replayClass === "operational";
}

/**
 * Classifies only durable evidence. A bare source="real" is intentionally not
 * enough: that column was introduced with a real default for historical rows.
 */
export function classifyConsumerNetworkEvent(input: ConsumerNetworkEventEvidence): ConsumerNetworkDataMode {
  const source = text(input.source).toLowerCase();
  const eventType = text(input.eventType).toUpperCase();
  const meta = record(input.meta);

  if (hasDeclaredDemoEvidence(source, meta)) return "declared_demo";
  if (source === "imported") return "imported";
  if (
    source === "real"
    && TAP_EVENT_TYPES.has(eventType)
    && input.hasExactTenantAssetBinding === true
    && (
      hasCurrentWriterOperationalEvidence(meta)
      || (
        input.hasCanonicalOperation === true
        && flag(meta.canonical_event)
        && text(meta.event_family).toLowerCase() === "tap"
        && text(meta.event_mode).toLowerCase() === "live"
        && text(meta.metric_scope).toLowerCase() === "scan"
        && falseFlag(meta.simulated)
      )
    )
  ) return "operational_tap";
  return "legacy_unclassified";
}

/**
 * The same durable-evidence CASE used by the existing CRM queries. Aliases are
 * code-owned SQL identifiers, never request fields. Cryptographic verdicts do
 * not determine provenance: operational invalid/replay events remain visible.
 */
export function consumerNetworkEventProvenanceSql(aliases: {
  event: string;
  batch: string;
  tag: string;
}) {
  for (const alias of [aliases?.event, aliases?.batch, aliases?.tag]) {
    if (typeof alias !== "string" || !/^[a-z_][a-z0-9_]*$/.test(alias)) throw new Error("consumer_network_provenance_sql_alias_invalid");
  }
  const { event: e, batch: b, tag } = aliases;
  // Match JavaScript String.trim(), including tabs and Unicode whitespace.
  const whitespace = String.raw`U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'`;
  const normalized = (expression: string) => `LOWER(BTRIM(COALESCE(${expression}, ''), ${whitespace}))`;
  return `CASE
    WHEN ${normalized(`${e}.source::text`)} = 'demo'
      OR ${normalized(`${e}.meta->>'event_mode'`)} IN ('demo', 'simulated')
      OR ${normalized(`${e}.meta->>'replay_execution_class'`)} = 'demo'
      OR ${normalized(`${e}.meta->>'simulated'`)} = 'true'
      OR ${normalized(`${e}.meta->>'demoEmitter'`)} = 'true'
      OR (${normalized(`${e}.meta->>'seed'`)} = 'true'
          AND ${normalized(`${e}.meta->>'corpus'`)} LIKE 'demo%')
    THEN 'declared_demo'
    WHEN ${normalized(`${e}.source::text`)} = 'imported' THEN 'imported'
    WHEN ${normalized(`${e}.source::text`)} = 'real'
      AND ${normalized(`${e}.event_type::text`)} IN ('tap_valid', 'tap_invalid', 'replay_suspect')
      AND ${b}.id IS NOT NULL AND ${tag}.id IS NOT NULL
      AND (
        ${normalized(`${e}.meta->>'replay_execution_class'`)} = 'operational'
        OR (
          EXISTS (
            SELECT 1 FROM canonical_event_operations canonical_operation
            WHERE canonical_operation.tenant_id = ${e}.tenant_id
              AND canonical_operation.event_id = ${e}.id
              AND canonical_operation.event_created_at = ${e}.created_at
              AND canonical_operation.event_mode = 'live'
          )
          AND ${normalized(`${e}.meta->>'canonical_event'`)} = 'true'
          AND ${normalized(`${e}.meta->>'event_family'`)} = 'tap'
          AND ${normalized(`${e}.meta->>'event_mode'`)} = 'live'
          AND ${normalized(`${e}.meta->>'metric_scope'`)} = 'scan'
          AND ${normalized(`${e}.meta->>'simulated'`)} = 'false'
        )
      )
    THEN 'operational_tap'
    ELSE 'legacy_unclassified'
  END`;
}

/** Expand one static marker, while keeping every interpolated value bound. */
export function withConsumerNetworkEventProvenance(
  execute: SqlExecutor,
  aliases: Parameters<typeof consumerNetworkEventProvenanceSql>[0],
): SqlExecutor {
  const expression = consumerNetworkEventProvenanceSql(aliases);
  const marker = "/* consumer-network-event-provenance */";
  return (strings, ...values) => {
    const count = strings.reduce((total, part) => total + part.split(marker).length - 1, 0);
    if (count !== 1) throw new Error("consumer_network_provenance_sql_marker_required_once");
    const expanded = strings.map((part) => part.replace(marker, expression));
    const statement = Object.assign(expanded, { raw: [...expanded] }) as unknown as TemplateStringsArray;
    return execute(statement, ...values);
  };
}

export function readConsumerNetworkAggregateCount(value: unknown, key: string) {
  if (
    (typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && value.trim() === "")
  ) {
    throw new Error(`consumer_network_provenance_invalid:${key}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`consumer_network_provenance_invalid:${key}`);
  }
  return parsed;
}

function utcTimestamp(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error("consumer_network_provenance_invalid:latest_operational_at");
  return parsed.toISOString();
}

export function buildConsumerNetworkProvenance(input: {
  counts: Record<keyof ConsumerNetworkProvenanceCounts, unknown>;
  latestOperationalAt?: unknown;
  observedAt?: Date;
}) {
  const counts: ConsumerNetworkProvenanceCounts = {
    operationalTap: readConsumerNetworkAggregateCount(input.counts.operationalTap, "operationalTap"),
    declaredDemo: readConsumerNetworkAggregateCount(input.counts.declaredDemo, "declaredDemo"),
    imported: readConsumerNetworkAggregateCount(input.counts.imported, "imported"),
    legacyUnclassified: readConsumerNetworkAggregateCount(input.counts.legacyUnclassified, "legacyUnclassified"),
    mixed: readConsumerNetworkAggregateCount(input.counts.mixed, "mixed"),
  };
  const latestOperationalAt = utcTimestamp(input.latestOperationalAt);
  const observedAt = input.observedAt || new Date();
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error("consumer_network_provenance_invalid:observed_at");
  }
  if ((counts.operationalTap === 0) !== (latestOperationalAt === null)) {
    throw new Error("consumer_network_provenance_invalid:latest_operational_at_consistency");
  }
  if (latestOperationalAt && new Date(latestOperationalAt).getTime() > observedAt.getTime()) {
    throw new Error("consumer_network_provenance_invalid:latest_operational_at_future");
  }
  const nonOperational = counts.declaredDemo + counts.imported + counts.legacyUnclassified + counts.mixed;
  const state = counts.legacyUnclassified > 0
    ? counts.operationalTap > 0 || counts.declaredDemo > 0 || counts.imported > 0 || counts.mixed > 0
      ? "partial_legacy_unclassified"
      : "legacy_unclassified"
    : "classified";

  return {
    contractVersion: "consumer-network-event-provenance/v1" as const,
    state,
    primaryScope: "operational_tap" as const,
    timezone: "UTC" as const,
    physicalPresenceClaim: "not_asserted" as const,
    counts,
    hasIsolatedRecords: nonOperational > 0,
    latestOperationalAt,
    observedAt: observedAt.toISOString(),
    evidenceBasis: {
      operationalTap: "exact tenant/batch/tag binding plus DB-reserved current-writer metadata",
      declaredDemo: "events.source=demo or explicit DB/demo-writer metadata",
      legacyUnclassified: "historical provenance is insufficient; source=real alone is not authoritative",
    },
  };
}

export function consumerNetworkProvenanceFromRow(
  row: Record<string, unknown> | null | undefined,
  observedAt = new Date(),
) {
  const value = row || {
    provenance_operational_tap: 0,
    provenance_declared_demo: 0,
    provenance_imported: 0,
    provenance_legacy_unclassified: 0,
    provenance_mixed: 0,
    latest_operational_at: null,
  };
  return buildConsumerNetworkProvenance({
    counts: {
      operationalTap: value.provenance_operational_tap,
      declaredDemo: value.provenance_declared_demo,
      imported: value.provenance_imported,
      legacyUnclassified: value.provenance_legacy_unclassified,
      mixed: value.provenance_mixed,
    },
    latestOperationalAt: value.latest_operational_at,
    observedAt,
  });
}
