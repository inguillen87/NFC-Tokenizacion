import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import {
  buildSunPayloadHashes,
  isCompleteSunPayload,
  parseSunPayloadFromManifestRow,
  type SunPayloadHashes,
  type SunPayloadParts,
} from "./sun-payload.ts";

export type CarrierProfileCode =
  | "qr_basic"
  | "gs1_digital_link"
  | "ntag213"
  | "ntag215"
  | "ntag216"
  | "ntag424_dna"
  | "ntag424_dna_tt"
  | "uhf_rfid"
  | "event_wristband"
  | "hotel_keycard"
  | "iot_tracker_placeholder";

const CARRIER_PROFILE_CODES = new Set<CarrierProfileCode>([
  "qr_basic",
  "gs1_digital_link",
  "ntag213",
  "ntag215",
  "ntag216",
  "ntag424_dna",
  "ntag424_dna_tt",
  "uhf_rfid",
  "event_wristband",
  "hotel_keycard",
  "iot_tracker_placeholder",
]);

function normalizeCarrierProfileCode(input: unknown): CarrierProfileCode | null {
  const value = String(input || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (!value) return null;
  if (CARRIER_PROFILE_CODES.has(value as CarrierProfileCode)) return value as CarrierProfileCode;
  if (value.includes("424") && value.includes("tt")) return "ntag424_dna_tt";
  if (value.includes("424")) return "ntag424_dna";
  if (value.includes("uhf") || value.includes("rfid") || value.includes("epc")) return "uhf_rfid";
  if (value.includes("wristband") || value.includes("pulsera") || value.includes("bracelet") || value.includes("festival")) return "event_wristband";
  if (value.includes("hotel") || value.includes("keycard") || value.includes("credential") || value.includes("credencial")) return "hotel_keycard";
  if (value.includes("iot") || value.includes("tracker") || value.includes("sensor") || value.includes("logger")) return "iot_tracker_placeholder";
  if (value.includes("216")) return "ntag216";
  if (value.includes("215")) return "ntag215";
  if (value.includes("213")) return "ntag213";
  if (value.includes("gs1")) return "gs1_digital_link";
  if (value === "qr" || value.includes("qr_basic")) return "qr_basic";
  return null;
}

export type ParsedManifestRow = {
  uidHex: string;
  batchId: string | null;
  productName: string | null;
  sku: string | null;
  lot: string | null;
  serial: string | null;
  expiresAt: string | null;
  imageUrl: string | null;
  labelImageUrl: string | null;
  modelUrl: string | null;
  galleryUrls: string[];
  unitMetadata: Record<string, string>;
  iotData: Record<string, unknown> | null;
  engagementData: { promotions: Array<{ title: string; description: string | null; points: number | null; state: "published" | "draft" | "disabled"; public: boolean }> } | null;
  carrierProfileCode: CarrierProfileCode | null;
  sunPayload: SunPayloadParts | null;
  sunPayloadHashes: SunPayloadHashes | null;
  raw: Record<string, string>;
};

export type ManifestParseResult = {
  contentHash: string;
  manifestType: "csv" | "txt";
  rows: ParsedManifestRow[];
  duplicateUids: string[];
  rejectedRows: Array<{ row: number; reason: string; value?: string }>;
};

function normalizeUid(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function getColumn(row: Record<string, string>, names: string[]) {
  const lowered = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), String(value || "").trim()]));
  for (const name of names) {
    const value = lowered.get(name.toLowerCase());
    if (value) return value;
  }
  return "";
}

function boundedNumberColumn(
  row: Record<string, string>,
  names: string[],
  min: number,
  max: number,
  reason: string,
) {
  const value = getColumn(row, names);
  if (!value) return { value: null as number | null, error: null as string | null };
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? { value: Math.round(parsed * 1_000) / 1_000, error: null }
    : { value: null, error: reason };
}

function boundedTextColumn(row: Record<string, string>, names: string[], maxLength: number, reason: string) {
  const value = getColumn(row, names);
  if (!value) return { value: null as string | null, error: null as string | null };
  return value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value)
    ? { value, error: null }
    : { value: null, error: reason };
}

function parseObjectColumn(row: Record<string, string>, names: string[]) {
  const raw = getColumn(row, names);
  if (!raw) return { value: null as Record<string, unknown> | null, error: null as string | null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { value: parsed as Record<string, unknown>, error: null };
    }
    return { value: null, error: "json_object_required" };
  } catch {
    return { value: null, error: "invalid_json" };
  }
}

