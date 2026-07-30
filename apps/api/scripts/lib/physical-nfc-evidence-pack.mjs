import { createHash } from "node:crypto";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

import sharp from "sharp";
import { z } from "zod";

export const PHYSICAL_NFC_EVIDENCE_PACK_SCHEMA = "nexid-physical-nfc-evidence-pack/v1";
export const SANITIZED_MANIFEST_SCHEMA = "nexid-sanitized-nfc-manifest/v1";
export const SANITIZED_SUN_RECEIPT_SCHEMA = "nexid-sanitized-sun-receipt/v1";

const SUPPORTED_CARRIER_PROFILES = new Set(["ntag424_dna", "ntag424_dna_tt"]);
const SUPPORTED_CEREMONY_SCOPES = new Set(["loose_tag_sample", "package_integration"]);
const SUPPORTED_OBSERVATIONS = new Set(["intact", "replay", "opened"]);
const MAX_MANIFEST_BYTES = 1_000_000;
const MAX_ARTIFACT_BYTES = 25_000_000;
const MAX_TOTAL_BYTES = 100_000_000;
const MAX_ARTIFACTS = 200;
const MAX_TREE_ENTRIES = 1_000;
const MAX_DIRECTORY_DEPTH = 8;
const MAX_JSON_DEPTH = 64;
const MAX_IMAGE_PIXELS = 25_000_000;
const MAX_IMAGE_DIMENSION = 12_000;
const MAX_CEREMONY_DURATION_MS = 24 * 60 * 60 * 1_000;
const CLOCK_SKEW_MS = 5 * 60 * 1_000;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/;
const SAMPLE_REF_RE = /^sample-[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const RAW_SUN_QUERY_RE = /(?:[?&]|\b)(?:picc[_-]?data|enc|cmac)=/i;
const PRIVATE_MATERIAL_RE = /-----BEGIN (?:ENCRYPTED |OPENSSH |EC |RSA |DSA )?PRIVATE KEY-----|postgres(?:ql)?:\/\/|mongodb(?:\+srv)?:\/\//i;
const TOKEN_MATERIAL_RE = /(?:authorization\s*[:=]\s*bearer\s+|\bbearer\s+)[A-Za-z0-9._~+\/-]{8,}|\bsk_(?:live|test|prod)_[A-Za-z0-9_-]{8,}|\bcfk_[A-Za-z0-9]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bAIza[0-9A-Za-z_-]{20,}/i;
const RAW_UID_TOKEN_RE = /(?:^|[^0-9a-f])04(?:[-:._\s]?[0-9a-f]{2}){6}(?:$|[^0-9a-f])/i;
const RAW_KEY_HEX_RE = /(?:^|[^0-9a-f])(?:[0-9a-f]{32}|[0-9a-f]{48}|[0-9a-f]{64})(?:$|[^0-9a-f])/i;
const FORBIDDEN_JSON_KEYS = new Set([
  "api_key",
  "authorization",
  "cmac",
  "cookie",
  "database_url",
  "enc",
  "k_file",
  "k_file_batch",
  "k_meta",
  "k_meta_batch",
  "kms_master_key",
  "password",
  "picc_data",
  "polygon_private_key",
  "private_key",
  "raw_query",
  "raw_sun_url",
  "raw_uid",
  "secret",
  "sun_url",
  "token",
  "uid",
  "uid_hex",
]);
const RESERVED_CLAIMS = new Set([
  "physical_ceremony_verified",
  "physical_tag_certification",
  "tagtamper_physical_certification",
  "production_lot_accepted",
  "managed_kms",
  "hsm_backed",
]);
const IMAGE_METADATA_FIELDS = [
  "exif",
  "icc",
  "iptc",
  "xmp",
  "tifftagPhotoshop",
  "comments",
];
const ALLOWED_PNG_CHUNKS = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "cHRM",
  "gAMA",
  "sRGB",
  "pHYs",
]);

