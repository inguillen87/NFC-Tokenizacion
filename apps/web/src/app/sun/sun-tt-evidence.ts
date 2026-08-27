export type SunTtByteState = "closed" | "opened" | "invalid" | "unknown";
export type SunTtEvidenceState = "closed" | "opened" | "opened_previously" | "invalid" | "contradictory" | "unknown" | "unavailable";

export type SunTtTechnicalInput = {
  raw?: unknown;
  permanentHex?: unknown;
  currentHex?: unknown;
  permanentStatus?: unknown;
  currentStatus?: unknown;
  interpretedStatus?: unknown;
  source?: unknown;
  offset?: unknown;
  length?: unknown;
};

export type SunTtEvidence = {
  available: boolean;
  rawHex: string | null;
  state: SunTtEvidenceState;
  label: string;
  summary: string;
  requiresReview: boolean;
  reportedConsistent: boolean | null;
  source: string | null;
  offset: number | null;
  length: number | null;
  bytes: Array<{
    index: 1 | 2;
    role: "permanent" | "current";
    title: string;
    hex: string;
    state: SunTtByteState;
    label: string;
  }>;
};

function normalizeHexByte(value: unknown): string | null {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[0-9A-F]{2}$/.test(normalized) ? normalized : null;
}

function normalizeFullRaw(input: SunTtTechnicalInput): string | null {
  const raw = String(input.raw || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (/^[0-9A-F]{4}$/.test(raw)) return raw;
  const permanentHex = normalizeHexByte(input.permanentHex);
  const currentHex = normalizeHexByte(input.currentHex);
  return permanentHex && currentHex ? `${permanentHex}${currentHex}` : null;
}

function decodeByte(hex: string): { state: SunTtByteState; label: string } {
  if (hex === "43") return { state: "closed", label: "Cerrado" };
  if (hex === "4F") return { state: "opened", label: "Abierto" };
  if (hex === "49") return { state: "invalid", label: "Inválido" };
  return { state: "unknown", label: "No reconocido" };
}

function preciseReportedState(value: unknown): SunTtEvidenceState | null {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "CLOSED" || normalized === "VALID_CLOSED") return "closed";
  if (normalized === "OPENED" || normalized === "VALID_OPENED") return "opened";
  if (normalized === "OPENED_PREVIOUSLY" || normalized === "VALID_OPENED_PREVIOUSLY") return "opened_previously";
  if (normalized === "INVALID") return "invalid";
  return null;
}

function reportedStateMatches(reported: SunTtEvidenceState, decoded: SunTtEvidenceState): boolean {
  if (reported === "opened") return decoded === "opened" || decoded === "opened_previously";
  return reported === decoded;
}

/**
 * Decodes the complete two-byte NXP TagTamper status for technical display.
 * It describes the electronic TT signal only; it never asserts physical-product authenticity.
 */
export function resolveSunTtEvidence(input: SunTtTechnicalInput): SunTtEvidence {
  const rawHex = normalizeFullRaw(input);
  const source = String(input.source || "").trim() || null;
  const offsetNumber = input.offset === null || input.offset === undefined || input.offset === "" ? Number.NaN : Number(input.offset);
  const lengthNumber = input.length === null || input.length === undefined || input.length === "" ? Number.NaN : Number(input.length);
  const offset = Number.isInteger(offsetNumber) && offsetNumber >= 0 ? offsetNumber : null;
  const length = Number.isInteger(lengthNumber) && lengthNumber > 0 ? lengthNumber : null;

  if (!rawHex) {
    return {
      available: false,
      rawHex: null,
      state: "unavailable",
      label: "Estado TT no disponible",
      summary: "Esta lectura no aporta los dos bytes necesarios para interpretar el estado electrónico de apertura.",
      requiresReview: false,
      reportedConsistent: null,
      source,
      offset,
      length,
      bytes: [],
    };
  }

  const permanentHex = rawHex.slice(0, 2);
  const currentHex = rawHex.slice(2, 4);
  const permanent = decodeByte(permanentHex);
  const current = decodeByte(currentHex);
  let state: SunTtEvidenceState;
  let label: string;
  let summary: string;

  if (rawHex === "4343") {
    state = "closed";
    label = "TT reporta cerrado";
    summary = "Los bytes permanente y actual reportan estado cerrado.";
  } else if (rawHex === "4F4F") {
    state = "opened";
    label = "TT reporta abierto";
    summary = "Los bytes permanente y actual reportan apertura.";
  } else if (rawHex === "4F43") {
    state = "opened_previously";
    label = "TT registra apertura previa";
    summary = "El byte permanente registra una apertura anterior y el byte actual reporta cerrado.";
  } else if (permanent.state === "invalid" || current.state === "invalid") {
    state = "invalid";
    label = "TT inválido";
    summary = "Al menos uno de los bytes contiene el valor inválido 49. La lectura requiere revisión técnica.";
  } else if (rawHex === "434F") {
    state = "contradictory";
    label = "TT contradictorio";
    summary = "El estado actual reporta apertura, pero el byte permanente sigue cerrado. Las acciones sensibles deben permanecer bloqueadas.";
  } else {
    state = "unknown";
    label = "Patrón TT no reconocido";
    summary = "Los dos bytes están presentes, pero no coinciden con un patrón TT admitido por esta configuración.";
  }

  const reportedState = preciseReportedState(input.interpretedStatus);
  const reportedConsistent = reportedState ? reportedStateMatches(reportedState, state) : null;
  if (reportedConsistent === false) {
    state = "contradictory";
    label = "TT contradictorio";
    summary = "Los bytes TT y el estado informado por el servicio no coinciden. Las acciones sensibles deben permanecer bloqueadas.";
  }

  return {
    available: true,
    rawHex,
    state,
    label,
    summary,
    requiresReview: ["invalid", "contradictory", "unknown"].includes(state),
    reportedConsistent,
    source,
    offset,
    length,
    bytes: [
      { index: 1, role: "permanent", title: "Memoria permanente", hex: permanentHex, ...permanent },
      { index: 2, role: "current", title: "Estado actual", hex: currentHex, ...current },
    ],
  };
}
