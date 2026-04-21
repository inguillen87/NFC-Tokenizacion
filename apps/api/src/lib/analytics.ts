export type ScanSource = "real" | "demo" | "imported";
export type TimeRange = "24h" | "7d" | "30d";

const VALID_SOURCES = new Set<ScanSource>(["real", "demo", "imported"]);
const VALID_RANGES = new Set<TimeRange>(["24h", "7d", "30d"]);

export function parseAnalyticsFilters(searchParams: URLSearchParams) {
  const tenant = (searchParams.get("tenant") || "").trim();
  const country = (searchParams.get("country") || "").trim().toUpperCase();

  const sourceParam = (searchParams.get("source") || "").trim().toLowerCase() as ScanSource | "";
  const source = VALID_SOURCES.has(sourceParam as ScanSource)
    ? (sourceParam as ScanSource)
    : (tenant ? "real" : "");

  const rangeParam = (searchParams.get("range") || "").trim().toLowerCase() as TimeRange | "";
  const range = VALID_RANGES.has(rangeParam as TimeRange) ? (rangeParam as TimeRange) : "30d";
  const rangeSql = range === "24h" ? "24 hours" : range === "7d" ? "7 days" : "30 days";

  return { tenant, source, range, rangeSql, country };
}

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isMobileSignal(mobile: unknown, userAgent?: unknown, platform?: unknown, deviceLabel?: unknown) {
  const mobileRaw = normalizeText(mobile);
  if (["true", "1", "yes"].includes(mobileRaw)) return true;
  const ua = normalizeText(userAgent);
  const pf = normalizeText(platform);
  const dl = normalizeText(deviceLabel);
  return /mobile|iphone|android/.test(ua) || /iphone|android|mobile|ipad/.test(pf) || /mobile|iphone|android/.test(dl);
}

export function normalizeOs(input: { platform?: unknown; userAgent?: unknown; deviceLabel?: unknown }) {
  const platform = normalizeText(input.platform);
  const ua = normalizeText(input.userAgent);
  const label = normalizeText(input.deviceLabel);
  const merged = `${platform} ${ua} ${label}`;
  if (/ios|iphone|ipad/.test(merged)) return "iOS";
  if (/android/.test(merged)) return "Android";
  if (/windows/.test(merged)) return "Windows";
  if (/mac os|macintosh|macos/.test(merged)) return "macOS";
  if (/linux/.test(merged)) return "Linux";
  return "Unknown";
}

export function normalizeBrowser(input: { browser?: unknown; userAgent?: unknown; platform?: unknown; mobile?: unknown }) {
  const browser = normalizeText(input.browser);
  const ua = normalizeText(input.userAgent);
  const merged = `${browser} ${ua}`;
  const mobile = isMobileSignal(input.mobile, input.userAgent, input.platform);
  if (/edg|edge/.test(merged)) return mobile ? "Edge Mobile" : "Edge";
  if (/crios|chrome/.test(merged)) return mobile ? "Chrome Mobile" : "Chrome";
  if (/fxios|firefox/.test(merged)) return mobile ? "Firefox Mobile" : "Firefox";
  if (/safari/.test(merged) && !/chrome|crios|chromium/.test(merged)) return mobile ? "Safari Mobile" : "Safari";
  if (/samsung/.test(merged)) return "Samsung Internet";
  return "Unknown";
}

export function normalizeDeviceType(input: { mobile?: unknown; userAgent?: unknown; platform?: unknown; deviceLabel?: unknown }) {
  if (isMobileSignal(input.mobile, input.userAgent, input.platform, input.deviceLabel)) return "Mobile";
  const ua = normalizeText(input.userAgent);
  if (/tablet|ipad/.test(ua)) return "Tablet";
  return "Desktop";
}

export function normalizeTimezone(value: unknown) {
  const tz = String(value || "").trim();
  return tz || "Unknown";
}

export function addBucket(map: Map<string, number>, key: string, increment = 1) {
  map.set(key, (map.get(key) || 0) + increment);
}

export function toSortedBuckets(map: Map<string, number>, limit = 8) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}