const TimestampSchema = z.string();
const Sha256Schema = z.string().regex(SHA256_RE);
const RefSchema = z.string().regex(REF_RE);
const SampleRefSchema = z.string().regex(SAMPLE_REF_RE);
const JsonArtifactSchema = z.object({
  path: z.string().min(1),
  kind: z.enum(["sanitized_manifest", "server_sun_receipt"]),
  media_type: z.literal("application/json"),
  sha256: Sha256Schema,
}).strict();
const PhotoArtifactSchema = z.object({
  path: z.string().min(1),
  kind: z.literal("physical_photo"),
  media_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  metadata_sanitized: z.literal(true),
  sample_ref: SampleRefSchema,
  observation: z.enum(["intact", "opened"]),
  captured_at: TimestampSchema,
  sha256: Sha256Schema,
}).strict();
const ArtifactSchema = z.union([JsonArtifactSchema, PhotoArtifactSchema]);
const ObservationSchema = z.object({
  observation: z.enum(["intact", "replay", "opened"]),
  receipt_artifact: z.string().min(1),
  photo_artifact: z.string().min(1).optional(),
}).strict();
const SampleSchema = z.object({
  sample_ref: SampleRefSchema,
  uid_fingerprint: Sha256Schema,
  sacrificial: z.boolean(),
  observations: z.array(ObservationSchema).min(1),
}).strict();
const ClaimsSchema = z.object({
  physical_ceremony_verified: z.boolean(),
  physical_tag_certification: z.boolean(),
  tagtamper_physical_certification: z.boolean(),
  production_lot_accepted: z.boolean(),
  managed_kms: z.boolean(),
  hsm_backed: z.boolean(),
}).strict();
const PhysicalContextSchema = z.object({
  package_type: z.string().optional(),
  substrate: z.string().optional(),
  placement: z.string().optional(),
  application_method: z.string().optional(),
  filled_package: z.boolean().optional(),
  tagtamper_bridges_opening: z.boolean().optional(),
}).strict();
const EvidencePackSchema = z.object({
  schema_version: z.literal(PHYSICAL_NFC_EVIDENCE_PACK_SCHEMA),
  evidence_class: z.literal("sanitized_physical_review_candidate"),
  ceremony: z.object({
    ceremony_id: RefSchema,
    ceremony_scope: z.enum(["loose_tag_sample", "package_integration"]),
    performed_at: TimestampSchema,
    operator_ref: Sha256Schema,
    site_ref: Sha256Schema,
  }).strict(),
  scope: z.object({
    batch_ref: RefSchema,
    carrier_profile_code: z.enum(["ntag424_dna", "ntag424_dna_tt"]),
    expected_sample_count: z.number().int().min(1).max(60),
  }).strict(),
  physical_context: PhysicalContextSchema,
  artifacts: z.array(ArtifactSchema).min(1).max(MAX_ARTIFACTS),
  samples: z.array(SampleSchema).min(1).max(60),
  claims: ClaimsSchema,
}).strict();
const SanitizedManifestSchema = z.object({
  schema_version: z.literal(SANITIZED_MANIFEST_SCHEMA),
  batch_ref: RefSchema,
  entries: z.array(z.object({
    sample_ref: SampleRefSchema,
    uid_fingerprint: Sha256Schema,
  }).strict()).min(1).max(60),
}).strict();
const SunReceiptSchema = z.object({
  schema_version: z.literal(SANITIZED_SUN_RECEIPT_SCHEMA),
  sample_ref: SampleRefSchema,
  batch_ref: RefSchema,
  uid_fingerprint: Sha256Schema,
  observation: z.enum(["intact", "replay", "opened"]),
  verification_result: z.string().min(1),
  read_counter: z.number().int().min(0).max(0xffffff),
  captured_at: TimestampSchema,
  server_evidence_digest: Sha256Schema,
  canonical_event_ref: Sha256Schema,
  server_evidence_verified: z.boolean(),
  raw_sun_values_included: z.boolean(),
  physical_ceremony_verified: z.boolean(),
}).strict();

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedJsonKey(value) {
  return String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[.\s-]+/g, "_")
    .toLowerCase();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function issue(code, artifact = null) {
  return artifact ? { code, artifact } : { code };
}

function validTimestamp(value) {
  const normalized = normalizedText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?Z$/.exec(normalized);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year < 2000 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  const milliseconds = Number(fraction.padEnd(3, "0").slice(0, 3));
  const epoch = Date.UTC(year, month - 1, day, hour, minute, second, milliseconds);
  return Number.isFinite(epoch) ? { normalized, epoch } : null;
}

function safeArtifactPath(value) {
  const raw = normalizedText(value);
  if (!raw || raw.includes("\\") || path.posix.isAbsolute(raw)) return null;
  const normalized = path.posix.normalize(raw);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return null;
  if (normalized !== raw || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) return null;
  if (RAW_UID_TOKEN_RE.test(normalized) || recognizableSensitiveText(normalized)) return null;
  return normalized;
}

function recognizableSensitiveText(value) {
  const text = String(value ?? "");
  if (!text || SHA256_RE.test(text.trim())) return false;
  return RAW_SUN_QUERY_RE.test(text)
    || PRIVATE_MATERIAL_RE.test(text)
    || TOKEN_MATERIAL_RE.test(text)
    || RAW_UID_TOKEN_RE.test(text)
    || RAW_KEY_HEX_RE.test(text);
}

function scanJsonForSensitiveMaterial(value, errors, artifact, seen = new Set()) {
  if (typeof value === "string") {
    if (recognizableSensitiveText(value)) errors.push(issue("sensitive_material_detected", artifact));
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) scanJsonForSensitiveMaterial(item, errors, artifact, seen);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = normalizedJsonKey(key);
    if (FORBIDDEN_JSON_KEYS.has(normalizedKey)) errors.push(issue("forbidden_sensitive_field", artifact));
    scanJsonForSensitiveMaterial(nested, errors, artifact, seen);
  }
}

function scanReservedClaims(value, errors, artifact, allowedPaths, currentPath = [], seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      scanReservedClaims(value[index], errors, artifact, allowedPaths, [...currentPath, String(index)], seen);
    }
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = normalizedJsonKey(key);
    const nextPath = [...currentPath, normalizedKey];
    if (RESERVED_CLAIMS.has(normalizedKey) && !allowedPaths.has(nextPath.join("."))) {
      errors.push(issue(`reserved_overclaim_outside_contract:${normalizedKey}`, artifact));
    }
    scanReservedClaims(nested, errors, artifact, allowedPaths, nextPath, seen);
  }
}