const IOT_JSON_ALLOWED_KEYS = new Set([
  "measuredAt", "measured_at", "capturedAt", "captured_at", "sensor_at",
  "deviceId", "device_id", "sensorId", "sensor_id", "loggerId", "logger_id",
  "source", "provider",
  "temperatureC", "temperature_c", "cellarTemperatureC", "storageTemperatureC",
  "humidityPct", "humidity_pct", "humidity", "relativeHumidityPct",
  "pressureHpa", "pressure_hpa", "pressure",
  "lightExposure", "light_exposure", "light", "lux",
  "transitShock", "transit_shock", "shock", "shock_g", "impact_g",
  "stage", "storageZone", "storage_zone", "cellar_zone", "warehouse_zone",
]);

const IOT_TIMESTAMP_KEYS = new Set(["measuredAt", "measured_at", "capturedAt", "captured_at", "sensor_at"]);
const IOT_DEVICE_KEYS = new Set(["deviceId", "device_id", "sensorId", "sensor_id", "loggerId", "logger_id"]);
const IOT_SOURCE_KEYS = new Set(["source", "provider"]);
const IOT_TEMPERATURE_KEYS = new Set(["temperatureC", "temperature_c", "cellarTemperatureC", "storageTemperatureC"]);
const IOT_HUMIDITY_KEYS = new Set(["humidityPct", "humidity_pct", "humidity", "relativeHumidityPct"]);
const IOT_PRESSURE_KEYS = new Set(["pressureHpa", "pressure_hpa", "pressure"]);
const IOT_LIGHT_KEYS = new Set(["lightExposure", "light_exposure", "light", "lux"]);
const IOT_SHOCK_KEYS = new Set(["transitShock", "transit_shock", "shock", "shock_g", "impact_g"]);
const IOT_STAGE_KEYS = new Set(["stage", "storageZone", "storage_zone", "cellar_zone", "warehouse_zone"]);

function normalizedSensorNumber(value: unknown, min: number, max: number) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = typeof value === "number" ? value : Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? Math.round(parsed * 1_000) / 1_000
    : null;
}

function normalizedSensorText(value: unknown, maxLength: number) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized && normalized.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(normalized)
    ? normalized
    : null;
}

function normalizedSensorInstant(value: unknown) {
  const normalized = normalizedSensorText(value, 64);
  if (!normalized || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized)) return null;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function sanitizeIotJsonObject(value: Record<string, unknown> | null) {
  if (!value) return { value: null as Record<string, unknown> | null, error: null as string | null };
  const entries = Object.entries(value);
  if (entries.length > IOT_JSON_ALLOWED_KEYS.size) {
    return { value: null, error: "iot_field_limit_exceeded" };
  }
  const output: Record<string, unknown> = {};
  for (const [key, child] of entries) {
    if (!IOT_JSON_ALLOWED_KEYS.has(key)) return { value: null, error: "unsupported_iot_field" };
    if (child === null) continue;
    let canonicalKey: string;
    let normalized: string | number | null;
    if (IOT_TIMESTAMP_KEYS.has(key)) {
      canonicalKey = "measuredAt";
      normalized = normalizedSensorInstant(child);
    } else if (IOT_DEVICE_KEYS.has(key)) {
      canonicalKey = "deviceId";
      normalized = normalizedSensorText(child, 120);
    } else if (IOT_SOURCE_KEYS.has(key)) {
      canonicalKey = "source";
      normalized = normalizedSensorText(child, 80);
    } else if (IOT_TEMPERATURE_KEYS.has(key)) {
      canonicalKey = "temperatureC";
      normalized = normalizedSensorNumber(child, -100, 200);
    } else if (IOT_HUMIDITY_KEYS.has(key)) {
      canonicalKey = "humidityPct";
      normalized = normalizedSensorNumber(child, 0, 100);
    } else if (IOT_PRESSURE_KEYS.has(key)) {
      canonicalKey = "pressureHpa";
      normalized = normalizedSensorNumber(child, 0, 2_000);
    } else if (IOT_LIGHT_KEYS.has(key)) {
      canonicalKey = "lightExposure";
      normalized = typeof child === "number"
        ? normalizedSensorNumber(child, 0, 10_000_000)
        : normalizedSensorText(child, 80);
    } else if (IOT_SHOCK_KEYS.has(key)) {
      canonicalKey = "transitShock";
      normalized = typeof child === "number"
        ? normalizedSensorNumber(child, 0, 10_000)
        : normalizedSensorText(child, 80);
    } else if (IOT_STAGE_KEYS.has(key)) {
      canonicalKey = "stage";
      normalized = normalizedSensorText(child, 80);
    } else {
      return { value: null, error: "unsupported_iot_field" };
    }
    if (normalized === null) return { value: null, error: `invalid_iot_${canonicalKey}` };
    if (canonicalKey in output && output[canonicalKey] !== normalized) {
      return { value: null, error: `conflicting_iot_${canonicalKey}` };
    }
    output[canonicalKey] = normalized;
  }
  return { value: output, error: null };
}

