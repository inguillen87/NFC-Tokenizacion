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

type EventEvidence = {
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
export function classifyConsumerNetworkEvent(input: EventEvidence): ConsumerNetworkDataMode {
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