function strictJsonError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function assertNoDuplicateJsonKeys(text) {
  let cursor = 0;
  const skipWhitespace = () => {
    while (cursor < text.length && /[\u0009\u000a\u000d\u0020]/.test(text[cursor])) cursor += 1;
  };
  const scanString = () => {
    const start = cursor;
    if (text[cursor] !== '"') throw strictJsonError("json_syntax_invalid");
    cursor += 1;
    while (cursor < text.length) {
      const code = text.charCodeAt(cursor);
      if (code === 0x22) {
        cursor += 1;
        return JSON.parse(text.slice(start, cursor));
      }
      if (code < 0x20) throw strictJsonError("json_syntax_invalid");
      if (code === 0x5c) {
        cursor += 1;
        const escape = text[cursor];
        if (!escape || !'"\\/bfnrtu'.includes(escape)) throw strictJsonError("json_syntax_invalid");
        if (escape === "u") {
          const hex = text.slice(cursor + 1, cursor + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw strictJsonError("json_syntax_invalid");
          cursor += 4;
        }
      }
      cursor += 1;
    }
    throw strictJsonError("json_syntax_invalid");
  };
  const scanValue = (depth) => {
    if (depth > MAX_JSON_DEPTH) throw strictJsonError("json_depth_limit_exceeded");
    skipWhitespace();
    const current = text[cursor];
    if (current === "{") {
      cursor += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[cursor] === "}") {
        cursor += 1;
        return;
      }
      while (cursor < text.length) {
        const key = scanString();
        if (keys.has(key)) throw strictJsonError("json_duplicate_key");
        keys.add(key);
        skipWhitespace();
        if (text[cursor] !== ":") throw strictJsonError("json_syntax_invalid");
        cursor += 1;
        scanValue(depth + 1);
        skipWhitespace();
        if (text[cursor] === "}") {
          cursor += 1;
          return;
        }
        if (text[cursor] !== ",") throw strictJsonError("json_syntax_invalid");
        cursor += 1;
        skipWhitespace();
      }
      throw strictJsonError("json_syntax_invalid");
    }
    if (current === "[") {
      cursor += 1;
      skipWhitespace();
      if (text[cursor] === "]") {
        cursor += 1;
        return;
      }
      while (cursor < text.length) {
        scanValue(depth + 1);
        skipWhitespace();
        if (text[cursor] === "]") {
          cursor += 1;
          return;
        }
        if (text[cursor] !== ",") throw strictJsonError("json_syntax_invalid");
        cursor += 1;
      }
      throw strictJsonError("json_syntax_invalid");
    }
    if (current === '"') {
      scanString();
      return;
    }
    const remainder = text.slice(cursor);
    const primitive = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(remainder)?.[0];
    if (!primitive) throw strictJsonError("json_syntax_invalid");
    cursor += primitive.length;
  };

  skipWhitespace();
  scanValue(0);
  skipWhitespace();
  if (cursor !== text.length) throw strictJsonError("json_syntax_invalid");
}

function parseStrictJson(bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw strictJsonError("json_utf8_invalid");
  }
  if (text.charCodeAt(0) === 0xfeff) throw strictJsonError("json_bom_rejected");
  assertNoDuplicateJsonKeys(text);
  try {
    return JSON.parse(text);
  } catch {
    throw strictJsonError("json_syntax_invalid");
  }
}

function isWithinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameSnapshot(left, right) {
  return sameIdentity(left, right)
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

async function walkPack(root, current = root, state = null, depth = 0) {
  const target = state || {
    files: [],
    errors: [],
    entries: 0,
    totalBytes: 0,
    halted: false,
  };
  if (target.halted) return target;
  if (depth > MAX_DIRECTORY_DEPTH) {
    target.errors.push(issue("evidence_pack_directory_depth_exceeded"));
    target.halted = true;
    return target;
  }
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (target.halted) break;
    target.entries += 1;
    if (target.entries > MAX_TREE_ENTRIES) {
      target.errors.push(issue("evidence_pack_tree_entry_limit_exceeded"));
      target.halted = true;
      break;
    }
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    const metadata = await lstat(absolute, { bigint: true });
    if (metadata.isSymbolicLink()) {
      target.errors.push(issue("symbolic_link_rejected", relative));
      continue;
    }
    const resolved = await realpath(absolute);
    if (!isWithinRoot(root, resolved)) {
      target.errors.push(issue("artifact_realpath_outside_pack_rejected", relative));
      continue;
    }
    if (metadata.isDirectory()) {
      await walkPack(root, absolute, target, depth + 1);
      continue;
    }
    if (!metadata.isFile()) {
      target.errors.push(issue("non_regular_artifact_rejected", relative));
      continue;
    }
    if (recognizableSensitiveText(relative)) target.errors.push(issue("sensitive_artifact_path_rejected", relative));
    const fileSize = metadata.size > BigInt(MAX_TOTAL_BYTES) ? MAX_TOTAL_BYTES + 1 : Number(metadata.size);
    target.totalBytes += fileSize;
    target.files.push({ absolute, relative, size: fileSize, snapshot: metadata });
    if (target.files.length > MAX_ARTIFACTS + 1) {
      target.errors.push(issue("evidence_pack_file_limit_exceeded"));
      target.halted = true;
    } else if (target.totalBytes > MAX_TOTAL_BYTES) {
      target.errors.push(issue("evidence_pack_size_limit_exceeded"));
      target.halted = true;
    }
  }
  return target;
}

