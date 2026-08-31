export const SDK_SENSOR_READING_EVENT_TYPE = "product.sensor_reading" as const;
export const SDK_SENSOR_EVENT_SOURCE = "sdk_sensor" as const;
export const SDK_SENSOR_INGESTION_TRANSPORT = "rest_push" as const;

/**
 * A receipt proves that nexID accepted one tenant-reported reading. It is not
 * connector health and it never upgrades a gateway to a verified live stream.
 */
export type SdkSensorEvidenceReceipt = {
  kind: "reported";
  storage: "sdk_external_events";
  timelineEligible: boolean;
  ingestionTransport: typeof SDK_SENSOR_INGESTION_TRANSPORT;
  readingStatus: "accepted" | "quarantined";
  connectorStatus: "not_monitored";
  evidenceAuthority: "tenant_reported";
  liveStreamConnected: false;
};

export type SdkSensorReading = {
  temperatureC?: number;
  humidityPct?: number;
  lightExposure?: string;
  transitShock?: string;
  measuredAt: string;
  deviceId?: string;
  source: string;
  stage?: string;
};

export type NormalizedSdkSensorEvent = {
  bid: string;
  uidHex: string;
  occurredAt: string | null;
  source: typeof SDK_SENSOR_EVENT_SOURCE;
  data: { sensors: SdkSensorReading };
};

export type SdkSensorEventNormalization =
  | { ok: true; value: NormalizedSdkSensorEvent }
  | { ok: false; reason: string };

export type SdkSensorTimelineReading = {
  receivedAt: string;
  occurredAt: string | null;
  measuredAt: string;
  temperatureC: number | null;
  humidityPct: number | null;
  lightExposure: string | null;
  transitShock: string | null;
  deviceId: string | null;
  source: string;
  stage: string | null;
};

type SdkSensorTargetIdentity = {
  batchId?: string | null;
  tagId?: string | null;
  bid?: string | null;
  uidHex?: string | null;
};

const SENSOR_KEYS = new Set([
  "temperatureC",
  "humidityPct",
  "lightExposure",
  "transitShock",
  "measuredAt",
  "deviceId",
  "source",
  "stage",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized
    && normalized.length <= maxLength
    && !/[\u0000-\u001f\u007f]/.test(normalized)
    ? normalized
    : null;
}

function boundedNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
  return Math.round(value * 1_000) / 1_000;
}

function measurementText(value: unknown, max: number, unit: string): string | null {
  if (typeof value === "number") {
    const normalized = boundedNumber(value, 0, max);
    return normalized === null ? null : `${normalized} ${unit}`;
  }
  return boundedText(value, 80);
}

function isoInstant(value: unknown, nowMs: number): string | null {
  const text = boundedText(value, 64);
  if (!text || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) return null;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || parsed > nowMs + 15 * 60_000) return null;
  return new Date(parsed).toISOString();
}

export function isSdkSensorReadingEventType(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === SDK_SENSOR_READING_EVENT_TYPE;
}

export function sdkSensorEvidenceReceipt(timelineEligible: boolean): SdkSensorEvidenceReceipt {
  return {
    kind: "reported",
    storage: "sdk_external_events",
    timelineEligible,
    ingestionTransport: SDK_SENSOR_INGESTION_TRANSPORT,
    readingStatus: timelineEligible ? "accepted" : "quarantined",
    connectorStatus: "not_monitored",
    evidenceAuthority: "tenant_reported",
    liveStreamConnected: false,
  };
}

/**
 * Confirms that the target resolved before the write is exactly the target the
 * atomic SDK writer committed. A missing tag receipt is never SUN-eligible.
 */
export function sdkSensorReceiptMatchesTarget(
  expected: SdkSensorTargetIdentity,
  persisted: SdkSensorTargetIdentity,
) {
  const normalized = (value: string | null | undefined) => String(value ?? "").trim().toUpperCase();
  const expectedBatchId = normalized(expected.batchId);
  const expectedTagId = normalized(expected.tagId);
  const expectedBid = normalized(expected.bid);
  const expectedUid = normalized(expected.uidHex);
  return Boolean(
    expectedBatchId
    && expectedTagId
    && expectedBid
    && expectedUid
    && expectedBatchId === normalized(persisted.batchId)
    && expectedTagId === normalized(persisted.tagId)
    && expectedBid === normalized(persisted.bid)
    && expectedUid === normalized(persisted.uidHex)
  );
}

/**
 * Normalizes the only SDK payload that can be projected into the public SUN
 * sensor timeline. Everything outside the documented allowlist is rejected;
 * arbitrary connector JSON, credentials and request metadata are never copied
 * into canonical event evidence.
 */
