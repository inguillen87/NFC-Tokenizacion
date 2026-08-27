import { createHash } from "node:crypto";
import { getRequestMeta } from "../../../../lib/request-meta";

export function clean(value: unknown) {
  return String(value || "").trim();
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function maskUid(uid: unknown) {
  const value = clean(uid).toUpperCase();
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function readJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return {};
}

export function parseHeaderIp(req: Request) {
  return getRequestMeta(req).ip;
}

export function isSecureOwnershipCarrier(carrierProfileCode: string | null) {
  return /^ntag424_dna/i.test(clean(carrierProfileCode));
}

export function mapSdkVerdict(result: unknown): "VALID" | "REPLAY_SUSPECT" | "TAMPER_RISK" | "INVALID" | "UNKNOWN_BATCH" {
  const value = clean(result).toUpperCase();
  if (value === "UNKNOWN_BATCH") return "UNKNOWN_BATCH";
  if (value === "REPLAY_SUSPECT") return "REPLAY_SUSPECT";
  if (value.includes("TAMPER") || value.includes("OPENED") || value === "BROKEN") return "TAMPER_RISK";
  if (value === "VALID" || value === "VALID_CLOSED" || value === "VALID_UNKNOWN_TAMPER" || value === "TAP_VALID") return "VALID";
  return "INVALID";
}

export function mapSealStatus(value: unknown): "CLOSED" | "OPENED" | "UNKNOWN" {
  const status = clean(value).toUpperCase();
  if (status === "CLOSED") return "CLOSED";
  if (status === "OPENED" || status === "OPENED_PREVIOUSLY") return "OPENED";
  return "UNKNOWN";
}
