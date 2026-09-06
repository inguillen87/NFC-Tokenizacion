import React from "react";
import { readDemoDataMetaFromPayload, readDemoDataMetaFromResponse } from "../../../../lib/demo-data-mode";
import { buildLoyaltyAdminUrl } from "./loyalty-campaign-scope";

export type CampaignAudienceChannel = "whatsapp" | "email" | "phone";
export type CampaignAudienceRequest = { tenant: string; channel: CampaignAudienceChannel; purpose: "marketing" };
export type CampaignConsentMember = {
  actorRef: string;
  contactMasked: string;
  consentedAt: string;
  lastActivityAt: string | null;
};
export type CampaignConsentAudience = CampaignAudienceRequest & {
  requiredScope: string;
  count: number;
  items: CampaignConsentMember[];
  truncated: boolean;
};

const CHANNEL_LABELS: Record<CampaignAudienceChannel, string> = { whatsapp: "WhatsApp", email: "Email", phone: "Teléfono" };
const CONSENT_SCOPES: Record<CampaignAudienceChannel, string> = {
  whatsapp: "whatsapp_marketing", email: "email_marketing", phone: "phone_marketing",
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function campaignAudienceRequestKey(request: CampaignAudienceRequest) {
  return `${request.tenant}:${request.channel}:${request.purpose}`;
}

export function buildCampaignAudienceUrl(request: CampaignAudienceRequest) {
  if (!/^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/.test(request.tenant)
    || !Object.hasOwn(CONSENT_SCOPES, request.channel) || request.purpose !== "marketing") return null;
  const endpoint = buildLoyaltyAdminUrl("campaigns/audience", request.tenant);
  return endpoint ? `${endpoint}&channel=${request.channel}&purpose=${request.purpose}&limit=100` : null;
}

/** Project only the masked contract. Extra raw contact or CRM fields never enter UI state. */
export function parseCampaignConsentAudience(payload: unknown, expected: CampaignAudienceRequest): CampaignConsentAudience {
  const envelope = record(payload);
  const audience = record(envelope?.audience);
  const invalid = () => new Error("campaign_audience_contract_invalid");
  if (!buildCampaignAudienceUrl(expected) || envelope?.ok !== true || !audience) throw invalid();
  if (audience.tenant !== expected.tenant) throw new Error("tenant_scope_mismatch");
  if (audience.channel !== expected.channel || audience.purpose !== expected.purpose
    || audience.requiredScope !== CONSENT_SCOPES[expected.channel]) throw new Error("campaign_audience_scope_mismatch");
  if (typeof audience.count !== "number" || !Number.isSafeInteger(audience.count) || audience.count < 0
    || !Array.isArray(audience.items) || audience.items.length > 200 || audience.count < audience.items.length
    || (audience.count > 0 && audience.items.length === 0)
    || audience.truncated !== (audience.count > audience.items.length)) throw invalid();
  const validDate = (value: unknown): value is string => typeof value === "string"
    && value.trim() !== "" && Number.isFinite(Date.parse(value));
  const seen = new Set<string>();
  const items = audience.items.map((value): CampaignConsentMember => {
    const item = record(value);
    if (!item || typeof item.actorRef !== "string" || !/^actor-[a-f0-9]{20}$/.test(item.actorRef)
      || seen.has(item.actorRef) || typeof item.contactMasked !== "string" || item.contactMasked.length > 320
      || !validDate(item.consentedAt) || (item.lastActivityAt !== null && !validDate(item.lastActivityAt))) throw invalid();
    // The API may return an empty mask for a stored address it cannot mask. Never fall back to raw contact.
    const maskIsValid = item.contactMasked === "" || (expected.channel === "email"
      ? /^[^@\s]{1,2}\*{2,}@[^@\s]+$/.test(item.contactMasked)
      : /^(?:\+\d{3}\*{3}\d{4}|\*{3})$/.test(item.contactMasked));
    if (!maskIsValid) throw invalid();
    seen.add(item.actorRef);
    return { actorRef: item.actorRef, contactMasked: item.contactMasked, consentedAt: item.consentedAt, lastActivityAt: item.lastActivityAt };
  });
  return { ...expected, requiredScope: CONSENT_SCOPES[expected.channel], count: audience.count, items, truncated: audience.truncated as boolean };
}

const AUDIENCE_ERROR_COPY: Record<string, string> = {
  tenant_scope_required: "Seleccioná un tenant autorizado para consultar su audiencia.",
  tenant_scope_mismatch: "La respuesta no corresponde al tenant seleccionado. Los contactos se ocultaron.",
  campaign_audience_scope_mismatch: "La respuesta no corresponde al canal y finalidad seleccionados. Los contactos se ocultaron.",
  campaign_audience_contract_invalid: "La fuente devolvió un formato no válido. No se mostrarán contactos hasta verificarlo.",
  demo_audience_not_allowed: "La fuente devolvió datos demo. No se aceptan como audiencia real.",
  campaign_audience_unauthorized: "La sesión no permite consultar esta audiencia. Volvé a iniciar sesión.",
  campaign_audience_forbidden: "Tu rol no tiene acceso a la audiencia de este tenant. Consultá a su administrador.",
  campaign_audience_tenant_required: "Falta un tenant autorizado para la consulta.",
  campaign_audience_tenant_invalid: "El tenant de la consulta no es válido.",
  campaign_audience_channel_invalid: "El canal solicitado no es válido.",
  campaign_audience_purpose_invalid: "La finalidad solicitada no está disponible.",
  campaign_audience_tenant_not_found: "No se encontró el tenant autorizado en la fuente.",
  campaign_audience_integrity_violation: "La fuente no pudo confirmar la integridad de los consentimientos. Los contactos se ocultaron.",
  campaign_audience_unavailable: "La fuente no está disponible. Podés volver a consultar sin perder el borrador.",
};

export function campaignAudienceErrorCopy(reason: string) {
  return AUDIENCE_ERROR_COPY[reason] || AUDIENCE_ERROR_COPY.campaign_audience_unavailable;
}

export async function loadCampaignConsentAudience(
  request: CampaignAudienceRequest,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
) {
  const endpoint = buildCampaignAudienceUrl(request);
  if (!endpoint) throw new Error("tenant_scope_required");
  const response = await (options.fetcher || fetch)(endpoint, { cache: "no-store", signal: options.signal });
  const payload: unknown = await response.json().catch(() => null);
  if (campaignAudienceIsDemo(response, payload)) throw new Error("demo_audience_not_allowed");
  if (!response.ok) {
    const reason = record(payload)?.reason;
    const code = response.status === 401 ? "campaign_audience_unauthorized"
      : response.status === 403 ? "campaign_audience_forbidden"
        : typeof reason === "string" && Object.hasOwn(AUDIENCE_ERROR_COPY, reason) ? reason : "campaign_audience_unavailable";
    throw new Error(code);
  }
  return parseCampaignConsentAudience(payload, request);
}

export function CampaignConsentAudiencePanel({ audience, request, loading, error, onChannelChange, onRefresh }: {
  audience: CampaignConsentAudience | null;
  request: CampaignAudienceRequest;
  loading: boolean;
  error: string | null;
  onChannelChange: (channel: CampaignAudienceChannel) => void;
  onRefresh: () => void;
}) {
  const [visibleCount, setVisibleCount] = React.useState(8);
  const confirmed = !loading && !error && audience && campaignAudienceRequestKey(audience) === campaignAudienceRequestKey(request) ? audience : null;
  return <section className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100" aria-label="Audiencia con consentimiento" aria-busy={loading}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-bold">Audiencia con consentimiento</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Fuente: consentimientos persistidos del tenant · finalidad Marketing. Contactos protegidos, sin datos personales completos.</p>
      </div>
      <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
        <label className="min-w-0 flex-1 text-xs font-semibold sm:flex-none">Canal de la audiencia
          <select value={request.channel} onChange={(event) => onChannelChange(event.target.value as CampaignAudienceChannel)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white">
            {Object.entries(CHANNEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" disabled={loading || !request.tenant} onClick={onRefresh} className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800">Volver a consultar</button>
      </div>
    </div>
    <div role="status" aria-live="polite">
      {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Consultando audiencia autorizada…</p>
        : error ? <div data-testid="loyalty-audience-unavailable" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          {campaignAudienceErrorCopy(error)} No se interpreta la falla como cero clientes. El borrador local se conserva.
        </div> : confirmed ? <div className="grid gap-3 sm:grid-cols-3">
          <div><div className="text-2xl font-bold">{confirmed.count.toLocaleString("es-AR")}</div><div className="text-xs text-slate-600 dark:text-slate-300">Contactos elegibles · {CHANNEL_LABELS[request.channel]}</div></div>
          <div><div className="text-2xl font-bold">{confirmed.items.length.toLocaleString("es-AR")}</div><div className="text-xs text-slate-600 dark:text-slate-300">{confirmed.truncated ? "Muestra recibida · total mayor" : "Contactos recibidos · muestra completa"}</div></div>
          <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">Membresía activa y consentimiento específico sin revocación al consultar. No equivale a una campaña aprobada ni a una entrega.</div>
        </div> : <p className="text-sm">Seleccioná un tenant autorizado para consultar.</p>}
    </div>
    {confirmed?.count === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">La fuente confirmó que no hay contactos elegibles para {CHANNEL_LABELS[request.channel]} y Marketing. No se reemplazan con perfiles demo ni con lecturas NFC.</p> : null}
    {confirmed && confirmed.items.length > 0 ? <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {confirmed.items.slice(0, visibleCount).map((member) => <li key={member.actorRef} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="break-all text-sm font-semibold">{member.contactMasked || "Contacto no disponible"}</p>
          <dl className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <div><dt className="inline">Consentimiento: </dt><dd className="inline">{new Date(member.consentedAt).toLocaleDateString("es-AR", { timeZone: "UTC" })}</dd></div>
            <div><dt className="inline">Última actividad: </dt><dd className="inline">{member.lastActivityAt ? new Date(member.lastActivityAt).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "No informada"}</dd></div>
          </dl>
        </li>)}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
        <p>Mostrando {Math.min(visibleCount, confirmed.items.length)} de {confirmed.items.length} contactos recibidos; total elegible: {confirmed.count}.</p>
        {visibleCount < confirmed.items.length ? <button type="button" onClick={() => setVisibleCount((value) => value + 20)} className="min-h-11 rounded-lg border border-slate-300 px-3 font-semibold dark:border-slate-600">Ver más de la muestra</button> : null}
      </div>
    </> : null}
    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">Esta fuente no informa nombres, ciudades, puntos ni productos. Un contacto enmascarado no se usa como destinatario de envío.</p>
  </section>;
}

export interface AudienceMember {
  consumer_id?: string | null;
  display_name?: string | null;
  email_masked?: string | null;
  phone_masked?: string | null;
  city?: string | null;
  country?: string | null;
  tenant_slug?: string | null;
  status?: string | null;
  points_balance?: number | string | null;
  lifetime_points?: number | string | null;
  tap_count?: number | string | null;
  valid_taps?: number | string | null;
  risk_taps?: number | string | null;
  saved_products?: number | string | null;
  last_product?: string | null;
  marketing_opt_in?: boolean | null;
  whatsapp_opt_in?: boolean | null;
  segment?: string | null;
  last_tap_at?: string | null;
}

const TEXT_FIELDS = ["consumer_id", "display_name", "email_masked", "phone_masked", "city", "country", "tenant_slug", "status", "last_product", "segment", "last_tap_at"] as const;
const NUMBER_FIELDS = ["points_balance", "lifetime_points", "tap_count", "valid_taps", "risk_taps", "saved_products"] as const;

/** Missing identity is a valid source limitation, not a generated consumer ID. */
export function parseCampaignAudienceRows(value: unknown): AudienceMember[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return TEXT_FIELDS.every((key) => item[key] == null || typeof item[key] === "string")
      && NUMBER_FIELDS.every((key) => item[key] == null
        || (typeof item[key] === "number" && Number.isFinite(item[key]))
        || (typeof item[key] === "string" && item[key].trim() !== "" && Number.isFinite(Number(item[key]))))
      && ["marketing_opt_in", "whatsapp_opt_in"].every((key) => item[key] == null || typeof item[key] === "boolean");
  })) return null;
  return value as AudienceMember[];
}

export function campaignAudienceIsDemo(response: Response, payload: unknown) {
  const envelope = record(payload);
  const audience = record(envelope?.audience);
  const items = [envelope?.items, audience?.items].flatMap((value) => Array.isArray(value) ? value : []);
  const hasDeclaredDemoRows = items.some((item) => item && typeof item === "object"
    && String(item.data_provenance || "").trim().toLowerCase() === "declared_demo");
  return readDemoDataMetaFromResponse(response).demoMode
    || readDemoDataMetaFromPayload(payload).demoMode
    || readDemoDataMetaFromPayload(audience).demoMode
    || hasDeclaredDemoRows;
}

export function campaignAudienceRowKey(member: AudienceMember, index: number) {
  // A render-only fallback: never copied into the member or used as an actor ID.
  return member.consumer_id?.trim() || `audience-row:${index}`;
}

export function CampaignAudienceIdentity({ member }: { member: AudienceMember }) {
  const label = member.display_name?.trim() || "Perfil sin nombre informado";
  const contact = member.email_masked?.trim()
    || member.consumer_id?.trim().slice(0, 8)
    || "Identificador de contacto no disponible";
  return <>
    <div className="truncate text-sm font-bold text-white">{label}</div>
    <div className="truncate text-[10px] text-slate-500">{contact}</div>
  </>;
}
