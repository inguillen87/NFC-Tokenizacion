import { createHash } from "node:crypto";

export type EvidenceEventInput = {
  tenantId?: string | null;
  resourceType: string;
  resourceId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

const FORBIDDEN_PROOF_KEYS = new Set([
  "address",
  "contact",
  "contacto",
  "direccion",
  "dni",
  "document",
  "documento",
  "email",
  "enc",
  "enc_hex",
  "enc_plain_hex",
  "file_key",
  "file_key_ct",
  "full_name",
  "k_file",
  "k_file_batch",
  "k_file_hex",
  "k_meta",
  "k_meta_batch",
  "k_meta_hex",
  "mail",
  "name",
  "nombre",
  "pack_password",
  "password",
  "phone",
  "picc",
  "picc_data",
  "picc_data_hex",
  "picc_plain_hex",
  "private_key",
  "raw_key",
  "raw_payload",
  "raw_uid",
  "secret",
  "telefono",
  "uid",
  "uid_hex",
  "uidhex",
  "whatsapp",
]);

function normalizeProofKey(key: string) {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function stableJson(input: unknown): string {
  if (input === null || typeof input !== "object") return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map((item) => stableJson(item)).join(",")}]`;
  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, value]) => `${JSON.stringify(key)}:${stableJson(value)}`).join(",")}}`;
}

export function hashEvidencePayload(input: EvidenceEventInput | Record<string, unknown>) {
  return `sha256:${createHash("sha256").update(stableJson(input)).digest("hex")}`;
}

export function hashPublicText(value: string) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function stripShaPrefix(value: string) {
  return value.replace(/^sha256:/i, "").trim().toLowerCase();
}

const CANONICAL_SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function canonicalSha256Hash(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^sha256:[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

export function isSha256Hash(value: unknown) {
  return /^sha256:[0-9a-f]{64}$/i.test(String(value || "").trim());
}

export function findForbiddenProofPayloadKey(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  if (Array.isArray(input)) {
    for (const item of input) {
      const nested = findForbiddenProofPayloadKey(item);
      if (nested) return nested;
    }
    return null;
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (FORBIDDEN_PROOF_KEYS.has(normalizeProofKey(key))) return key;
    const nested = findForbiddenProofPayloadKey(value);
    if (nested) return nested;
  }
  return null;
}

export function buildMerkleRoot(eventHashes: string[]) {
  const leaves = eventHashes.map(stripShaPrefix).filter((hash) => /^[0-9a-f]{64}$/.test(hash));
  if (!leaves.length) throw new Error("event_hashes_required");
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      next.push(createHash("sha256").update(`${left}${right}`).digest("hex"));
    }
    level = next;
  }
  return `sha256:${level[0]}`;
}

export function verifyHashInAnchor(eventHash: string, anchorHashes: string[]) {
  const normalized = stripShaPrefix(eventHash);
  return anchorHashes.map(stripShaPrefix).includes(normalized);
}

/**
 * A persisted member list is evidence only when it is the complete, canonical
 * preimage of the committed Merkle root. Merely finding a hash in JSON is not
 * an inclusion proof.
 */
export function verifyHashInMerkleAnchor(input: {
  eventHash: unknown;
  eventHashes: unknown;
  eventCount: unknown;
  merkleRoot: unknown;
}) {
  const eventHash = canonicalSha256Hash(input.eventHash);
  const merkleRoot = String(input.merkleRoot || "");
  if (!eventHash) return { valid: false, included: false, reason: "event_hash_invalid" } as const;
  if (!Array.isArray(input.eventHashes) || input.eventHashes.length === 0 || input.eventHashes.length > 5_000) {
    return { valid: false, included: false, reason: "anchor_member_list_invalid" } as const;
  }
  if (!input.eventHashes.every((value) => typeof value === "string" && CANONICAL_SHA256_PATTERN.test(value))) {
    return { valid: false, included: false, reason: "anchor_member_hash_invalid" } as const;
  }
  const eventHashes = input.eventHashes as string[];
  if (new Set(eventHashes).size !== eventHashes.length) {
    return { valid: false, included: false, reason: "anchor_member_duplicate" } as const;
  }
  const eventCount = Number(input.eventCount);
  if (!Number.isSafeInteger(eventCount) || eventCount !== eventHashes.length) {
    return { valid: false, included: false, reason: "anchor_event_count_mismatch" } as const;
  }
  if (!CANONICAL_SHA256_PATTERN.test(merkleRoot)) {
    return { valid: false, included: false, reason: "anchor_merkle_root_invalid" } as const;
  }
  const calculatedMerkleRoot = buildMerkleRoot(eventHashes);
  if (calculatedMerkleRoot !== merkleRoot) {
    return { valid: false, included: false, reason: "anchor_merkle_root_mismatch" } as const;
  }
  return {
    valid: true,
    included: eventHashes.includes(eventHash),
    reason: eventHashes.includes(eventHash) ? null : "event_hash_not_in_anchor",
    calculatedMerkleRoot,
  } as const;
}
