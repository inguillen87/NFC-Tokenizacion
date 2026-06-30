import { createHash, randomBytes } from "node:crypto";

export const OFFLINE_LOCAL_VERDICTS = [
  "OFFLINE_LOCAL_PASS",
  "OFFLINE_LOCAL_FAIL",
  "SYNC_PENDING",
] as const;

export type OfflineLocalVerdict = (typeof OFFLINE_LOCAL_VERDICTS)[number];

const OFFLINE_LOCAL_VERDICT_SET = new Set<string>(OFFLINE_LOCAL_VERDICTS);

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashOfflineIdentifier(value: unknown, namespace: string) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(`${namespace}_required`);
  return `sha256:${sha256Hex(`${namespace}:${raw}`)}`;
}

export function buildOfflineBundleRef() {
  return `ovb_${randomBytes(18).toString("hex")}`;
}

export function normalizeOfflineLocalVerdict(value: unknown): OfflineLocalVerdict {
  const normalized = String(value || "").trim().toUpperCase();
  if (!OFFLINE_LOCAL_VERDICT_SET.has(normalized)) {
    throw new Error("offline_local_verdict_invalid");
  }
  return normalized as OfflineLocalVerdict;
}

export function normalizeOfflineObservedAt(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error("observed_at_invalid");
  return parsed.toISOString();
}

export function normalizeOfflineHash(value: unknown, field: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!/^sha256:[0-9a-f]{64}$/i.test(raw)) throw new Error(`${field}_must_be_sha256`);
  return raw.toLowerCase();
}

export function normalizeOfflineBundleExpiry(value: unknown) {
  const raw = String(value || "").trim();
  const expiresAt = raw ? new Date(raw) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(expiresAt.getTime())) throw new Error("expires_at_invalid");
  const max = Date.now() + 30 * 24 * 60 * 60 * 1000;
  if (expiresAt.getTime() <= Date.now()) throw new Error("expires_at_must_be_future");
  if (expiresAt.getTime() > max) throw new Error("expires_at_max_30_days");
  return expiresAt.toISOString();
}

export function normalizeOfflineBids(value: unknown) {
  const input = Array.isArray(value) ? value : String(value || "").split(/[\s,\n]+/);
  const bids = Array.from(new Set(input.map((item) => String(item || "").trim()).filter(Boolean)));
  if (!bids.length) throw new Error("bids_required");
  if (bids.length > 100) throw new Error("bids_max_100");
  return bids;
}