export function normalizeSdkSensorEvent(input: {
  bid: unknown;
  uidHex?: unknown;
  occurredAt?: unknown;
  source?: unknown;
  data?: unknown;
}, nowMs = Date.now()): SdkSensorEventNormalization {
  const bid = boundedText(input.bid, 160);
  if (!bid) return { ok: false, reason: "sdk_sensor_bid_required" };

  const uidText = input.uidHex === undefined || input.uidHex === null
    ? ""
    : String(input.uidHex).trim().toUpperCase();
  if (!uidText) return { ok: false, reason: "sdk_sensor_uid_required" };
  if (!/^[0-9A-F]+$/.test(uidText) || uidText.length < 8 || uidText.length > 64 || uidText.length % 2 !== 0) {
    return { ok: false, reason: "sdk_sensor_uid_invalid" };
  }

  const data = record(input.data);
  if (!data || Object.keys(data).length !== 1 || !("sensors" in data)) {
    return { ok: false, reason: "sdk_sensor_data_shape_invalid" };
  }
  const sensors = record(data.sensors);
  if (!sensors || Object.keys(sensors).some((key) => !SENSOR_KEYS.has(key))) {
    return { ok: false, reason: "sdk_sensor_fields_unsupported" };
  }

  const normalized: Partial<SdkSensorReading> = {};
  if ("temperatureC" in sensors) {
    const temperatureC = boundedNumber(sensors.temperatureC, -100, 200);
    if (temperatureC === null) return { ok: false, reason: "sdk_sensor_temperature_invalid" };
    normalized.temperatureC = temperatureC;
  }
  if ("humidityPct" in sensors) {
    const humidityPct = boundedNumber(sensors.humidityPct, 0, 100);
    if (humidityPct === null) return { ok: false, reason: "sdk_sensor_humidity_invalid" };
    normalized.humidityPct = humidityPct;
  }
  if ("lightExposure" in sensors) {
    const lightExposure = measurementText(sensors.lightExposure, 10_000_000, "lux");
    if (!lightExposure) return { ok: false, reason: "sdk_sensor_light_invalid" };
    normalized.lightExposure = lightExposure;
  }
  if ("transitShock" in sensors) {
    const transitShock = measurementText(sensors.transitShock, 10_000, "g");
    if (!transitShock) return { ok: false, reason: "sdk_sensor_shock_invalid" };
    normalized.transitShock = transitShock;
  }

  if (
    normalized.temperatureC === undefined
    && normalized.humidityPct === undefined
    && normalized.lightExposure === undefined
    && normalized.transitShock === undefined
  ) {
    return { ok: false, reason: "sdk_sensor_measurement_required" };
  }

  let occurredAt: string | null = null;
  if (input.occurredAt !== undefined && input.occurredAt !== null && String(input.occurredAt).trim()) {
    occurredAt = isoInstant(input.occurredAt, nowMs);
    if (!occurredAt) return { ok: false, reason: "sdk_sensor_occurred_at_invalid" };
  }
  const measuredAt = isoInstant(sensors.measuredAt ?? occurredAt, nowMs);
  if (!measuredAt) return { ok: false, reason: "sdk_sensor_measured_at_required_or_invalid" };
  normalized.measuredAt = measuredAt;

  const nestedSource = boundedText(sensors.source, 80);
  const topLevelSource = boundedText(input.source, 80);
  if (sensors.source !== undefined && !nestedSource) return { ok: false, reason: "sdk_sensor_source_invalid" };
  if (input.source !== undefined && String(input.source).trim() && !topLevelSource) {
    return { ok: false, reason: "sdk_sensor_source_invalid" };
  }
  if (nestedSource && topLevelSource && nestedSource !== topLevelSource) {
    return { ok: false, reason: "sdk_sensor_source_conflict" };
  }
  normalized.source = nestedSource || topLevelSource || "tenant_sdk";

  for (const [key, maxLength] of [["deviceId", 120], ["stage", 80]] as const) {
    if (!(key in sensors)) continue;
    const value = boundedText(sensors[key], maxLength);
    if (!value) return { ok: false, reason: `sdk_sensor_${key === "deviceId" ? "device_id" : "stage"}_invalid` };
    normalized[key] = value;
  }

  return {
    ok: true,
    value: {
      bid,
      uidHex: uidText,
      occurredAt,
      source: SDK_SENSOR_EVENT_SOURCE,
      data: { sensors: normalized as SdkSensorReading },
    },
  };
}

function persistedInstant(value: unknown): string | null {
  const normalized = boundedText(value, 64);
  if (!normalized || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized)) return null;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function persistedNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? Math.round(parsed * 1_000) / 1_000
    : null;
}

/** Projects already-column-restricted SQL rows into the SUN sensor contract. */
export function projectSdkSensorTimelineRows(
  rows: Array<Record<string, unknown>>,
  nowMs = Date.now(),
): SdkSensorTimelineReading[] {
  const readings: SdkSensorTimelineReading[] = [];
  for (const row of rows) {
    const receivedAt = persistedInstant(row.received_at);
    const occurredAt = persistedInstant(row.occurred_at);
    const measuredAt = persistedInstant(row.measured_at);
    const source = boundedText(row.sensor_source, 80);
    if (!receivedAt || !measuredAt || Date.parse(measuredAt) > nowMs + 15 * 60_000 || !source) continue;

    const temperatureC = persistedNumber(row.temperature_c, -100, 200);
    const humidityPct = persistedNumber(row.humidity_pct, 0, 100);
    const lightExposure = boundedText(row.light_exposure, 80);
    const transitShock = boundedText(row.transit_shock, 80);
    if (temperatureC === null && humidityPct === null && !lightExposure && !transitShock) continue;

    readings.push({
      receivedAt,
      occurredAt,
      measuredAt,
      temperatureC,
      humidityPct,
      lightExposure,
      transitShock,
      deviceId: boundedText(row.device_id, 120),
      source,
      stage: boundedText(row.stage, 80),
    });
  }
  return readings;
}
