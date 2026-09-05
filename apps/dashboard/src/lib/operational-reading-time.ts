export type OperationalTimeZone = { timeZone: string; isFallback: boolean };

type ZonedReading = { tenantSlug?: string | null; timezone?: string | null };
type ReadingTimestamp = { occurredAt?: unknown; occurredAtUtc?: unknown; occurredAtLocal?: unknown };

const utcFallback = (): OperationalTimeZone => ({ timeZone: "UTC", isFallback: true });

function validTimeZone(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return new Intl.DateTimeFormat("es-AR", { timeZone: value.trim() }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function resolveOperationalTimeZone(rows: readonly ZonedReading[], selectedTenant = "all", tenantScope = ""): OperationalTimeZone {
  const selected = String(selectedTenant || "").trim().toLowerCase();
  const scope = selected === "all" ? "" : selected || String(tenantScope || "").trim().toLowerCase();
  const scoped = scope && scope !== "all" ? rows.filter((row) => String(row.tenantSlug || "").trim().toLowerCase() === scope) : rows;
  const zones = scoped.map((row) => validTimeZone(row.timezone));
  if (!zones.length || zones.some((zone) => !zone) || new Set(zones).size !== 1) return utcFallback();
  return { timeZone: zones[0]!, isFallback: false };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Only explicit instants are accepted; localized or zone-less strings are not browser-local dates. */
export function parseOperationalTimestamp(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) ? value : null;
  if (typeof value !== "string") return null;
  let text = value.trim();
  // The existing event normalizer can stringify a database Date this way.
  const legacy = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{4}) (\d{2}:\d{2}:\d{2}) GMT([+-]\d{4})(?: \([^)]*\))?$/.exec(text);
  if (legacy) text = `${legacy[3]}-${String(MONTHS.indexOf(legacy[1]) + 1).padStart(2, "0")}-${legacy[2]}T${legacy[4]}${legacy[5]}`;
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)$/i.exec(text);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0", fraction = "", offset] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, Number(fraction.padEnd(3, "0").slice(0, 3)));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const offsetDigits = offset.slice(1).replace(":", "");
  const offsetHours = offset.toUpperCase() === "Z" ? 0 : Number(offsetDigits.slice(0, 2));
  const offsetMinutes = Number(offsetDigits.slice(2) || 0);
  if (offsetHours > 23 || offsetMinutes > 59) return null;
  const direction = offset.startsWith("-") ? -1 : 1;
  return date.getTime() - direction * (offsetHours * 60 + offsetMinutes) * 60_000;
}

export function formatOperationalDateTime(value: unknown, zone?: OperationalTimeZone): string {
  const timestamp = parseOperationalTimestamp(value);
  if (timestamp === null) return "Fecha y hora no informadas";
  const confirmed = validTimeZone(zone?.timeZone);
  const isFallback = !confirmed || zone?.isFallback !== false;
  const timeZone = isFallback ? "UTC" : confirmed!;
  const text = new Intl.DateTimeFormat("es-AR", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    timeZone, timeZoneName: "longOffset",
  }).format(timestamp).replace(/GMT(?=[+-]|$)/, "UTC").replace(/UTC$/, "UTC+00:00");
  return isFallback ? `${text} · zona no confirmada` : text;
}

export function formatReadingDateTime(event: ReadingTimestamp, zone?: OperationalTimeZone): string {
  for (const value of [event.occurredAtUtc, event.occurredAt, event.occurredAtLocal]) {
    const timestamp = parseOperationalTimestamp(value);
    if (timestamp !== null) return formatOperationalDateTime(timestamp, zone);
  }
  return "Fecha y hora no informadas";
}
