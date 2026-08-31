import { SectionHeading } from "@product/ui";
import { messages } from "@product/config";
import { AnalyticsPanels } from "../../../components/analytics-panels";
import { EnterpriseOpsState } from "../../../components/enterprise-ops-state";
import { PhysicalTapsCommandCenter } from "../../../components/physical-taps-command-center";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { readDemoDataMetaFromResponse, type DemoDataMeta } from "../../../lib/demo-data-mode";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";
import { readPhysicalTaps } from "../../../lib/physical-taps-read";

type AnalyticsPayload = {
  ok?: boolean;
  reason?: string;
  scope?: {
    tenant: string;
    source: "real" | "demo" | "imported" | "all";
    range: "24h" | "7d" | "30d";
    country?: string;
  };
  kpis: {
    scans: number;
    validRate: number;
    invalidRate: number;
    duplicates: number;
    tamper: number;
    activeBatches: number;
    activeTenants: number;
    geoRegions: number;
    resellerPerformance?: number | null;
  };
  billing?: { resellerMrrAmount?: number | null; currency?: string | null; source?: string | null; period?: string | null };
  geography?: {
    countries?: Array<{ country: string; scans: number; risk: number }>;
    cities?: Array<{ city: string; country: string; lat: number | null; lng: number | null; scans: number; risk: number; lastSeen: string | null }>;
  };
  devices?: {
    os?: Array<{ label: string; count: number }>;
    browser?: Array<{ label: string; count: number }>;
    deviceType?: Array<{ label: string; count: number }>;
    timezones?: Array<{ label: string; count: number }>;
    mobileShare?: number;
  };
  feed?: Array<{ id: number; uidHex: string; bid: string; result: string; city: string; country: string; device: string; createdAt: string }>;
  products?: Array<{
    uidHex: string;
    bid: string;
    productName: string;
    winery: string;
    region: string;
    vintage: string;
    scanCount: number;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    lastVerifiedCity: string;
    lastVerifiedCountry: string;
    tokenization: { status: string; network: string; txHash: string | null; tokenId: string | null };
  }>;
  trend: Array<{ day: string; scans: number; duplicates: number; tamper: number }>;
  batchStatus: Array<{ name: string; value: number }>;
  geoPoints: Array<{ city: string; country: string; scans: number; risk: number; lat: number; lng: number }>;
  deviceSignals: Array<{ device: string; scans: number; countries: number; validRate: number; risk: number }>;
  tagJourney: Array<{
    uid: string;
    taps: number;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    originSource?: string | null;
    origin: { city: string; country: string; lat: number | null; lng: number | null };
    current: { city: string; country: string; lat: number | null; lng: number | null };
    lastDevice: string;
  }>;
};

type AnalyticsAvailability = "ready" | "upstream_error" | "invalid_payload" | "unreachable";
type AnalyticsDataSource = "production" | "demo" | "imported" | "mixed";

type AnalyticsResult = {
  data: AnalyticsPayload | null;
  meta: DemoDataMeta;
  availability: AnalyticsAvailability;
  source: AnalyticsDataSource;
  detail: string;
};
const FALLBACK_KPIS = {
  scans: "Scans",
  validInvalid: "Valid / Invalid",
  duplicates: "Duplicados",
  tamper: "Tamper alerts",
  scansDelta: "",
  validInvalidDelta: "",
  duplicatesDelta: "",
  tamperDelta: "",
  trendTitle: "Security trend",
  statusTitle: "Batch status",
};

