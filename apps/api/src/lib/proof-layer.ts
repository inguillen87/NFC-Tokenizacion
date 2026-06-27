import { createHash } from "node:crypto";

export type EvidenceEventInput = {
  tenantId?: string | null;
  resourceType: string;
  resourceId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

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

function stripShaPrefix(value: string) {
  return value.replace(/^sha256:/i, "").trim().toLowerCase();
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
