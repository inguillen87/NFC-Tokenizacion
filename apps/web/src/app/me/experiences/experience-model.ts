type Source<T> = { status: "ready"; items: T[] } | { status: "unavailable"; items: null };
export type BrandExperience = { id: string; title: string; tenant: string | null; href: string | null };
export type ProductExperience = {
  id: string; product: string; tenant: string | null; title: string | null; body: string | null;
  rating: number | null; moderation: string; visibility: string; response: string | null;
  badges: string[]; trust: number | null;
};
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
function source<T>(envelope: Record<string, unknown> | null, key: string, project: (row: Record<string, unknown>) => T): Source<T> {
  const rows = envelope?.[key];
  if (envelope?.ok !== true || !Array.isArray(rows)) return { status: "unavailable", items: null };
  const seen = new Set<string>();
  for (const value of rows) {
    const row = record(value), id = text(row?.id);
    if (!row || !id || seen.has(id)) return { status: "unavailable", items: null };
    seen.add(id);
  }
  return { status: "ready", items: rows.map(row => project(row)) };
}
export function experienceEventId(value: unknown): string {
  return typeof value === "string" && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9_223_372_036_854_775_807n ? value : "";
}
export function experienceTenant(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9-]{1,60}$/.test(value) ? value : null;
}
export function buildExperienceModel(payload: unknown) {
  const envelope = record(payload);
  return {
    offers: source<BrandExperience>(envelope, "items", row => {
      const tenant = experienceTenant(row.tenant_slug);
      return { id: text(row.id)!, title: text(row.title) || "Propuesta sin título informado", tenant, href: tenant ? `/me/rewards?tenant=${encodeURIComponent(tenant)}` : null };
    }),
    reviews: source<ProductExperience>(envelope, "verifiedExperiences", row => ({
      id: text(row.id)!, product: text(row.product_name) || "Producto asociado", tenant: text(row.tenant_slug),
      title: text(row.title), body: text(row.body), response: text(row.brand_response),
      rating: typeof row.rating === "number" && Number.isInteger(row.rating) && row.rating >= 1 && row.rating <= 5 ? row.rating : null,
      moderation: experienceModeration(row.moderation_status), visibility: experienceVisibility(row.visibility),
      badges: Array.isArray(row.verification_badges) ? row.verification_badges.filter((badge): badge is string => typeof badge === "string" && Boolean(badge.trim())).slice(0, 4).map(experienceBadge) : [],
      trust: row.trust_score_status === "computed" && typeof row.trust_score === "number" && Number.isFinite(row.trust_score) && row.trust_score >= 0 && row.trust_score <= 100 ? row.trust_score : null,
    })),
  };
}
export function experienceModeration(value: unknown): string {
  return value === "pending" ? "En revisión" : value === "approved" ? "Aprobada por la marca" : value === "needs_brand_response" ? "Respuesta de marca pendiente" : value === "rejected" ? "No publicada" : value === "private" ? "Se mantiene privada" : "Estado no informado";
}
export function experienceVisibility(value: unknown): string {
  return value === "private" ? "Privada" : value === "public" ? "Pública" : "Visibilidad no informada";
}
function experienceBadge(value: string): string {
  const copy: Record<string, string> = {
    tap_fisico_confirmado: "Evento NFC asociado", contacto_validado: "Contacto validado", dueno_verificado: "Titularidad digital registrada",
    producto_guardado: "Producto guardado", foto_de_uso_real: "Foto aportada", nfc_event_linked: "Lectura digital asociada",
    consumer_session_authenticated: "Cuenta autenticada", digital_ownership_record_claimed: "Titularidad digital registrada",
    digital_ownership_not_claimed: "Sin titularidad digital registrada", consumer_supplied_photo: "Foto aportada",
  };
  return copy[value] || value.replace(/_/g, " ");
}