async function readStableFile(root, file, maximumBytes) {
  let handle;
  try {
    const before = await lstat(file.absolute, { bigint: true });
    if (before.isSymbolicLink() || !before.isFile() || !sameSnapshot(before, file.snapshot)) {
      throw new Error("snapshot_changed_before_open");
    }
    const beforeRealpath = await realpath(file.absolute);
    if (!isWithinRoot(root, beforeRealpath)) throw new Error("realpath_outside_pack");
    handle = await open(file.absolute, "r");
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameSnapshot(opened, before) || opened.size <= 0n || opened.size > BigInt(maximumBytes)) {
      throw new Error("opened_file_snapshot_invalid");
    }
    const bytes = await handle.readFile();
    const afterHandle = await handle.stat({ bigint: true });
    const afterPath = await lstat(file.absolute, { bigint: true });
    const afterRealpath = await realpath(file.absolute);
    if (!sameSnapshot(opened, afterHandle)
      || afterPath.isSymbolicLink()
      || !afterPath.isFile()
      || !sameSnapshot(opened, afterPath)
      || !isWithinRoot(root, afterRealpath)
      || bytes.length !== Number(opened.size)) {
      throw new Error("snapshot_changed_during_read");
    }
    return bytes;
  } finally {
    await handle?.close();
  }
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngStructureIsSanitized(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 20 || !buffer.subarray(0, 8).equals(signature)) return false;
  let offset = 8;
  let first = true;
  let sawData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) return false;
    const typeBytes = buffer.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type) || !ALLOWED_PNG_CHUNKS.has(type)) return false;
    if (first && type !== "IHDR") return false;
    if (buffer.readUInt32BE(offset + 8 + length) !== crc32(buffer.subarray(offset + 4, offset + 8 + length))) return false;
    if (type === "IDAT") sawData = true;
    offset = end;
    first = false;
    if (type === "IEND") return sawData && offset === buffer.length;
  }
  return false;
}

function jpegStructureIsSanitized(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  let offset = 2;
  let sawScan = false;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return false;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) return false;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0x00 || marker === 0xd8) return false;
    if (marker === 0xd9) return sawScan && offset === buffer.length;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) return false;
    if (offset + 2 > buffer.length) return false;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return false;
    const payload = buffer.subarray(offset + 2, offset + length);
    if (marker === 0xfe || (marker >= 0xe1 && marker <= 0xef)) return false;
    if (marker === 0xe0 && !(payload.length === 14 && payload.subarray(0, 5).toString("latin1") === "JFIF\u0000")) return false;
    offset += length;
    if (marker !== 0xda) continue;

    sawScan = true;
    let nextMarkerFound = false;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const markerPrefix = offset;
      offset += 1;
      while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
      if (offset >= buffer.length) return false;
      const scanMarker = buffer[offset];
      if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) {
        offset += 1;
        continue;
      }
      offset = markerPrefix;
      nextMarkerFound = true;
      break;
    }
    if (!nextMarkerFound) return false;
  }
  return false;
}

function webpStructureIsSanitized(buffer) {
  if (buffer.length < 20
    || buffer.subarray(0, 4).toString("ascii") !== "RIFF"
    || buffer.subarray(8, 12).toString("ascii") !== "WEBP"
    || buffer.readUInt32LE(4) + 8 !== buffer.length) return false;
  const allowed = new Set(["VP8 ", "VP8L", "VP8X", "ALPH"]);
  let offset = 12;
  let imageChunks = 0;
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    const length = buffer.readUInt32LE(offset + 4);
    const padded = length + (length % 2);
    if (!allowed.has(type) || offset + 8 + padded > buffer.length) return false;
    if (type === "VP8 " || type === "VP8L") imageChunks += 1;
    offset += 8 + padded;
  }
  return offset === buffer.length && imageChunks === 1;
}

function metadataValuePresent(value) {
  if (value == null) return false;
  if (Buffer.isBuffer(value) || Array.isArray(value) || typeof value === "string") return value.length > 0;
  return true;
}

async function imageIsSanitizedAndDecodable(buffer, mediaType) {
  if (recognizableSensitiveText(buffer.toString("latin1"))) return false;
  if (mediaType === "image/png" && !pngStructureIsSanitized(buffer)) return false;
  if (mediaType === "image/jpeg" && !jpegStructureIsSanitized(buffer)) return false;
  if (mediaType === "image/webp" && !webpStructureIsSanitized(buffer)) return false;
  const expectedFormat = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" }[mediaType];
  try {
    const decoder = sharp(buffer, {
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    });
    const metadata = await decoder.metadata();
    if (metadata.format !== expectedFormat
      || !Number.isSafeInteger(metadata.width)
      || !Number.isSafeInteger(metadata.height)
      || metadata.width < 1
      || metadata.height < 1
      || metadata.width > MAX_IMAGE_DIMENSION
      || metadata.height > MAX_IMAGE_DIMENSION
      || metadata.width * metadata.height > MAX_IMAGE_PIXELS
      || (metadata.pages != null && metadata.pages !== 1)
      || IMAGE_METADATA_FIELDS.some((field) => metadataValuePresent(metadata[field]))) return false;
    const decoded = await decoder.clone().raw().toBuffer({ resolveWithObject: true });
    return decoded.info.width === metadata.width
      && decoded.info.height === metadata.height
      && decoded.data.length > 0;
  } catch {
    return false;
  }
}

