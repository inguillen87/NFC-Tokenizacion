export const CONSUMER_TAPS_LIMIT = 200;

export type ConsumerTapStatus = "validated" | "attention" | "unknown";
export type ConsumerTapRisk =
  | { kind: "category"; category: "none" | "low" | "medium" | "high" | "critical"; label: string }
  | { kind: "score"; score: number; label: string }
  | { kind: "unreported"; label: string };

export type ConsumerTapItem = {
  id: string | null;
  href: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  productName: string | null;
  brandName: string | null;
  batch: string | null;
  location: string | null;
  verdict: string | null;
  status: ConsumerTapStatus;
  statusLabel: string;
  risk: ConsumerTapRisk;
  date: string;
  dateTime: string | null;
};

export type ConsumerTapsSource =
  | { status: "ready"; data: ConsumerTapItem[] }
  | { status: "unavailable"; data: null };

// Message results are not permission to claim, redeem or contact.
// Match exact codes: an unfamiliar code containing VALID or TAMPER is unknown.
const POSITIVE_RESULTS: Readonly<Record<string, string>> = {
  VALID: "Mensaje NFC validado", TAP_VALID: "Mensaje NFC validado", AUTH_OK: "Mensaje NFC validado",
  VALID_AUTHENTIC: "Mensaje NFC validado", VALID_CLOSED: "Sello cerrado reportado",
  OPENED: "Sello abierto reportado", OPENED_PREVIOUSLY: "Apertura anterior reportada",
  VALID_OPENED: "Sello abierto reportado", VALID_OPENED_PREVIOUSLY: "Apertura anterior reportada",
  MANUAL_OPENED: "Apertura manual reportada", VALID_MANUAL_OPENED: "Apertura manual reportada",
  VALID_UNKNOWN_TAMPER: "Mensaje validado · sello no confirmado",
};

const ATTENTION_RESULTS: Readonly<Record<string, string>> = {
  REPLAY: "Lectura repetida por revisar", REPLAY_SUSPECT: "Lectura repetida por revisar",
  DUPLICATE: "Lectura duplicada reportada",
  INVALID: "Mensaje no validado", TAP_INVALID: "Mensaje no validado",
  SUN_PROFILE_MISMATCH: "Configuración de la lectura por revisar",
  SUN_BATCH_DUPLICATE_CONFIG: "Configuración del lote por revisar",
  UNKNOWN_BATCH: "Lote no reconocido", NOT_REGISTERED: "Etiqueta no registrada",
  NOT_ACTIVE: "Etiqueta no activa", REVOKED: "Registro revocado", BROKEN: "Apertura o daño reportado",
  TAMPER: "Señal de alteración reportada", TAMPERED: "Señal de alteración reportada",
  TAMPER_RISK: "Señal de riesgo reportada", TAMPER_UNVERIFIED: "Estado del sello por revisar",
  MALFORMED_URL: "Enlace de lectura incompleto",
};

const utcFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium", timeStyle: "medium", timeZone: "UTC", hourCycle: "h23",
});

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function canonicalEventId(value: unknown): string | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  // PostgreSQL bigint IDs must retain their string precision. Legacy numeric
  // payloads are usable only when their value is already a safe integer.
  if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value)) return null;
  return BigInt(value) <= 9223372036854775807n ? value : null;
}

function readRisk(value: unknown): ConsumerTapRisk {
  const category = text(value)?.toLowerCase();
  if (category === "none" || category === "low" || category === "medium" || category === "high" || category === "critical") {
    const labels = { none: "Sin señal de riesgo", low: "Riesgo bajo", medium: "Riesgo medio", high: "Riesgo alto", critical: "Riesgo crítico" };
    return { kind: "category", category, label: labels[category] };
  }
  // An explicit finite number in the supported score range is a score.
  // Null, empty values, categories and booleans must never become zero.
  const numeric = typeof value === "number" ? value
    : category && /^\d+(?:\.\d+)?$/.test(category) ? Number(category) : null;
  if (numeric !== null && Number.isFinite(numeric) && numeric >= 0 && numeric <= 100) {
    return { kind: "score", score: numeric, label: `Puntaje de riesgo: ${numeric}` };
  }
  return { kind: "unreported", label: "Riesgo no informado" };
}

function readDate(value: unknown): Pick<ConsumerTapItem, "date" | "dateTime"> {
  const raw = text(value)?.replace(/^(\d{4}-\d{2}-\d{2})\s/, "$1T")
    .replace(/([+-]\d{2})$/, "$1:00").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  // Accept PostgreSQL timestamps only with an explicit offset or Z; never
  // let an unzoned value inherit the server or phone time zone.
  const parts = raw?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i);
  if (!raw || !parts) {
    return { date: "Fecha no informada", dateTime: null };
  }
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] || hour > 23 || minute > 59 || second > 59) {
    return { date: "Fecha no informada", dateTime: null };
  }
  const date = new Date(raw);
  return Number.isFinite(date.getTime())
    ? { date: `${utcFormatter.format(date)} UTC`, dateTime: date.toISOString() }
    : { date: "Fecha no informada", dateTime: null };
}

export function parseConsumerTap(value: unknown): ConsumerTapItem | null {
  const item = record(value);
  if (!item) return null;
  const id = canonicalEventId(item.tap_event_id);
  const verdict = text(item.verdict)?.toUpperCase() || null;
  const positive = verdict !== null && Object.hasOwn(POSITIVE_RESULTS, verdict);
  const attention = verdict !== null && Object.hasOwn(ATTENTION_RESULTS, verdict);
  return {
    id, href: id ? `/me/taps/${encodeURIComponent(id)}` : null,
    tenantSlug: text(item.tenant_slug), tenantName: text(item.tenant_name),
    productName: text(item.product_name), brandName: text(item.brand_name), batch: text(item.bid),
    location: [text(item.city), text(item.country)].filter(Boolean).join(", ") || null,
    verdict, status: positive ? "validated" : attention ? "attention" : "unknown",
    statusLabel: positive ? POSITIVE_RESULTS[verdict!] : attention ? ATTENTION_RESULTS[verdict!] : "Resultado no confirmado",
    risk: readRisk(item.risk_level), ...readDate(item.created_at),
  };
}

export function buildConsumerTapsSource(payload: unknown): ConsumerTapsSource {
  const envelope = record(payload);
  if (envelope?.ok !== true || !Array.isArray(envelope.items)) return { status: "unavailable", data: null };
  const parsed = envelope.items.map(parseConsumerTap);
  if (parsed.some((item) => item === null)) return { status: "unavailable", data: null };
  // A recent sample, never a lifetime metric. Bound rendering as well as the
  // API's current LIMIT 200, without inventing a total or pagination.
  return { status: "ready", data: (parsed as ConsumerTapItem[]).slice(0, CONSUMER_TAPS_LIMIT) };
}
