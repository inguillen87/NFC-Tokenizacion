export type TTStatusState = "CLOSED" | "OPENED" | "INVALID" | "UNKNOWN";

export type ParsedTTStatus = {
  raw: string;
  perm: TTStatusState;
  current: TTStatusState;
  product_state: "VALID_CLOSED" | "VALID_OPENED" | "VALID_OPENED_PREVIOUSLY" | "VALID_UNKNOWN_TAMPER";
  tamper_status: "CLOSED" | "OPENED" | "OPENED_PREVIOUSLY" | "INVALID" | "UNKNOWN";
  tamper_risk: boolean;
  reason?: string;
};

export function decodeTTStatus(input: Uint8Array | string | null | undefined) {
  const toBytes = () => {
    if (!input) return null;
    if (input instanceof Uint8Array) return input;
    const raw = String(input).trim();
    if (!raw) return null;
    if (/^[COI]{2}$/i.test(raw)) return new Uint8Array([raw.toUpperCase().charCodeAt(0), raw.toUpperCase().charCodeAt(1)]);
    const hex = raw.replace(/[^0-9a-f]/gi, "").toUpperCase();
    if (hex.length >= 4) return new Uint8Array([parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16)]);
    return null;
  };
  const bytes = toBytes();
  if (!bytes || bytes.length < 2) return { available: false, raw: null, permanent: "unknown", current: "unknown", status: "not_available", tampered: null, current_open: null };
  const mapByte = (b: number) => b === 0x43 ? "closed" : b === 0x4f ? "opened" : b === 0x49 ? "invalid" : "unknown";
  const permanent = mapByte(bytes[0]);
  const current = mapByte(bytes[1]);
  const status = permanent === "invalid" || current === "invalid" ? "invalid" : permanent === "opened" || current === "opened" ? "opened" : permanent === "closed" && current === "closed" ? "closed" : "unknown";
  return { available: true, raw: String.fromCharCode(bytes[0]) + String.fromCharCode(bytes[1]), permanent, current, status, tampered: status === "opened" ? true : status === "invalid" ? null : false, current_open: current === "opened" ? true : status === "invalid" ? null : false };
}

function mapStatusByte(hexByte: string): TTStatusState {
  const normalized = String(hexByte || "").toUpperCase();
  if (normalized === "43") return "CLOSED";
  if (normalized === "4F") return "OPENED";
  if (normalized === "49") return "INVALID";
  return "UNKNOWN";
}

export function parseTTStatusFromDecryptedPayload(
  payloadHex: string,
  offset: number,
  config?: {
    closedValues?: string[];
    openedValues?: string[];
    invalidValues?: string[];
  },
) {
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

  const closedValues = (config?.closedValues || ["4343"]).map((v) => String(v).toUpperCase());
  const openedValues = (config?.openedValues || ["4F4F", "4F43"]).map((v) => String(v).toUpperCase());
  const invalidValues = (config?.invalidValues || ["4949"]).map((v) => String(v).toUpperCase());

  if (closedValues.includes(raw)) {
    parsed.product_state = "VALID_CLOSED";
    parsed.tamper_status = "CLOSED";
    return parsed;
  }
  if (raw === "4F4F" || openedValues.includes(raw) && raw !== "4F43") {
    parsed.product_state = "VALID_OPENED";
    parsed.tamper_status = "OPENED";
    return parsed;
  }
  if (raw === "4F43" || openedValues.includes(raw) && raw === "4F43") {
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
  if (invalidValues.includes(raw)) {
    parsed.tamper_status = "INVALID";
    parsed.reason = "INVALID_TTSTATUS";
    return parsed;
  }
  if (!raw) {
    parsed.reason = "TTStatus not available at configured offset";
    return parsed;
  }
  parsed.reason = `TTStatus unknown pattern (${raw})`;
  return parsed;
}
