const STORAGE_KEY = "nexid:marketplace:pending-draft:v1";
const TTL_MS = 15 * 60 * 1000;
const MAX_LINES = 100;
const MAX_BYTES = 20_000;
const LISTING_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const SCOPE = /^[a-z0-9_-]{43}$/i;

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Draft = Record<string, number>;
type ListingAvailability = { id: string; status?: string; stock_status?: string; request_to_buy_enabled?: boolean };

export function canRequestMarketplaceListing(listing: ListingAvailability) {
  const status = String(listing.stock_status || listing.status || "").toLowerCase();
  return listing.request_to_buy_enabled === true && ["available", "active", "in_stock"].includes(status);
}

function validQuantity(quantity: unknown): quantity is number {
  return typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0 && quantity <= 24;
}

export function storeMarketplaceSessionDraft(scope: string, cart: Draft, attempted: ReadonlySet<string>, storage?: DraftStorage, now = Date.now()) {
  if (!SCOPE.test(scope)) return 0;
  const lines = Object.entries(cart).filter(([id, quantity]) => LISTING_ID.test(id) && validQuantity(quantity) && !attempted.has(id));
  try {
    const target = storage ?? window.sessionStorage;
    target.removeItem(STORAGE_KEY);
    if (!lines.length) return 0;
    if (lines.length > MAX_LINES) return null;
    target.setItem(STORAGE_KEY, JSON.stringify({ scope, expiresAt: now + TTL_MS, lines }));
    return lines.length;
  } catch {
    return null;
  }
}

export function takeMarketplaceSessionDraft(scope: string, listings: readonly ListingAvailability[], storage?: DraftStorage, now = Date.now()): Draft | null {
  if (!SCOPE.test(scope)) return null;
  try {
    const target = storage ?? window.sessionStorage;
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return null;
    target.removeItem(STORAGE_KEY);
    if (raw.length > MAX_BYTES) return null;
    const draft = JSON.parse(raw);
    if (!draft || draft.scope !== scope || !Number.isSafeInteger(draft.expiresAt) || draft.expiresAt <= now
      || draft.expiresAt > now + TTL_MS || !Array.isArray(draft.lines) || draft.lines.length > MAX_LINES) return null;
    const eligible = new Map<string, boolean>();
    for (const listing of listings) {
      eligible.set(listing.id, !eligible.has(listing.id) && canRequestMarketplaceListing(listing));
    }
    const restored: [string, number][] = [];
    const seen = new Set<string>();
    for (const line of draft.lines) {
      if (!Array.isArray(line) || line.length !== 2 || typeof line[0] !== "string" || !LISTING_ID.test(line[0])
        || !validQuantity(line[1]) || seen.has(line[0])) return null;
      seen.add(line[0]);
      if (eligible.get(line[0])) restored.push([line[0], line[1]]);
    }
    return Object.fromEntries(restored);
  } catch {
    return null;
  }
}

export function clearMarketplaceSessionDraft(storage?: DraftStorage) {
  try { (storage ?? window.sessionStorage).removeItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
}
