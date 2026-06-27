import { createHash, randomBytes } from "node:crypto";
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