function validateReceipt(receipt, expected, errors, artifact) {
  const raw = record(receipt);
  if (raw.sample_ref !== expected.sampleRef) errors.push(issue("sun_receipt_sample_mismatch", artifact));
  if (raw.batch_ref !== expected.batchRef) errors.push(issue("sun_receipt_batch_mismatch", artifact));
  if (raw.uid_fingerprint !== expected.uidFingerprint) errors.push(issue("sun_receipt_uid_fingerprint_mismatch", artifact));
  if (raw.observation !== expected.observation) errors.push(issue("sun_receipt_observation_mismatch", artifact));
  if (raw.server_evidence_verified !== true) errors.push(issue("sun_receipt_server_evidence_required", artifact));
  if (raw.raw_sun_values_included !== false) errors.push(issue("sun_receipt_raw_values_must_be_absent", artifact));
  if (raw.physical_ceremony_verified !== false) errors.push(issue("sun_receipt_physical_overclaim_rejected", artifact));
  const counter = raw.read_counter;
  const capturedAt = validTimestamp(raw.captured_at);
  if (!capturedAt) errors.push(issue("sun_receipt_timestamp_invalid", artifact));
  const allowedResults = {
    intact: expected.tagTamper ? new Set(["valid_closed"]) : new Set(["valid"]),
    replay: new Set(["replay_suspect"]),
    opened: expected.tagTamper ? new Set(["opened", "valid_opened"]) : new Set(),
  }[expected.observation];
  if (!allowedResults?.has(normalizedText(raw.verification_result).toLowerCase())) {
    errors.push(issue("sun_receipt_result_invalid", artifact));
  }
  return { counter, capturedAt };
}

function requiredFalseClaims(manifest, errors) {
  const claims = record(manifest.claims);
  for (const name of RESERVED_CLAIMS) {
    if (claims[name] !== false) errors.push(issue(`claim_must_be_false:${name}`));
  }
}

function timestampWithinCeremony(timestamp, performedAt, nowEpoch, errors, code, artifact) {
  if (!timestamp || !performedAt) return;
  if (timestamp.epoch < performedAt.epoch - MAX_CEREMONY_DURATION_MS
    || timestamp.epoch > performedAt.epoch + CLOCK_SKEW_MS) {
    errors.push(issue(code, artifact));
  }
  if (timestamp.epoch > nowEpoch + CLOCK_SKEW_MS) errors.push(issue("evidence_timestamp_in_future", artifact));
}

function resultEnvelope({ errors, warnings, manifest, artifactCount, totalBytes, evidencePackDigest }) {
  const ok = errors.length === 0;
  const scope = record(manifest?.ceremony).ceremony_scope;
  return {
    ok,
    schema_version: PHYSICAL_NFC_EVIDENCE_PACK_SCHEMA,
    evidence_class: "sanitized_physical_review_candidate",
    evidence_pack_digest: evidencePackDigest || null,
    review_status: ok ? "eligible_for_manual_review" : "blocked",
    artifact_integrity_verified: ok,
    sun_receipt_contract_verified: ok,
    packaging_integration_evidence_present: ok && scope === "package_integration",
    manual_identity_and_custody_review_required: true,
    physical_ceremony_verified: false,
    physical_tag_certification: false,
    tagtamper_physical_certification: false,
    production_lot_accepted: false,
    managed_kms: false,
    hsm_backed: false,
    counts: { artifacts: artifactCount, bytes: totalBytes },
    errors,
    warnings,
  };
}