function compactObject<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value == null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value).length > 0;
      return true;
    }),
  );
}

function collectUnitMetadata(row: Record<string, string>) {
  const metadata = compactObject({
    external_unit_id: getColumn(row, ["external_unit_id", "external_id", "unit_id", "piece_id"]),
    bottle_number: getColumn(row, ["bottle_number", "bottle_no", "numero_botella", "nro_botella"]),
    label_number: getColumn(row, ["label_number", "etiqueta_numero", "label_no"]),
    case_id: getColumn(row, ["case_id", "case", "box_id", "carton_id", "caja"]),
    pallet_id: getColumn(row, ["pallet_id", "pallet", "pallet_number"]),
    roll_id: getColumn(row, ["roll_id", "reel_id", "roll", "reel"]),
    supplier_lot: getColumn(row, ["supplier_lot", "supplier_batch", "supplier_batch_id"]),
    production_line: getColumn(row, ["production_line", "linea", "line"]),
    encoding_station: getColumn(row, ["encoding_station", "encoder", "station"]),
  });
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)]));
}

function collectIotData(row: Record<string, string>) {
  const parsed = parseObjectColumn(row, ["sensor_json", "iot_json", "telemetry_json", "sensor_data", "sensors", "iot"]);
  if (parsed.error) return { value: null, error: parsed.error };
  const sanitized = sanitizeIotJsonObject(parsed.value);
  if (sanitized.error) return { value: null, error: sanitized.error };
  const measuredAt = boundedTextColumn(row, ["sensor_at", "telemetry_at", "measured_at", "captured_at"], 64, "invalid_iot_measuredAt");
  if (measuredAt.error || (measuredAt.value && !normalizedSensorInstant(measuredAt.value))) {
    return { value: null, error: measuredAt.error || "invalid_iot_measuredAt" };
  }
  const deviceId = boundedTextColumn(row, ["sensor_id", "iot_device_id", "logger_id", "device_id"], 120, "invalid_iot_deviceId");
  const temperatureC = boundedNumberColumn(row, ["temperature_c", "temp_c", "cellar_temperature_c", "storage_temperature_c"], -100, 200, "invalid_iot_temperatureC");
  const humidityPct = boundedNumberColumn(row, ["humidity_pct", "humidity", "relative_humidity_pct", "rh_pct"], 0, 100, "invalid_iot_humidityPct");
  const pressureHpa = boundedNumberColumn(row, ["pressure_hpa", "pressure"], 0, 2_000, "invalid_iot_pressureHpa");
  const lightExposure = boundedTextColumn(row, ["light_exposure", "light", "lux"], 80, "invalid_iot_lightExposure");
  const transitShock = boundedTextColumn(row, ["transit_shock", "shock", "shock_g", "impact_g"], 80, "invalid_iot_transitShock");
  const stage = boundedTextColumn(row, ["storage_zone", "cellar_zone", "warehouse_zone"], 80, "invalid_iot_stage");
  const invalidColumn = [deviceId, temperatureC, humidityPct, pressureHpa, lightExposure, transitShock, stage]
    .find((entry) => entry.error);
  if (invalidColumn?.error) return { value: null, error: invalidColumn.error };
  const columns = compactObject({
    measuredAt: measuredAt.value ? normalizedSensorInstant(measuredAt.value) : null,
    deviceId: deviceId.value,
    temperatureC: temperatureC.value,
    humidityPct: humidityPct.value,
    pressureHpa: pressureHpa.value,
    lightExposure: lightExposure.value,
    transitShock: transitShock.value,
    stage: stage.value,
  });
  for (const [key, value] of Object.entries(columns)) {
    if (sanitized.value && key in sanitized.value && sanitized.value[key] !== value) {
      return { value: null, error: `conflicting_iot_${key}` };
    }
  }
  const merged = compactObject({ ...(sanitized.value || {}), ...columns });
  return {
    value: Object.keys(merged).length
      ? { ...merged, evidenceKind: "declared_static" }
      : null,
    error: null,
  };
}

