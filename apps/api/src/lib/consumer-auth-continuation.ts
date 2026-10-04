import { normalizeSafeReturnPath } from "../../../../packages/config/src/safe-return-path";

const RETURN_BASE = "https://return.nexid.invalid";
const MAX_EVENT_ID = 9_223_372_036_854_775_807n;
const CONSUMER_RETURN_PATHS = new Set([
  "/me", "/me/products", "/me/passport", "/me/brands", "/me/wallet", "/me/marketplace",
  "/me/rewards", "/me/experiences", "/me/sommelier", "/me/taps", "/me/privacy",
  "/me/security", "/me/cork-analyzer",
]);
const RETURN_ACTIONS = new Set([
  "products", "save", "join", "claim", "rewards", "register", "wallet", "passport",
  "marketplace", "experiences", "sommelier",
]);
const RETURN_QUERY_KEYS = ["fromTap", "eventId", "focus", "bid", "tenant", "action"] as const;

function isEventId(value: string) {
  return /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= MAX_EVENT_ID;
}

function isQueryValue(key: typeof RETURN_QUERY_KEYS[number], value: string) {
  if (key === "fromTap") return value === "1";
  if (key === "eventId" || key === "focus") return isEventId(value);
  if (key === "bid") return /^[A-Za-z0-9._:-]{1,200}$/.test(value);
  if (key === "tenant") return /^[A-Za-z0-9_-]{1,120}$/.test(value);
  return RETURN_ACTIONS.has(value);
}

/** Selection metadata only; these references confer no product or tap authority. */
export function normalizeConsumerAuthReturnPath(value: unknown): string {
  const url = new URL(normalizeSafeReturnPath(value, "/me"), RETURN_BASE);
  const tapId = url.pathname.startsWith("/me/taps/") ? url.pathname.slice("/me/taps/".length) : "";
  if (!CONSUMER_RETURN_PATHS.has(url.pathname) && !isEventId(tapId)) return "/me";

  const query = new URLSearchParams();
  for (const key of RETURN_QUERY_KEYS) {
    const values = url.searchParams.getAll(key);
    if (values.length > 1 || (values.length === 1 && !isQueryValue(key, values[0]))) return "/me";
    if (values.length === 1) query.set(key, values[0]);
  }
  // Drop unknown query parameters and fragments, including signed NFC values,
  // precise location, contact details and nested return destinations.
  return `${url.pathname}${query.size ? `?${query.toString()}` : ""}`;
}
