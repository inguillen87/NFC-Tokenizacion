import { normalizeSafeReturnPath } from "@product/config/safe-return-path";

const ROUTES = new Set([
  "/me", "/me/products", "/me/passport", "/me/brands", "/me/wallet", "/me/marketplace",
  "/me/rewards", "/me/experiences", "/me/sommelier", "/me/taps", "/me/privacy", "/me/security", "/me/cork-analyzer",
]);
const ACTIONS = new Set(["products", "save", "join", "claim", "rewards", "register", "wallet", "passport", "marketplace", "experiences", "sommelier"]);
const QUERY_KEYS = ["fromTap", "eventId", "focus", "bid", "tenant", "action"] as const;

function readingId(value: string) {
  return /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
}

/** Email may carry a route selection, never a TAP capability or device data.
 * The destination still requires a session and an explicit authorized action.
 * Keep this contract aligned with the independently released API normalizer.
 */
export function normalizeConsumerAuthReturnPath(value: unknown): string {
  const url = new URL(normalizeSafeReturnPath(value, "/me"), "https://return.nexid.invalid");
  const readingPath = /^\/me\/taps\/([1-9][0-9]{0,18})$/.exec(url.pathname);
  if (!ROUTES.has(url.pathname) && !(readingPath && readingId(readingPath[1]))) return "/me";
  const query = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const values = url.searchParams.getAll(key);
    if (!values.length) continue;
    if (values.length !== 1) return "/me";
    const item = values[0];
    const valid = key === "fromTap" ? item === "1"
      : key === "eventId" || key === "focus" ? readingId(item)
      : key === "bid" ? /^[A-Za-z0-9._:-]{1,200}$/.test(item)
      : key === "tenant" ? /^[A-Za-z0-9_-]{1,120}$/.test(item)
      : ACTIONS.has(item);
    if (!valid) return "/me";
    query.set(key, item);
  }
  return url.pathname + (query.size ? `?${query.toString()}` : "");
}

export function consumerAuthStartPayload(contact: { email: string } | { phone: string }, next: unknown) {
  const continuation = normalizeConsumerAuthReturnPath(next);
  return "email" in contact && continuation !== "/me" ? { ...contact, next: continuation } : contact;
}
