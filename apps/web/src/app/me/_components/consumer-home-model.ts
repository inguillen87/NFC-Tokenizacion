export type HomeSource<T> = { status: "ready"; data: T } | { status: "unavailable"; data: null };
export type HomeAccount = { name: string | null; email: string | null; status: string | null; products: number | null; taps: number | null };
export type HomeProduct = {
  name: string; brand: string | null; tenantSlug: string | null; batch: string | null; imageUrl: string | null;
  eventId: string | null; readingHref: string | null; ownershipStatus: string | null;
  savedAt: { date: string; dateTime: string | null }; latestAt: { date: string; dateTime: string | null };
  latestVerdict: string | null; latestLocation: string | null;
};
export type HomeTap = { id: string | null; brand: string | null; location: string | null; verdict: string | null; date: string; dateTime: string | null; href: string | null };
export type HomeBrand = { name: string; status: string | null; points: number | null; href: string };
export type ConsumerHomeModel = { account: HomeSource<HomeAccount>; products: HomeSource<HomeProduct[]>; taps: HomeSource<HomeTap[]>; brands: HomeSource<HomeBrand[]> };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function reportedHomeCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function eventId(value: unknown): string | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  const id = text(value);
  if (id && /^-?\d+(?:\.\d+)?$/.test(id)) return Number.isSafeInteger(Number(id)) && Number(id) > 0 ? id : null;
  return id && id.length <= 160 && !/[\u0000-\u001f\u007f]/.test(id) ? id : null;
}

export function homeReadingHref(value: unknown): string | null {
  const id = eventId(value);
  return id ? `/certificado/${encodeURIComponent(id)}` : null;
}

export function homeImageUrl(value: unknown): string | null {
  const url = text(value);
  if (!url || /[\u0000-\u0020\\]/.test(url)) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : null;
  } catch { return null; }
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC", hourCycle: "h23" });

function homeDate(value: unknown): { date: string; dateTime: string | null } {
  const raw = text(value)?.replace(/^(\d{4}-\d{2}-\d{2})\s/, "$1T").replace(/([+-]\d{2})$/, "$1:00").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  // No device time zone is present in this payload. Unzoned timestamps must
  // never inherit the server/browser locale during hydration.
  if (!raw || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) return { date: "Fecha no informada", dateTime: null };
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? { date: dateFormatter.format(date), dateTime: date.toISOString() } : { date: "Fecha no informada", dateTime: null };
}

function listSource<T>(payload: unknown, project: (item: Record<string, unknown>) => T): HomeSource<T[]> {
  const envelope = record(payload);
  if (envelope?.ok !== true || !Array.isArray(envelope.items) || !envelope.items.every(record)) return { status: "unavailable", data: null };
  return { status: "ready", data: envelope.items.map((item) => project(item as Record<string, unknown>)) };
}

export function buildConsumerHomeModel(payloads: { account: unknown; products: unknown; taps: unknown; brands: unknown }): ConsumerHomeModel {
  const envelope = record(payloads.account);
  const consumer = record(envelope?.consumer);
  const stats = record(envelope?.stats);
  const email = text(consumer?.email);
  const displayName = text(consumer?.display_name);
  const account: HomeSource<HomeAccount> = envelope?.ok === true && consumer
    ? { status: "ready", data: {
      name: displayName?.toLowerCase() === email?.toLowerCase() ? null : displayName,
      email, status: text(consumer.status),
      // Account counts are only supplied by /consumer/me. A limited history
      // response is not a lifetime total; a missing count is not zero.
      products: reportedHomeCount(stats?.products), taps: reportedHomeCount(stats?.taps),
    } } : { status: "unavailable", data: null };
  return {
    account,
    products: buildHomeProductsSource(payloads.products),
    taps: listSource(payloads.taps, (item) => ({
      id: eventId(item.tap_event_id), brand: text(item.tenant_slug),
      location: [text(item.city), text(item.country)].filter(Boolean).join(", ") || null,
      verdict: text(item.verdict), ...homeDate(item.created_at), href: homeReadingHref(item.tap_event_id),
    })),
    brands: listSource(payloads.brands, (item) => {
      const slug = text(item.slug);
      return { name: text(item.name) || slug || "Marca sin nombre reportado", status: text(item.status), points: reportedHomeCount(item.points_balance), href: slug ? `/me/marketplace?tenant=${encodeURIComponent(slug)}` : "/me/brands" };
    }),
  };
}

export function buildHomeProductsSource(payload: unknown): HomeSource<HomeProduct[]> {
  return listSource(payload, (item) => ({
    name: text(item.product_name) || "Producto sin nombre reportado",
    brand: text(item.brand_name) || text(item.tenant_slug), tenantSlug: text(item.tenant_slug), batch: text(item.bid),
    imageUrl: homeImageUrl(item.image_url),
    eventId: eventId(item.latest_tap_event_id) || eventId(item.first_tap_event_id),
    readingHref: homeReadingHref(item.latest_tap_event_id) || homeReadingHref(item.first_tap_event_id),
    ownershipStatus: text(item.ownership_record_status) || text(item.ownership_status),
    savedAt: homeDate(item.created_at), latestAt: homeDate(item.latest_tap_at),
    latestVerdict: text(item.latest_verdict),
    latestLocation: [text(item.latest_city), text(item.latest_country)].filter(Boolean).join(", ") || null,
  }));
}

export function homeProductExperienceHref(product: HomeProduct): string | null {
  if (!product.eventId || !product.tenantSlug) return null;
  const query = new URLSearchParams({ tenant: product.tenantSlug, eventId: product.eventId, product: product.name });
  return `/me/experiences?${query}`;
}

export function homeOwnershipLabel(status: string | null): string {
  switch (status?.toLowerCase()) {
    case "claimed": return "Titularidad digital registrada";
    case "viewed": return "Producto consultado";
    case "pending": return "Solicitud pendiente";
    case "revoked": return "Registro revocado";
    case "blocked_replay": return "Registro bloqueado";
    default: return status ? `Estado: ${status}` : "Estado no informado";
  }
}

export function homeVerdictLabel(verdict: string | null): string {
  switch (verdict?.toUpperCase()) {
    case "VALID_CLOSED": return "Sello cerrado reportado";
    case "VALID_OPENED": return "Sello abierto reportado";
    case "VALID": return "Mensaje validado";
    default: return verdict || "Estado no informado";
  }
}

export function homeMembershipLabel(status: string | null): string {
  switch (status?.toLowerCase()) {
    case "active": return "Membresía activa";
    case "pending": return "Membresía pendiente";
    case "inactive": return "Membresía inactiva";
    case "revoked": return "Membresía revocada";
    default: return status ? `Estado: ${status}` : "Estado no informado";
  }
}