export async function validatePhysicalNfcEvidencePack(packDirectory, options = {}) {
  const errors = [];
  const warnings = [
    issue("manual_physical_review_required"),
    issue("server_receipt_authorship_not_independently_verified"),
    issue("image_steganography_and_visible_text_not_machine_verified"),
  ];
  const nowEpoch = options.now == null
    ? Date.now()
    : options.now instanceof Date ? options.now.getTime() : Number(options.now);
  if (!Number.isFinite(nowEpoch)) {
    return resultEnvelope({ errors: [issue("validation_clock_invalid")], warnings, manifest: null, artifactCount: 0, totalBytes: 0 });
  }
  let root;
  try {
    const requestedRoot = path.resolve(packDirectory);
    const requestedMetadata = await lstat(requestedRoot, { bigint: true });
    if (requestedMetadata.isSymbolicLink()) throw new Error("root_symbolic_link_rejected");
    root = await realpath(requestedRoot);
    if (!(await lstat(root, { bigint: true })).isDirectory()) throw new Error("not_directory");
  } catch {
    return resultEnvelope({ errors: [issue("evidence_pack_directory_invalid")], warnings, manifest: null, artifactCount: 0, totalBytes: 0 });
  }

  let walked;
  try {
    walked = await walkPack(root);
  } catch {
    return resultEnvelope({ errors: [issue("evidence_pack_tree_read_failed")], warnings, manifest: null, artifactCount: 0, totalBytes: 0 });
  }
  errors.push(...walked.errors);
  const totalBytes = walked.totalBytes;
  const manifestFile = walked.files.find((file) => file.relative === "evidence-pack.json");
  if (!manifestFile || manifestFile.size > MAX_MANIFEST_BYTES) {
    errors.push(issue(manifestFile ? "evidence_pack_manifest_too_large" : "evidence_pack_manifest_missing"));
    return resultEnvelope({ errors, warnings, manifest: null, artifactCount: 0, totalBytes });
  }

  let manifest;
  let manifestBytes;
  try {
    manifestBytes = await readStableFile(root, manifestFile, MAX_MANIFEST_BYTES);
    manifest = parseStrictJson(manifestBytes);
  } catch (error) {
    const code = error?.code === "json_duplicate_key"
      ? "evidence_pack_manifest_duplicate_key"
      : error?.code === "json_depth_limit_exceeded"
        ? "evidence_pack_manifest_depth_exceeded"
        : "evidence_pack_manifest_invalid_or_changed";
    errors.push(issue(code));
    return resultEnvelope({ errors, warnings, manifest: null, artifactCount: 0, totalBytes });
  }
  scanJsonForSensitiveMaterial(manifest, errors, "evidence-pack.json");
  scanReservedClaims(
    manifest,
    errors,
    "evidence-pack.json",
    new Set([...RESERVED_CLAIMS].map((name) => `claims.${name}`)),
  );
  requiredFalseClaims(manifest, errors);
  const manifestContract = EvidencePackSchema.safeParse(manifest);
  if (!manifestContract.success) {
    errors.push(issue("evidence_pack_closed_schema_invalid"));
    return resultEnvelope({ errors, warnings, manifest, artifactCount: 0, totalBytes });
  }
  manifest = manifestContract.data;

  const ceremony = manifest.ceremony;
  const scope = manifest.scope;
  const physicalContext = manifest.physical_context;
  const ceremonyScope = ceremony.ceremony_scope;
  const carrierProfile = scope.carrier_profile_code;
  const expectedSampleCount = scope.expected_sample_count;
  const performedAt = validTimestamp(ceremony.performed_at);
  if (!SUPPORTED_CEREMONY_SCOPES.has(ceremonyScope)) errors.push(issue("ceremony_scope_invalid"));
  if (!SUPPORTED_CARRIER_PROFILES.has(carrierProfile)) errors.push(issue("carrier_profile_unsupported"));
  if (!performedAt) {
    errors.push(issue("ceremony_timestamp_invalid"));
  } else if (performedAt.epoch > nowEpoch + CLOCK_SKEW_MS) {
    errors.push(issue("ceremony_timestamp_in_future"));
  }
  if (ceremonyScope === "package_integration") {
    for (const field of ["package_type", "substrate", "placement", "application_method"]) {
      if (!REF_RE.test(normalizedText(physicalContext[field]).replaceAll(" ", "_"))) {
        errors.push(issue(`physical_context_${field}_required`));
      }
    }
    if (physicalContext.filled_package !== true) errors.push(issue("physical_context_filled_package_required"));
    if (carrierProfile === "ntag424_dna_tt" && physicalContext.tagtamper_bridges_opening !== true) {
      errors.push(issue("physical_context_tagtamper_opening_path_required"));
    }
    if (carrierProfile !== "ntag424_dna_tt" && physicalContext.tagtamper_bridges_opening != null) {
      errors.push(issue("physical_context_tagtamper_not_allowed_for_plain_carrier"));
    }
  } else {
    if (Object.keys(physicalContext).length > 0) errors.push(issue("physical_context_not_allowed_for_loose_sample"));
    warnings.push(issue("packaging_integration_not_evaluated"));
  }

  const artifactByPath = new Map();
  for (const descriptor of manifest.artifacts) {
    const artifactPath = safeArtifactPath(descriptor.path);
    if (!artifactPath) {
      errors.push(issue("artifact_path_invalid"));
      continue;
    }
    if (artifactByPath.has(artifactPath)) {
      errors.push(issue("artifact_path_duplicate", artifactPath));
      continue;
    }
    if (descriptor.kind === "physical_photo" && !validTimestamp(descriptor.captured_at)) {
      errors.push(issue("photo_timestamp_invalid", artifactPath));
    }
    artifactByPath.set(artifactPath, { ...descriptor, path: artifactPath });
  }

  const actualArtifacts = walked.files.filter((file) => file.relative !== "evidence-pack.json");
  const actualByPath = new Map(actualArtifacts.map((file) => [file.relative, file]));
  for (const artifactPath of artifactByPath.keys()) {
    if (!actualByPath.has(artifactPath)) errors.push(issue("declared_artifact_missing", artifactPath));
  }
  for (const artifactPath of actualByPath.keys()) {
    if (!artifactByPath.has(artifactPath)) errors.push(issue("undeclared_artifact_rejected", artifactPath));
  }

  const parsedJson = new Map();
  const actualDigestByPath = new Map();
  for (const [artifactPath, descriptor] of artifactByPath) {
    const file = actualByPath.get(artifactPath);
    if (!file) continue;
    if (file.size <= 0 || file.size > MAX_ARTIFACT_BYTES) {
      errors.push(issue("artifact_size_invalid", artifactPath));
      continue;
    }
    let bytes;
    try {
      bytes = await readStableFile(root, file, MAX_ARTIFACT_BYTES);
    } catch {
      errors.push(issue("artifact_snapshot_changed_or_unsafe", artifactPath));
      continue;
    }
    const actualDigest = sha256(bytes);
    actualDigestByPath.set(artifactPath, actualDigest);
    if (actualDigest !== descriptor.sha256) errors.push(issue("artifact_digest_mismatch", artifactPath));
    if (descriptor.media_type === "application/json") {
      try {
        const parsed = parseStrictJson(bytes);
        scanJsonForSensitiveMaterial(parsed, errors, artifactPath);
        scanReservedClaims(
          parsed,
          errors,
          artifactPath,
          descriptor.kind === "server_sun_receipt" ? new Set(["physical_ceremony_verified"]) : new Set(),
        );
        const contract = descriptor.kind === "sanitized_manifest"
          ? SanitizedManifestSchema.safeParse(parsed)
          : SunReceiptSchema.safeParse(parsed);
        if (!contract.success) {
          errors.push(issue("artifact_closed_schema_invalid", artifactPath));
        } else {
          parsedJson.set(artifactPath, contract.data);
        }
      } catch (error) {
        errors.push(issue(error?.code === "json_duplicate_key" ? "artifact_json_duplicate_key" : "artifact_invalid_json", artifactPath));
      }
    } else if (!(await imageIsSanitizedAndDecodable(bytes, descriptor.media_type))) {
      errors.push(issue("photo_metadata_or_format_rejected", artifactPath));
    }
  }

  const photoDigestPaths = new Map();
  for (const artifact of artifactByPath.values()) {
    if (artifact.kind !== "physical_photo") continue;
    const digest = actualDigestByPath.get(artifact.path) || artifact.sha256;
    const paths = photoDigestPaths.get(digest) || [];
    paths.push(artifact.path);
    photoDigestPaths.set(digest, paths);
  }
  for (const paths of photoDigestPaths.values()) {
    if (paths.length > 1) errors.push(issue("duplicate_photo_content_rejected", paths.sort().join(",")));
  }

  const manifestArtifacts = [...artifactByPath.values()].filter((artifact) => artifact.kind === "sanitized_manifest");
  if (manifestArtifacts.length !== 1) errors.push(issue("single_sanitized_manifest_required"));
  const sanitizedManifest = record(parsedJson.get(manifestArtifacts[0]?.path));
  if (sanitizedManifest.batch_ref !== scope.batch_ref) errors.push(issue("sanitized_manifest_batch_mismatch"));
  const manifestEntries = Array.isArray(sanitizedManifest.entries) ? sanitizedManifest.entries : [];
  const manifestFingerprintBySample = new Map();
  const manifestSamplesByFingerprint = new Map();
  for (const entry of manifestEntries) {
    if (manifestFingerprintBySample.has(entry.sample_ref)) errors.push(issue("sanitized_manifest_sample_duplicate", manifestArtifacts[0]?.path));
    const fingerprintOwner = manifestSamplesByFingerprint.get(entry.uid_fingerprint);
    if (fingerprintOwner && fingerprintOwner !== entry.sample_ref) {
      errors.push(issue("sanitized_manifest_uid_fingerprint_duplicate", manifestArtifacts[0]?.path));
    }
    manifestFingerprintBySample.set(entry.sample_ref, entry.uid_fingerprint);
    manifestSamplesByFingerprint.set(entry.uid_fingerprint, entry.sample_ref);
  }

  const samples = manifest.samples;
  if (samples.length !== expectedSampleCount || manifestEntries.length !== expectedSampleCount) {
    errors.push(issue("sample_count_mismatch"));
  }
  const usedArtifacts = new Set(manifestArtifacts.map((artifact) => artifact.path));
  const seenSamples = new Set();
  const samplesByFingerprint = new Map();
  let sacrificialOpenedSamples = 0;
  for (const sample of samples) {
    const sampleRef = sample.sample_ref;
    const uidFingerprint = sample.uid_fingerprint;
    if (seenSamples.has(sampleRef)) {
      errors.push(issue("sample_ref_invalid_or_duplicate"));
      continue;
    }
    seenSamples.add(sampleRef);
    const fingerprintOwner = samplesByFingerprint.get(uidFingerprint);
    if (fingerprintOwner && fingerprintOwner !== sampleRef) {
      errors.push(issue("sample_uid_fingerprint_duplicate"));
    }
    samplesByFingerprint.set(uidFingerprint, sampleRef);
    if (manifestFingerprintBySample.get(sampleRef) !== uidFingerprint) {
      errors.push(issue("sample_manifest_fingerprint_mismatch"));
    }
    const observationsByState = new Map();
    for (const observation of sample.observations) {
      const state = observation.observation;
      if (!SUPPORTED_OBSERVATIONS.has(state) || observationsByState.has(state)) {
        errors.push(issue("sample_observation_invalid_or_duplicate"));
        continue;
      }
      if (state === "opened" && carrierProfile !== "ntag424_dna_tt") {
        errors.push(issue("opened_observation_requires_tagtamper"));
      }
      const receiptPath = safeArtifactPath(observation.receipt_artifact);
      const photoPath = observation.photo_artifact == null ? null : safeArtifactPath(observation.photo_artifact);
      if (!receiptPath || artifactByPath.get(receiptPath)?.kind !== "server_sun_receipt") {
        errors.push(issue("sample_receipt_artifact_invalid", receiptPath || null));
        continue;
      }
      usedArtifacts.add(receiptPath);
      if (photoPath) {
        const photo = artifactByPath.get(photoPath);
        if (photo?.kind !== "physical_photo") {
          errors.push(issue("sample_photo_artifact_invalid", photoPath));
        } else {
          if (photo.sample_ref !== sampleRef) errors.push(issue("sample_photo_ref_mismatch", photoPath));
          if (photo.observation !== state) errors.push(issue("sample_photo_observation_mismatch", photoPath));
          timestampWithinCeremony(
            validTimestamp(photo.captured_at),
            performedAt,
            nowEpoch,
            errors,
            "sample_photo_outside_ceremony_window",
            photoPath,
          );
        }
        usedArtifacts.add(photoPath);
      }
      const receipt = validateReceipt(parsedJson.get(receiptPath), {
        sampleRef,
        batchRef: scope.batch_ref,
        uidFingerprint,
        observation: state,
        tagTamper: carrierProfile === "ntag424_dna_tt",
      }, errors, receiptPath);
      timestampWithinCeremony(
        receipt.capturedAt,
        performedAt,
        nowEpoch,
        errors,
        "sun_receipt_outside_ceremony_window",
        receiptPath,
      );
      if (photoPath && receipt.capturedAt) {
        const photoCapturedAt = validTimestamp(artifactByPath.get(photoPath)?.captured_at);
        if (photoCapturedAt && Math.abs(photoCapturedAt.epoch - receipt.capturedAt.epoch) > 10 * 60 * 1_000) {
          errors.push(issue("sample_photo_receipt_time_mismatch", photoPath));
        }
      }
      observationsByState.set(state, {
        ...receipt,
        photoPath,
        photoCapturedAt: photoPath ? validTimestamp(artifactByPath.get(photoPath)?.captured_at) : null,
      });
    }
    const intact = observationsByState.get("intact");
    const replay = observationsByState.get("replay");
    if (!intact || !replay) errors.push(issue("sample_intact_and_replay_required"));
    if (intact && !intact.photoPath) errors.push(issue("sample_intact_photo_required"));
    if (intact?.capturedAt && replay?.capturedAt && replay.capturedAt.epoch <= intact.capturedAt.epoch) {
      errors.push(issue("sample_replay_timestamp_order_invalid"));
    }
    if (intact && replay && intact.counter !== replay.counter) errors.push(issue("sample_replay_counter_mismatch"));
    const opened = observationsByState.get("opened");
    if (opened) {
      if (sample.sacrificial !== true) errors.push(issue("opened_sample_must_be_sacrificial"));
      if (!opened.photoPath) errors.push(issue("opened_sample_photo_required"));
      if (intact?.capturedAt && opened.capturedAt && opened.capturedAt.epoch <= intact.capturedAt.epoch) {
        errors.push(issue("sample_opened_timestamp_order_invalid"));
      }
      if (replay?.capturedAt && opened.capturedAt && opened.capturedAt.epoch <= replay.capturedAt.epoch) {
        errors.push(issue("sample_opened_must_follow_replay"));
      }
      if (intact?.photoCapturedAt && opened.photoCapturedAt
        && opened.photoCapturedAt.epoch <= intact.photoCapturedAt.epoch) {
        errors.push(issue("sample_opened_photo_must_follow_intact_photo", opened.photoPath));
      }
      if (replay?.capturedAt && opened.photoCapturedAt
        && opened.photoCapturedAt.epoch <= replay.capturedAt.epoch) {
        errors.push(issue("sample_opened_photo_must_follow_replay", opened.photoPath));
      }
      if (intact && opened.counter <= intact.counter) errors.push(issue("sample_opened_counter_must_advance"));
      if (carrierProfile === "ntag424_dna_tt" && sample.sacrificial === true) sacrificialOpenedSamples += 1;
    }
  }
  if (carrierProfile === "ntag424_dna_tt" && sacrificialOpenedSamples < 1) {
    errors.push(issue("tagtamper_sacrificial_opened_sample_required"));
  }
  for (const artifact of artifactByPath.values()) {
    if (!usedArtifacts.has(artifact.path)) errors.push(issue("artifact_unreferenced", artifact.path));
  }

  const evidencePackDigest = sha256(Buffer.from(JSON.stringify(canonicalize({
    manifest_sha256: sha256(manifestBytes),
    artifact_digests: [...artifactByPath.values()]
      .map((artifact) => ({
        path: artifact.path,
        sha256: actualDigestByPath.get(artifact.path) || artifact.sha256,
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  }))));
  return resultEnvelope({
    errors,
    warnings,
    manifest,
    artifactCount: artifactByPath.size,
    totalBytes,
    evidencePackDigest,
  });
}
