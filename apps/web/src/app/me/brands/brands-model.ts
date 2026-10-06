import type { ConsumerListSource } from "../_components/consumer-list-availability";
import type { ConsumerBrand, ConsumerPortalProduct, ConsumerTap, MarketplaceListing } from "../_components/consumer-portal-model";
import { rewardTenant } from "../_components/consumer-rewards-model";
import { reportedWalletPoints } from "../_components/consumer-wallet-points-model";
import { parseConsumerTap } from "../_components/consumer-taps-model";

/** A reported tenant slug is the scope. Names and UUIDs are never substitutes. */
export function brandTenantSlug(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,119}$/.test(value) ? value : null;
}

export function brandActivityText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
const text = brandActivityText;

export function brandTapStatus(value: unknown): string {
  return parseConsumerTap(value)?.statusLabel || "Resultado no confirmado";
}

export function membershipLabel(value: unknown) {
  const status = text(value);
  const labels: Record<string, string> = {
    active: "Membresía activa", pending: "Membresía pendiente", paused: "Membresía pausada",
    inactive: "Membresía inactiva", suspended: "Membresía suspendida", blocked: "Membresía bloqueada",
    withdrawn: "Membresía retirada", cancelled: "Membresía cancelada",
  };
  return status ? (Object.hasOwn(labels, status) ? labels[status] : `Estado reportado: ${status}`) : "Estado de membresía no informado";
}

export function brandDateLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()
    || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(date) : null;
}

function scoped<T extends { tenant_slug?: string | null }>(source: ConsumerListSource<T>, slug: string | null): ConsumerListSource<T> {
  return source.status === "ready" && slug
    ? { status: "ready", data: source.data.filter(item => brandTenantSlug(item.tenant_slug) === slug) }
    : { status: "unavailable", data: null };
}

export function buildConsumerBrands(input: {
  brands: ConsumerListSource<ConsumerBrand>; products: ConsumerListSource<ConsumerPortalProduct>;
  taps: ConsumerListSource<ConsumerTap>; listings: ConsumerListSource<MarketplaceListing>;
}) {
  if (input.brands.status === "unavailable") return { status: "unavailable" as const, items: [] };
  const identities = input.brands.data.map(brand => brandTenantSlug(brand.slug));
  const items = input.brands.data.map((brand, index) => {
    const identity = identities[index];
    // Ambiguous identities cannot borrow another membership's activity or scope.
    const slug = identity && identities.filter(candidate => candidate === identity).length === 1 ? identity : null;
    const query = slug ? new URLSearchParams({ tenant: slug }).toString() : null;
    const listings = scoped(input.listings, slug);
    const catalog: ConsumerListSource<MarketplaceListing> = listings.status === "ready"
      ? { status: "ready", data: listings.data.filter(item => (text(item.status) || text(item.stock_status)) === "active") } : listings;
    return {
      key: `brand-${index}`, slug, name: text(brand.name) || identity || "Marca no informada",
      status: membershipLabel(brand.status), balance: reportedWalletPoints(brand.points_balance), joined: brandDateLabel(brand.joined_at),
      products: scoped(input.products, slug), taps: scoped(input.taps, slug), catalog,
      links: query && slug ? {
        catalog: `/me/marketplace?${query}`, history: `/me/taps?${query}`,
        rewards: rewardTenant(slug) === slug ? `/me/rewards?${query}` : null,
      } : null,
    };
  });
  return { status: "ready" as const, items };
}

export type ConsumerBrandCard = ReturnType<typeof buildConsumerBrands>["items"][number];

export function filterConsumerBrands(items: ConsumerBrandCard[], requested: unknown) {
  if (requested === undefined || requested === "") return { state: "all" as const, slug: null, items };
  const slug = brandTenantSlug(requested);
  if (!slug) return { state: "invalid" as const, slug: null, items: [] };
  const selected = items.filter(item => item.slug === slug);
  return { state: selected.length ? "selected" as const : "missing" as const, slug, items: selected };
}
