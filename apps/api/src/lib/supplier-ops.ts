import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import type { ManifestParseResult } from "./tag-manifest.ts";

export type SupplierSubBatchPlan = {
  bid: string;
  sequenceIndex: number;
  expectedQuantity: number;
};

export type SupplierOrderInput = {
  customerSlug: string;
  orderName: string;
  totalQuantity: number;
  subBatchSize: number;
  baseBatchId?: string | null;
};

export type SupplierBatchKeys = {
  kMetaHex: string;
  kFileHex: string;
  fingerprint: string;
};

export type SupplierPackInput = {
  clientSlug: string;
  batchId: string;
  quantity: number;
  chipModel: string;
  carrierProfile: string;
  kMetaHex: string;
  kFileHex: string;
  urlTemplate: string;
  materialType?: string | null;
  notes?: string | null;
};

export type SupplierPack = {
  text: string;
  json: Record<string, unknown>;
  contentHash: string;
};

export type SupplierZipEntry = {
  path: string;
  data: string | Buffer | Uint8Array;
};

export type SupplierPackPdfInput = {
  clientSlug: string;
  batchId: string;
  quantity: number;
  chipModel: string;
  carrierProfile: string;
  keyFingerprint: string;
  contentHash: string;
  jsonHash: string;
  urlTemplate: string;
};

export type SupplierEncryptedZip = {
  envelopeBuffer: Buffer;
  plaintextZipHash: string;
  ciphertextHash: string;
  envelopeHash: string;
  encryption: {
    algorithm: "AES-256-GCM";
    kdf: "scrypt";
    salt_base64: string;
    iv_base64: string;
    tag_base64: string;
    aad: "nexid-supplier-pack-v1";
    scrypt: { N: number; r: number; p: number; key_length: number };
  };
};

function normalizeToken(input: unknown, fallback: string) {
  const raw = String(input || "").trim();
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function suffixFromIndex(index: number) {
  let value = Math.max(0, Math.trunc(index));
  let suffix = "";
  do {
    suffix = String.fromCharCode(65 + (value % 26)) + suffix;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return suffix;
}

function sha256(value: string | Buffer | Uint8Array) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function sha256Buffer(value: string | Buffer | Uint8Array) {
  return sha256(value);
}

const crc32Table = new Uint32Array(256);
let crc32Ready = false;

function ensureCrc32Table() {
  if (crc32Ready) return;
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc32Table[i] = c >>> 0;
  }
  crc32Ready = true;
}

function crc32(buffer: Buffer) {
  ensureCrc32Table();
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getUTCFullYear());
  const dosTime = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { dosDate, dosTime };
}

function normalizeZipPath(path: string) {
  const normalized = String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  if (!normalized) throw new Error("zip entry path is required");
  return normalized;
}

function toBuffer(data: string | Buffer | Uint8Array) {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data, "utf8");
  return Buffer.from(data);
}

