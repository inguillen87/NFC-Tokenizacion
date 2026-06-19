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
  | "ntag424_dna_tt";

const CARRIER_PROFILE_CODES = new Set<CarrierProfileCode>([
  "qr_basic",
  "gs1_digital_link",
  "ntag213",
  "ntag215",
  "ntag216",
  "ntag424_dna",
  "ntag424_dna_tt",
]);

function normalizeCarrierProfileCode(input: unknown): CarrierProfileCode | null {
  const value = String(input || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (!value) return null;
  if (CARRIER_PROFILE_CODES.has(value as CarrierProfileCode)) return value as CarrierProfileCode;
  if (value.includes("424") && value.includes("tt")) return "ntag424_dna_tt";
  if (value.includes("424")) return "ntag424_dna";
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

function numberColumn(row: Record<string, string>, names: string[]) {
  const value = getColumn(row, names);
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
  const columns = compactObject({
    measuredAt: getColumn(row, ["sensor_at", "telemetry_at", "measured_at", "captured_at"]),
    deviceId: getColumn(row, ["sensor_id", "iot_device_id", "logger_id", "device_id"]),
    temperatureC: numberColumn(row, ["temperature_c", "temp_c", "cellar_temperature_c", "storage_temperature_c"]),
    humidityPct: numberColumn(row, ["humidity_pct", "humidity", "relative_humidity_pct", "rh_pct"]),
    pressureHpa: numberColumn(row, ["pressure_hpa", "pressure"]),
    lightExposure: getColumn(row, ["light_exposure", "light", "lux"]),
    transitShock: getColumn(row, ["transit_shock", "shock", "shock_g", "impact_g"]),
    storageZone: getColumn(row, ["storage_zone", "cellar_zone", "warehouse_zone"]),
  });
  const merged = compactObject({ ...(parsed.value || {}), ...columns });
  return { value: Object.keys(merged).length ? merged : null, error: null };
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
  const uidRe = /^[0-9A-F]{8,32}$/;

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
      carrierProfileCode,
      sunPayload,
      sunPayloadHashes,
      raw: row,
    });
  });

  return { contentHash, manifestType, rows, duplicateUids, rejectedRows };
}