async function getAnalytics({
  context,
  source = "all",
  range = "30d",
  country = "",
  allowDemoData = false,
}: {
  context: AdminPageContext;
  source?: "real" | "demo" | "imported" | "all";
  range?: "24h" | "7d" | "30d";
  country?: string;
  allowDemoData?: boolean;
}): Promise<AnalyticsResult> {
  try {
    const queryParams = new URLSearchParams();
    if (source && source !== "all") queryParams.set("source", source);
    if (range) queryParams.set("range", range);
    if (country) queryParams.set("country", country.toUpperCase());
    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await fetchAdminPage(context, `analytics${query}`);
    const meta = readDemoDataMetaFromResponse(response);
    if (!response.ok) return { data: null, meta, availability: "upstream_error", source: "production", detail: `Analytics upstream error (${response.status})` };
    const payload = await response.json().catch(() => null) as AnalyticsPayload | null;
    if (payload?.ok === false) {
      return { data: null, meta, availability: "upstream_error", source: "production", detail: payload.reason || "Analytics upstream reported unavailable data" };
    }
    const responseIsDemo = Boolean(meta.demoMode || payload?.scope?.source === "demo");
    if (!payload?.kpis || !Array.isArray(payload.trend) || !Array.isArray(payload.geoPoints) || (responseIsDemo && !allowDemoData)) {
      return { data: null, meta, availability: "invalid_payload", source: "production", detail: responseIsDemo && !allowDemoData ? "Demo analytics rejected outside an explicit demo policy" : "Analytics payload does not match the expected contract" };
    }
    const payloadSource = payload.scope?.source;
    const dataSource: AnalyticsDataSource = meta.demoMode || payloadSource === "demo"
      ? "demo"
      : payloadSource === "imported"
        ? "imported"
        : payloadSource === "all"
          ? "mixed"
          : "production";
    return { data: payload, meta, availability: "ready", source: dataSource, detail: `Dataset ${dataSource} confirmed by analytics upstream` };
  } catch {
    return {
      data: null,
      meta: { demoMode: false, dataSource: "production", demoSource: "production" },
      availability: "unreachable",
      source: "production",
      detail: "Analytics upstream unreachable",
    };
  }
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const query = await searchParams;
  const adminContext = await createAdminPageContext(session, query.tenant);
  const tenantScope = adminContext.tenantSlug;
  const isTenantAdmin = !adminContext.canSelectTenant;
  const source = isTenantAdmin ? "real" : ((query.source || "all") as "real" | "demo" | "imported" | "all");
  const range = (query.range || "30d") as "24h" | "7d" | "30d";
  const country = (query.country || "").trim();

  const fallbackLocale = "es-AR" as const;
  const copy = dashboardContent[locale] || dashboardContent[fallbackLocale];
  const translation = messages[locale] ?? messages[fallbackLocale];
  const kpis = translation?.dashboard?.kpis || FALLBACK_KPIS;
  const allowDemoData = Boolean(session.isDemo || (adminContext.canSelectTenant && source === "demo"));
  const [analyticsData, physicalTapsResult] = await Promise.all([
    getAnalytics({ context: adminContext, source, range, country, allowDemoData }),
    readPhysicalTaps({
      context: adminContext,
      bid: "DEMO-2026-02",
      range: "24h",
      isDemoSession: Boolean(session.isDemo),
    }),
  ]);
  const mapMode = analyticsData.source === "demo" ? "demo" : isTenantAdmin ? "tenant" : "global";
  const confirmedSourceLabel = analyticsData.source === "production"
    ? "production"
    : analyticsData.source;
  const analyticsDescription = analyticsData.source === "demo"
    ? "Dataset demo identificado: métricas antifraude, dispositivos y mapas con procedencia visible; no representa actividad productiva en tiempo real."
    : copy.pages.analytics.description;

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.analytics} title={copy.pages.analytics.title} description={analyticsDescription} />
      <div id="analytics-active-scope" className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>.
        <span className="ml-2">Fuente confirmada: <b className="text-white">{confirmedSourceLabel}</b> · Filtro solicitado: <b className="text-white">{source}</b> · Rango: <b className="text-white">{range}</b> · Country: <b className="text-white">{country || "all"}</b>.</span>
        {analyticsData.meta.demoMode ? (
          <span className="ml-2 inline-flex rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
            DEMO DATA · source={analyticsData.meta.demoSource}
          </span>
        ) : null}
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <form aria-describedby="analytics-active-scope" aria-label="Filtros de analytics" className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1.5 text-xs font-bold text-slate-300">
            Ventana temporal
            <select suppressHydrationWarning name="range" defaultValue={range} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <option value="24h">Últimas 24 horas</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
            </select>
          </label>
          {adminContext.canSelectTenant ? (
            <label className="grid gap-1.5 text-xs font-bold text-slate-300">
              Fuente de datos
              <select suppressHydrationWarning name="source" defaultValue={source} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                <option value="all">Todas las fuentes</option>
                <option value="real">Producción</option>
                <option value="demo">Demo identificada</option>
                <option value="imported">Importados</option>
              </select>
            </label>
          ) : (
            <input suppressHydrationWarning type="hidden" name="source" value="real" />
          )}
          {adminContext.canSelectTenant ? (
            <label className="grid gap-1.5 text-xs font-bold text-slate-300">
              Tenant
              <input suppressHydrationWarning name="tenant" defaultValue={tenantScope} placeholder="slug del tenant" autoComplete="off" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
            </label>
          ) : (
            <input suppressHydrationWarning type="hidden" name="tenant" value={tenantScope} />
          )}
          <label className="grid gap-1.5 text-xs font-bold text-slate-300">
            País (ISO-2)
            <input suppressHydrationWarning name="country" defaultValue={country} placeholder="AR, BR, US…" inputMode="text" maxLength={2} autoCapitalize="characters" autoComplete="country" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm uppercase text-slate-200" />
          </label>
          <button suppressHydrationWarning type="submit" className="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Aplicar filtros</button>
        </form>
      </div>
      <PhysicalTapsCommandCenter result={physicalTapsResult} tenantDisplayName={tenantScope === "demobodega" ? "Bodega Balmec" : tenantScope || "tenant actual"} />
      {analyticsData.availability === "ready" && analyticsData.data ? (
        <AnalyticsPanels kpis={kpis} extra={copy.analytics} data={analyticsData.data} mapMode={mapMode} dataSource={analyticsData.source} sourceDetail={analyticsData.detail} />
      ) : (
        <EnterpriseOpsState
          variant="warning"
          title="Analytics no confirmó datos"
          description="La fuente operativa no respondió con un dataset válido. Para evitar decisiones incorrectas, esta vista no convierte el fallo en métricas cero."
          checklist={[
            analyticsData.availability === "unreachable" ? "El servicio de analytics no fue alcanzable" : analyticsData.availability === "invalid_payload" ? "La respuesta no cumple el contrato esperado" : "La fuente devolvió un error operativo",
            `Scope conservado: ${tenantScope ? `tenant ${tenantScope}` : "global"}, ${range}, ${country || "todos los países"}`,
          ]}
          testId="analytics-upstream-unavailable"
        />
      )}
    </main>
  );
}