export function buildZipArchive(entries: SupplierZipEntry[]) {
  const now = dosDateTime();
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const records: Array<{
    name: Buffer;
    crc: number;
    size: number;
    offset: number;
  }> = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(normalizeZipPath(entry.path), "utf8");
    const data = toBuffer(entry.data);
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(now.dosTime, 10);
    localHeader.writeUInt16LE(now.dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);
    records.push({ name, crc, size: data.length, offset });
    offset += localHeader.length + name.length + data.length;
  }

  const centralStart = offset;
  for (const record of records) {
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(now.dosTime, 12);
    centralHeader.writeUInt16LE(now.dosDate, 14);
    centralHeader.writeUInt32LE(record.crc, 16);
    centralHeader.writeUInt32LE(record.size, 20);
    centralHeader.writeUInt32LE(record.size, 24);
    centralHeader.writeUInt16LE(record.name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(record.offset, 42);
    centralParts.push(centralHeader, record.name);
    offset += centralHeader.length + record.name.length;
  }
  const centralSize = offset - centralStart;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(records.length, 8);
  end.writeUInt16LE(records.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function escapePdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function buildSupplierPackPdfSummary(input: SupplierPackPdfInput) {
  const rows = [
    "nexID Supplier Encoding Pack",
    `Client: ${input.clientSlug}`,
    `Batch ID: ${input.batchId}`,
    `Quantity: ${input.quantity}`,
    `Chip model: ${input.chipModel}`,
    `Carrier profile: ${input.carrierProfile}`,
    `Key fingerprint: ${input.keyFingerprint}`,
    `TXT hash: ${input.contentHash}`,
    `JSON hash: ${input.jsonHash}`,
    "Raw K_META_BATCH and K_FILE_BATCH are only in the encrypted TXT/JSON files.",
    "Never share KMS, database URLs, admin keys, private keys or webhook secrets.",
    "Manifest required: batch_id,uid_hex. Roll/carton labels must include BATCH_ID.",
    `URL template: ${input.urlTemplate}`,
  ];
  const stream = [
    "BT",
    "/F2 18 Tf",
    "52 744 Td",
    `(${escapePdfText(rows[0])}) Tj`,
    "/F1 10 Tf",
    ...rows.slice(1).flatMap((line) => ["0 -22 Td", `(${escapePdfText(line).slice(0, 118)}) Tj`]),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  for (const objectOffset of offsets.slice(1)) {
    chunks.push(`${String(objectOffset).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(""), "utf8");
}

export function encryptSupplierZipArchive(zipBuffer: Buffer, password: string, metadata: Record<string, unknown> = {}): SupplierEncryptedZip {
  if (!password || password.length < 16) throw new Error("supplier pack password must be at least 16 characters");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const aad = Buffer.from("nexid-supplier-pack-v1", "utf8");
  const scryptParams = { N: 32768, r: 8, p: 1, key_length: 32 };
  const key = scryptSync(password, salt, scryptParams.key_length, {
    N: scryptParams.N,
    r: scryptParams.r,
    p: scryptParams.p,
    maxmem: 64 * 1024 * 1024,
  });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(zipBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const plaintextZipHash = sha256(zipBuffer);
  const ciphertextHash = sha256(ciphertext);
  const encryption = {
    algorithm: "AES-256-GCM" as const,
    kdf: "scrypt" as const,
    salt_base64: salt.toString("base64"),
    iv_base64: iv.toString("base64"),
    tag_base64: tag.toString("base64"),
    aad: "nexid-supplier-pack-v1" as const,
    scrypt: scryptParams,
  };
  const envelope = {
    format: "nexid-supplier-pack/aes-256-gcm+zip/v1",
    created_at: new Date().toISOString(),
    encryption,
    plaintext_zip_sha256: plaintextZipHash,
    ciphertext_sha256: ciphertextHash,
    metadata,
    ciphertext_base64: ciphertext.toString("base64"),
  };
  const envelopeBuffer = Buffer.from(JSON.stringify(envelope, null, 2), "utf8");
  return {
    envelopeBuffer,
    plaintextZipHash,
    ciphertextHash,
    envelopeHash: sha256(envelopeBuffer),
    encryption,
  };
}

export function decryptSupplierEncryptedZipForTest(envelopeBuffer: Buffer | string, password: string) {
  const envelope = JSON.parse(Buffer.isBuffer(envelopeBuffer) ? envelopeBuffer.toString("utf8") : envelopeBuffer) as {
    encryption: SupplierEncryptedZip["encryption"];
    ciphertext_base64: string;
  };
  const salt = Buffer.from(envelope.encryption.salt_base64, "base64");
  const iv = Buffer.from(envelope.encryption.iv_base64, "base64");
  const tag = Buffer.from(envelope.encryption.tag_base64, "base64");
  const key = scryptSync(password, salt, envelope.encryption.scrypt.key_length, {
    N: envelope.encryption.scrypt.N,
    r: envelope.encryption.scrypt.r,
    p: envelope.encryption.scrypt.p,
    maxmem: 64 * 1024 * 1024,
  });
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(envelope.encryption.aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext_base64, "base64")), decipher.final()]);
}

export function buildSupplierSubBatchPlan(input: SupplierOrderInput): SupplierSubBatchPlan[] {
  const totalQuantity = Math.trunc(Number(input.totalQuantity || 0));
  const subBatchSize = Math.trunc(Number(input.subBatchSize || 0));
  if (!Number.isFinite(totalQuantity) || totalQuantity <= 0) {
    throw new Error("total_quantity must be greater than zero");
  }
  if (!Number.isFinite(subBatchSize) || subBatchSize <= 0) {
    throw new Error("sub_batch_size must be greater than zero");
  }
  if (subBatchSize > totalQuantity) {
    throw new Error("sub_batch_size cannot be greater than total_quantity");
  }

  const base = normalizeToken(input.baseBatchId, normalizeToken(input.orderName, normalizeToken(input.customerSlug, "ORDER")));
  const count = Math.ceil(totalQuantity / subBatchSize);
  return Array.from({ length: count }, (_, index) => {
    const remaining = totalQuantity - index * subBatchSize;
    return {
      bid: `${base}-${suffixFromIndex(index)}`,
      sequenceIndex: index + 1,
      expectedQuantity: Math.min(subBatchSize, remaining),
    };
  });
}

export function generateSupplierBatchKeys(): SupplierBatchKeys {
  const kMetaHex = randomBytes(16).toString("hex").toUpperCase();
  const kFileHex = randomBytes(16).toString("hex").toUpperCase();
  return {
    kMetaHex,
    kFileHex,
    fingerprint: fingerprintSupplierKeys(kMetaHex, kFileHex),
  };
}

export function fingerprintSupplierKeys(kMetaHex: string, kFileHex: string) {
  const meta = assertHex32(kMetaHex, "K_META_BATCH");
  const file = assertHex32(kFileHex, "K_FILE_BATCH");
  return createHash("sha256").update(`${meta}:${file}`).digest("hex").slice(0, 16).toUpperCase();
}

export function assertHex32(value: unknown, field: string) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(normalized)) {
    throw new Error(`${field} must be a 32-char hex string`);
  }
  return normalized;
}

export function validateSupplierManifestQuantity(manifest: ManifestParseResult, expectedQuantity: number) {
  const expected = Math.trunc(Number(expectedQuantity || 0));
  if (expected <= 0) return { ok: true as const };
  const received = manifest.rows.length;
  if (received !== expected) {
    return {
      ok: false as const,
      reason: "quantity_mismatch",
      expected,
      received,
    };
  }
  return { ok: true as const };
}

export function buildSupplierEncodingPack(input: SupplierPackInput): SupplierPack {
  const kMetaHex = assertHex32(input.kMetaHex, "K_META_BATCH");
  const kFileHex = assertHex32(input.kFileHex, "K_FILE_BATCH");
  const carrierProfile = String(input.carrierProfile || "").trim();
  const isTagTamper = carrierProfile === "ntag424_dna_tt";
  const payload = {
    CLIENT_SLUG: String(input.clientSlug || "").trim(),
    BATCH_ID: String(input.batchId || "").trim(),
    QUANTITY: Math.max(0, Math.trunc(Number(input.quantity || 0))),
    CHIP_MODEL: String(input.chipModel || "").trim(),
    CARRIER_PROFILE: carrierProfile,
    MATERIAL_TYPE: String(input.materialType || "").trim() || null,
    K_META_BATCH: kMetaHex,
    K_FILE_BATCH: kFileHex,
    URL_TEMPLATE: String(input.urlTemplate || "").trim(),
    MANIFEST_FORMAT: "batch_id,uid_hex",
    PACKAGING_LABEL: `${String(input.clientSlug || "").trim()} / ${String(input.batchId || "").trim()}`,
    REQUIREMENTS: [
      "SUN/SDM enabled",
      "dynamic UID",
      "dynamic read counter",
      "encrypted enc",
      "CMAC validation",
      "anti-replay",
      "UID manifest per sub-batch",
      "roll/carton labeled with BATCH_ID",
    ],
    TTSTATUS: isTagTamper
      ? {
          source: "enc_decrypted",
          offset: 0,
          length_bytes: 2,
          closed: "4343",
          opened: "4F4F",
          opened_previously: "4F43",
          invalid: "4949",
        }
      : null,
    NOTES: String(input.notes || "").trim() || null,
  };

  const lines = Object.entries(payload)
    .filter(([, value]) => value !== null)
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) return [`${key}:`, ...value.map((item) => `- ${item}`)];
      if (typeof value === "object") return [`${key}: ${JSON.stringify(value)}`];
      return [`${key}=${value}`];
    });
  const text = `${lines.join("\n")}\n`;
  const contentHash = `sha256:${createHash("sha256").update(text).digest("hex")}`;
  return { text, json: payload, contentHash };
}

export function canActivateSupplierSubBatch(input: {
  manifestStatus?: string | null;
  qaStatus?: string | null;
  expectedQuantity?: number | null;
  manifestCount?: number | null;
  overrideReason?: string | null;
}) {
  const overrideReason = String(input.overrideReason || "").trim();
  if (overrideReason) return { ok: true as const, override: true as const };
  if (input.manifestStatus !== "imported") {
    return { ok: false as const, reason: "manifest_not_imported" };
  }
  if (input.qaStatus !== "passed") {
    return { ok: false as const, reason: "qa_not_passed" };
  }
  const expected = Math.trunc(Number(input.expectedQuantity || 0));
  const received = Math.trunc(Number(input.manifestCount || 0));
  if (expected > 0 && received !== expected) {
    return { ok: false as const, reason: "manifest_quantity_mismatch", expected, received };
  }
  return { ok: true as const, override: false as const };
}

export function validateSupplierQaEvidence(input: {
  passed: boolean;
  sampleUrls?: unknown[] | null;
  replayChecked?: boolean | null;
  ttstatusChecked?: boolean | null;
  requiresTtstatus?: boolean | null;
}) {
  if (!input.passed) return { ok: true as const };
  const sampleCount = Array.isArray(input.sampleUrls)
    ? input.sampleUrls.map((item) => String(item || "").trim()).filter(Boolean).length
    : 0;
  if (sampleCount <= 0) {
    return { ok: false as const, reason: "qa_sample_evidence_required", sampleCount };
  }
  if (!input.replayChecked) {
    return { ok: false as const, reason: "qa_replay_check_required", sampleCount };
  }
  if (input.requiresTtstatus && !input.ttstatusChecked) {
    return { ok: false as const, reason: "qa_ttstatus_check_required", sampleCount };
  }
  return { ok: true as const, sampleCount };
}
