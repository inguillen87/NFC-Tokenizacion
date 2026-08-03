import { SectionHeading } from "@product/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EnterpriseOpsState } from "../../../components/enterprise-ops-state";
import { createAdminPageContext, fetchAdminPage } from "../../../lib/admin-page-access";
import {
  parseRiskAnalyticsPayload,
  type RiskKpis,
} from "../../../lib/risk-analytics-contract";
import { dashboardCanReadSensitiveRiskAnalytics } from "../../../lib/permission-policy";
import { requireDashboardSession } from "../../../lib/session";

const KPI_CARDS: Array<{
  key: keyof RiskKpis;
  label: string;
  detail: string;
  tone?: "default" | "risk" | "good";
}> = [
  { key: "valid_taps", label: "Taps válidos", detail: "Mensajes NFC con resultado válido en la ventana.", tone: "good" },
  { key: "unique_units", label: "Unidades únicas", detail: "Tags o UID hasheados observados; nunca expone UID crudo." },
  { key: "replay_events", label: "Replay", detail: "Replays y duplicados detectados por resultado o regla.", tone: "risk" },
  { key: "invalid_auth_events", label: "Auth inválida", detail: "Fallas SUN/CMAC, registro, actividad o revocación.", tone: "risk" },
  { key: "never_scanned_units_lifetime", label: "Nunca escaneadas", detail: "Inventario lifetime del scope; no depende de la ventana temporal." },
  { key: "tamper_events", label: "Señales tamper", detail: "Estados electrónicos reportados; no certifican el producto físico.", tone: "risk" },
  { key: "geo_anomalies", label: "Anomalías geo", detail: "Regla explicable de viaje imposible o anomalía geográfica.", tone: "risk" },
  { key: "content_adoption_events", label: "Adopción de contenido", detail: "Vistas técnicas, seguridad, PPE, stewardship y training." },
  { key: "cropwise_cta_clicks", label: "CTA Cropwise", detail: "Clicks registrados; no implica integración nativa ni conversión." },
  { key: "registrations_and_leads", label: "Registros y leads", detail: "Sólo outcomes persistidos por workflows autorizados." },
  { key: "training_completions", label: "Training completado", detail: "Finalizaciones autoritativas, no clicks de intención." },
  { key: "webhook_delivery_rate_pct", label: "Salud webhooks", detail: "Entregas exitosas sobre intentos del tenant y ventana." },
  { key: "risk_coverage_pct", label: "Cobertura de riesgo", detail: "Porcentaje de eventos clasificados con el perfil nexID Risk v1." },
];

const FILTER_KEYS = ["sku", "product", "batch", "lot", "region", "distributor", "riskLevel", "from", "to", "carrier", "limit"] as const;

function safeFilter(value: unknown, max = 160) {
  const normalized = String(value || "").trim();
  return normalized.slice(0, max);
}