const PROMOTION_JSON_ALLOWED_KEYS = new Set(["title", "description", "points", "state", "public"]);
const PROMOTION_STATE_ALIASES = new Map<string, "published" | "draft" | "disabled">([
  ["published", "published"],
  ["publicada", "published"],
  ["active", "published"],
  ["activa", "published"],
  ["draft", "draft"],
  ["borrador", "draft"],
  ["disabled", "disabled"],
  ["inactive", "disabled"],
  ["inactiva", "disabled"],
  ["deshabilitada", "disabled"],
]);

function boundedPromotionText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized && normalized.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(normalized)
    ? normalized
    : null;
}

function promotionPublicFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || !String(value).trim()) return false;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "si", "sí"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
}

function collectEngagementData(row: Record<string, string>) {
  const parsed = parseObjectColumn(row, ["promotion_json", "engagement_json", "promotion"]);
  if (parsed.error) return { value: null, error: parsed.error };
  if (parsed.value && Object.keys(parsed.value).some((key) => !PROMOTION_JSON_ALLOWED_KEYS.has(key))) {
    return { value: null, error: "unsupported_promotion_field" };
  }
  const source = parsed.value || {};
  if (Object.values(source).some((value) => value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")) {
    return { value: null, error: "promotion_scalar_value_required" };
  }

  const titleRaw = getColumn(row, ["promotion_title", "offer_title", "benefit_title"]) || source.title;
  const descriptionRaw = getColumn(row, ["promotion_description", "offer_description", "benefit_description"]) || source.description;
  const stateRaw = getColumn(row, ["promotion_state", "offer_state"]) || source.state;
  const publicRaw = getColumn(row, ["promotion_public", "offer_public", "promotion_visible"]) || source.public;
  const pointsRaw = getColumn(row, ["promotion_points", "offer_points", "benefit_points"]) || source.points;
  const hasPromotionInput = Object.keys(source).length > 0
    || [titleRaw, descriptionRaw, stateRaw, publicRaw, pointsRaw].some((value) => value !== null && value !== undefined && String(value).trim());
  if (!hasPromotionInput) return { value: null, error: null };

  const title = boundedPromotionText(titleRaw, 120);
  if (!title) return { value: null, error: "promotion_title_required_or_invalid" };
  const description = descriptionRaw === null || descriptionRaw === undefined || !String(descriptionRaw).trim()
    ? null
    : boundedPromotionText(descriptionRaw, 320);
  const stateInput = stateRaw === null || stateRaw === undefined || !String(stateRaw).trim()
    ? "draft"
    : boundedPromotionText(stateRaw, 48)?.toLowerCase() || null;
  const state = stateInput ? PROMOTION_STATE_ALIASES.get(stateInput) || null : null;
  const publiclyVisible = promotionPublicFlag(publicRaw);
  if (descriptionRaw && !description) return { value: null, error: "promotion_description_invalid" };
  if (!state) return { value: null, error: "promotion_state_invalid" };
  if (publiclyVisible === null) return { value: null, error: "promotion_public_invalid" };

  let points: number | null = null;
  if (pointsRaw !== null && pointsRaw !== undefined && String(pointsRaw).trim()) {
    const parsedPoints = Number(String(pointsRaw).trim().replace(",", "."));
    if (!Number.isFinite(parsedPoints) || parsedPoints < 0 || parsedPoints > 1_000_000) {
      return { value: null, error: "promotion_points_invalid" };
    }
    points = Math.floor(parsedPoints);
  }
  return { value: { promotions: [{ title, description, points, state, public: publiclyVisible }] }, error: null };
}

function splitUrls(value: string) {
  return value
    .split(/[|,;\n]/)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
}

function parseCsv(content: string, delimiter: "," | ";") {
  return parse(content, {
    columns: true,
    bom: true,
    delimiter,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
}

function parseTxt(content: string) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const first = String(lines[0] || "").toLowerCase();
  const start = first === "uid" || first === "uid_hex" ? 1 : 0;
  return lines.slice(start).map((uid) => ({ uid_hex: uid }));
}

export function parseTagManifest(content: string, expectedBid: string): ManifestParseResult {
  const raw = String(content || "");
  const contentHash = `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
  const header = raw.split(/\r?\n/)[0] || "";
  const looksCsv = header.includes(",") || header.includes(";");
  let manifestType: "csv" | "txt" = "txt";
  let rawRows: Record<string, string>[] = [];

  if (looksCsv) {
    try {
      rawRows = parseCsv(raw, header.includes(";") ? ";" : ",");
      manifestType = "csv";
    } catch (error) {
      return {
        contentHash,
        manifestType: "csv",
        rows: [],
        duplicateUids: [],
        rejectedRows: [{ row: 0, reason: "invalid_csv", value: error instanceof Error ? error.message : "parse_failed" }],
      };
    }
  } else {
    rawRows = parseTxt(raw);
  }

  const rows: ParsedManifestRow[] = [];
  const duplicateUids: string[] = [];
  const rejectedRows: ManifestParseResult["rejectedRows"] = [];
  const seen = new Set<string>();
  const uidRe = /^(?:[0-9A-F]{2}){4,16}$/;

  rawRows.forEach((row, index) => {
    const uidHex = normalizeUid(getColumn(row, ["uid_hex", "uid", "uidHex", "UID"]));
    const batchId = getColumn(row, ["batch_id", "batchId", "bid"]) || null;
    if (!uidHex) {
      rejectedRows.push({ row: index + 1, reason: "uid_hex_required" });
      return;
    }
    if (!uidRe.test(uidHex)) {
      rejectedRows.push({ row: index + 1, reason: "invalid_uid_hex", value: uidHex });
      return;
    }
    if (batchId && batchId !== expectedBid) {
      rejectedRows.push({ row: index + 1, reason: "batch_id_mismatch", value: batchId });
      return;
    }
    if (seen.has(uidHex)) {
      duplicateUids.push(uidHex);
      rejectedRows.push({ row: index + 1, reason: "duplicate_uid_in_manifest", value: uidHex });
      return;
    }
    const carrierProfileInput = getColumn(row, [
      "carrier_profile_code",
      "carrier_profile",
      "carrier",
      "chip_model",
      "chip",
      "chip_type",
      "tag_type",
      "ic_type",
    ]);
    const carrierProfileCode = normalizeCarrierProfileCode(carrierProfileInput);
    if (carrierProfileInput && !carrierProfileCode) {
      rejectedRows.push({ row: index + 1, reason: "invalid_carrier_profile", value: carrierProfileInput });
      return;
    }
    const sunPayload = parseSunPayloadFromManifestRow(row, expectedBid);
    if (sunPayload && !isCompleteSunPayload(sunPayload)) {
      rejectedRows.push({ row: index + 1, reason: "invalid_sun_payload", value: JSON.stringify(sunPayload) });
      return;
    }
    if (sunPayload?.bid && sunPayload.bid !== expectedBid) {
      rejectedRows.push({ row: index + 1, reason: "batch_id_mismatch", value: sunPayload.bid });
      return;
    }
    const sunPayloadHashes = sunPayload
      ? buildSunPayloadHashes({
          bid: sunPayload.bid || expectedBid,
          piccDataHex: sunPayload.piccDataHex,
          encHex: sunPayload.encHex,
          cmacHex: sunPayload.cmacHex,
        })
      : null;
    const iot = collectIotData(row);
    if (iot.error) {
      rejectedRows.push({ row: index + 1, reason: "invalid_iot_json", value: iot.error });
      return;
    }
    const engagement = collectEngagementData(row);
    if (engagement.error) {
      rejectedRows.push({ row: index + 1, reason: "invalid_engagement_json", value: engagement.error });
      return;
    }
    seen.add(uidHex);
    rows.push({
      uidHex,
      batchId,
      productName: getColumn(row, ["product_name", "productName", "name"]) || null,
      sku: getColumn(row, ["sku", "SKU"]) || null,
      lot: getColumn(row, ["lot", "lote", "lot_id"]) || null,
      serial: getColumn(row, [
        "serial",
        "serial_number",
        "external_unit_id",
        "external_id",
        "bottle_number",
        "bottle_no",
        "label_number",
        "numero_botella",
        "nro_botella",
        "etiqueta_numero",
      ]) || null,
      expiresAt: getColumn(row, ["expires_at", "expiry", "expiration"]) || null,
      imageUrl: getColumn(row, ["image_url", "imageUrl", "photo_url", "photoUrl", "hero_image_url", "product_image_url"]) || null,
      labelImageUrl: getColumn(row, ["label_image_url", "labelImageUrl", "tag_image_url", "tagImageUrl", "packshot_url", "packshotUrl"]) || null,
      modelUrl: getColumn(row, ["model_url", "modelUrl", "glb_url", "glbUrl", "model3d_url", "model3dUrl"]) || null,
      galleryUrls: splitUrls(getColumn(row, ["gallery_urls", "galleryUrls", "media_urls", "mediaUrls", "gallery", "images"])),
      unitMetadata: collectUnitMetadata(row),
      iotData: iot.value,
      engagementData: engagement.value,
      carrierProfileCode,
      sunPayload,
      sunPayloadHashes,
      raw: row,
    });
  });

  return { contentHash, manifestType, rows, duplicateUids, rejectedRows };
}
