export type TTStatusState = "CLOSED" | "OPENED" | "INVALID" | "UNKNOWN";

export type ParsedTTStatus = {
  raw: string;
  perm: TTStatusState;
  current: TTStatusState;
  product_state: "VALID_CLOSED" | "VALID_OPENED" | "VALID_OPENED_PREVIOUSLY" | "VALID_UNKNOWN_TAMPER";
  tamper_status: "CLOSED" | "OPENED" | "OPENED_PREVIOUSLY" | "UNKNOWN";
  tamper_risk: boolean;
  reason?: string;
};

function mapStatusByte(hexByte: string): TTStatusState {
  const normalized = String(hexByte || "").toUpperCase();
  if (normalized === "43") return "CLOSED";
  if (normalized === "4F") return "OPENED";
  if (normalized === "49") return "INVALID";
  return "UNKNOWN";
}

export function parseTTStatusFromDecryptedPayload(payloadHex: string, offset: number) {
  const normalized = String(payloadHex || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  const start = Number.isInteger(offset) && offset >= 0 ? offset * 2 : -1;
  const raw = start >= 0 && normalized.length >= start + 4 ? normalized.slice(start, start + 4) : "";
  const permRaw = raw.slice(0, 2);
  const currRaw = raw.slice(2, 4);
  const perm = mapStatusByte(permRaw);
  const current = mapStatusByte(currRaw);

  const parsed: ParsedTTStatus = {
    raw,
    perm,
    current,
    product_state: "VALID_UNKNOWN_TAMPER",
    tamper_status: "UNKNOWN",
    tamper_risk: false,
  };

  if (raw === "4343") {
    parsed.product_state = "VALID_CLOSED";
    parsed.tamper_status = "CLOSED";
    return parsed;
  }
  if (raw === "4F4F") {
    parsed.product_state = "VALID_OPENED";
    parsed.tamper_status = "OPENED";
    return parsed;
  }
  if (raw === "4F43") {
    parsed.product_state = "VALID_OPENED_PREVIOUSLY";
    parsed.tamper_status = "OPENED_PREVIOUSLY";
    return parsed;
  }
  if (raw === "434F") {
    parsed.product_state = "VALID_UNKNOWN_TAMPER";
    parsed.tamper_status = "UNKNOWN";
    parsed.tamper_risk = true;
    parsed.reason = "TTStatus inconsistent (434F)";
    return parsed;
  }
  if (raw === "4949") {
    parsed.reason = "TTStatus invalid/not enabled";
    return parsed;
  }
  if (!raw) {
    parsed.reason = "TTStatus not available at configured offset";
    return parsed;
  }
  parsed.reason = `TTStatus unknown pattern (${raw})`;
  return parsed;
}