function displayKpi(key: keyof RiskKpis, value: number | null) {
  if (key === "risk_coverage_pct" && value === null) return "Sin eventos";
  if (["webhook_delivery_rate_pct", "risk_event_rate_pct", "risk_coverage_pct"].includes(key)) {
    return value === null ? "Sin cobertura" : `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
  }
  return value === null ? "Sin cobertura" : value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function apiFilterValue(key: (typeof FILTER_KEYS)[number], value: string) {
  if ((key === "from" || key === "to") && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    return `${value}${value.length === 16 ? ":00" : ""}Z`;
  }
  return value;
}

async function loadRiskAnalytics(context: Awaited<ReturnType<typeof createAdminPageContext>>, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = safeFilter(query[key]);
    if (value) params.set(key, apiFilterValue(key, value));
  }
  const response = await fetchAdminPage(context, `risk-analytics?${params.toString()}`).catch(() => null);
  if (!response) return { payload: null, status: 0, reason: "sin_conexión" };
  const raw = await response.json().catch(() => null) as Record<string, unknown> | null;
  const payload = parseRiskAnalyticsPayload(raw);
  return {
    payload,
    status: response.status,
    reason: payload ? "" : String(raw?.reason || (response.ok ? "risk_analytics_contract_invalid" : `HTTP_${response.status}`)),
  };
}

export default async function RiskAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireDashboardSession();
  if (!dashboardCanReadSensitiveRiskAnalytics(
    session.role,
    session.permissions,
    session.deniedPermissions,
  )) notFound();
  const query = await searchParams;
  const context = await createAdminPageContext(session, query.tenant);
  const { payload, status, reason } = await loadRiskAnalytics(context, query);
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, safeFilter(query[key])])) as Record<(typeof FILTER_KEYS)[number], string>;
  const confirmedPayload = payload || undefined;

  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Enterprise Risk Operations"
        title="Risk Analytics explicable"
        description="Señales multi-tenant con filtros reproducibles, reglas auditables y límites de evidencia visibles. Un tap válido prueba el mensaje NFC; no certifica por sí solo el producto físico."
      />

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <form aria-label="Filtros enterprise de riesgo" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {context.canSelectTenant ? <Filter name="tenant" label="Tenant" value={safeFilter(query.tenant)} placeholder="slug o UUID" /> : null}
          <Filter name="sku" label="SKU" value={filters.sku} />
          <Filter name="product" label="Producto" value={filters.product} />
          <Filter name="batch" label="Batch / BID" value={filters.batch} />
          <Filter name="lot" label="Lote" value={filters.lot} />
          <Filter name="region" label="Región" value={filters.region} />
          <Filter name="distributor" label="Distribuidor" value={filters.distributor} />
          <label className="grid gap-1.5 text-xs font-bold text-slate-300">
            Nivel de riesgo
            <select name="riskLevel" defaultValue={filters.riskLevel} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white">
              <option value="">Todos</option>
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <Filter name="from" label="Desde (UTC)" value={filters.from} type="datetime-local" />
          <Filter name="to" label="Hasta (UTC)" value={filters.to} type="datetime-local" />
          <label className="grid gap-1.5 text-xs font-bold text-slate-300">
            Carrier
            <select name="carrier" defaultValue={filters.carrier} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white">
              <option value="">Todos</option>
              <option value="ntag424_dna">NTAG 424 DNA</option>
              <option value="ntag424_dna_tt">NTAG 424 DNA TT</option>
              <option value="ntag213">NTAG 213</option>
              <option value="ntag215">NTAG 215</option>
              <option value="ntag216">NTAG 216</option>
              <option value="gs1_digital_link">GS1 Digital Link QR</option>
              <option value="qr_basic">QR básico</option>
              <option value="uhf_rfid">UHF RFID</option>
              <option value="event_wristband">Pulsera de evento</option>
              <option value="hotel_keycard">Tarjeta hotelera</option>
              <option value="iot_tracker_placeholder">Tracker IoT (placeholder)</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-300">
            Eventos visibles
            <select name="limit" defaultValue={filters.limit || "100"} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white">
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="min-h-11 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Aplicar</button>
            <Link href="/risk-analytics" className="grid min-h-11 place-items-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">Limpiar</Link>
          </div>
        </form>
      </section>

      {!confirmedPayload ? (
        <EnterpriseOpsState
          variant="error"
          title="Risk Analytics no está disponible"
          description={`El upstream no confirmó un dataset válido (${reason || (status ? `HTTP ${status}` : "sin conexión")}). No se muestran ceros falsos.`}
          checklist={["Confirmar reports.export, events.read_sensitive y scope del tenant.", "Aplicar la migración enterprise 0096 en el entorno destino.", "Reintentar sin ampliar permisos desde el navegador."]}
          action={<Link href="/risk-analytics" className="rounded-xl border border-white/15 px-3 py-2 text-sm font-bold text-white">Reintentar</Link>}
        />
      ) : (
        <>
          <section aria-label="KPIs enterprise de riesgo" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_CARDS.map((card) => (
              <article key={card.key} className={`rounded-2xl border p-4 ${card.tone === "risk" ? "border-rose-300/25 bg-rose-400/[0.05]" : card.tone === "good" ? "border-emerald-300/25 bg-emerald-400/[0.05]" : "border-white/10 bg-slate-900/60"}`}>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
                <p className="mt-2 text-3xl font-black text-white">{displayKpi(card.key, confirmedPayload.kpis[card.key])}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{card.detail}</p>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs leading-5 text-slate-400">
            <strong className="text-white">Scopes de cálculo:</strong> eventos = filtros y ventana UTC seleccionados; nunca escaneadas = inventario lifetime que coincide con tenant/SKU/producto/batch/región/carrier; webhooks = tenant y ventana temporal; riesgo = únicamente eventos clasificados con nexID Risk v1. Los clicks de CTA no se presentan como conversiones.
          </section>

          {confirmedPayload.kpis.risk_unscored_events > 0 ? (
            <EnterpriseOpsState
              variant="warning"
              title="Cobertura histórica de riesgo incompleta"
              description={`${confirmedPayload.kpis.risk_unscored_events.toLocaleString("es-AR")} evento(s) de esta ventana todavía no fueron recalculados con nexID Risk v1. Las tasas y promedios de riesgo excluyen esos eventos; los demás KPIs conservan su scope declarado.`}
              checklist={["Ejecutar el backfill 0096 en lotes controlados.", "Confirmar cobertura 100% antes de usar tasas históricas en un reporte ejecutivo."]}
            />
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
              <div className="border-b border-white/10 p-4">
                <h2 className="font-black text-white">Eventos explicables</h2>
                <p className="mt-1 text-xs text-slate-400">Referencia local por evento, ubicación aproximada y reglas persistidas; no se entrega UID ni un hash global correlacionable.</p>
              </div>
              {!confirmedPayload.events?.length ? (
                <EnterpriseOpsState variant="empty" compact title="Sin eventos confirmados" description="El upstream confirmó cero eventos para este scope; ajustá filtros o realizá un tap autorizado." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-950/70 text-slate-400">
                      <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Tenant / BID</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Riesgo</th><th className="px-4 py-3">Reglas / acción</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {confirmedPayload.events.map((event) => (
                        <tr key={`${event.id}-${event.created_at}`} className="align-top text-slate-300">
                          <td className="whitespace-nowrap px-4 py-3">{new Date(event.created_at).toLocaleString("es-AR")}</td>
                          <td className="px-4 py-3"><b className="text-white">{event.tenant_slug}</b><br />{event.bid}<br /><span className="font-mono text-[10px] text-slate-500">{event.unit_reference}</span></td>
                          <td className="px-4 py-3"><b className="text-white">{event.result || "UNKNOWN"}</b><br />{event.event_type}<br />{event.carrier_profile_code || "carrier no informado"}</td>
                          <td className="px-4 py-3">{event.risk_classified ? <><b className="text-white">{event.risk_level}</b> · {event.risk_score}</> : <b className="text-amber-200">Sin clasificar v1</b>}</td>
                          <td className="max-w-md px-4 py-3">{event.triggered_rules?.length ? event.triggered_rules.join(", ") : "Sin reglas"}<br /><span className="text-slate-500">{event.recommended_action || "Sin acción informada"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <aside className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <h2 className="font-black text-white">Reglas disparadas</h2>
              <div className="mt-3 grid gap-2">
                {confirmedPayload.triggered_rules?.length ? confirmedPayload.triggered_rules.map((item) => (
                  <div key={item.rule} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                    <p className="break-words font-mono text-xs text-amber-100">{item.rule}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.events.toLocaleString("es-AR")} eventos</p>
                  </div>
                )) : <p className="text-sm text-slate-400">El upstream no reportó reglas disparadas para el scope.</p>}
              </div>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

function Filter({ name, label, value, placeholder, type = "text" }: { name: string; label: string; value: string; placeholder?: string; type?: "text" | "datetime-local" }) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-slate-300">
      {label}
      <input name={name} type={type} defaultValue={value} placeholder={placeholder} maxLength={160} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-600" />
    </label>
  );
}
