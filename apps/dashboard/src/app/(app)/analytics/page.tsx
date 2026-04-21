import { SectionHeading } from "@product/ui";
import { messages } from "@product/config";
import { AnalyticsPanels } from "../../../components/analytics-panels";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { getServerOrigin } from "../../../lib/server-origin";

type AnalyticsPayload = {
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
    resellerPerformance: number;
  };
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
    origin: { city: string; country: string; lat: number | null; lng: number | null };
    current: { city: string; country: string; lat: number | null; lng: number | null };
    lastDevice: string;
  }>;
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
  origin,
  tenantScope = "",
  source = "all",
  range = "30d",
  country = "",
}: {
  origin: string;
  tenantScope?: string;
  source?: "real" | "demo" | "imported" | "all";
  range?: "24h" | "7d" | "30d";
  country?: string;
}): Promise<AnalyticsPayload | null> {
  try {
    const queryParams = new URLSearchParams();
    if (tenantScope) queryParams.set("tenant", tenantScope);
    if (source && source !== "all") queryParams.set("source", source);
    if (range) queryParams.set("range", range);
    if (country) queryParams.set("country", country.toUpperCase());
    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await fetch(`${origin}/api/admin/analytics${query}`, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const query = await searchParams;
  const tenantScope = session.role === "tenant-admin" ? (session.tenantSlug || "") : String(query.tenant || "");
  const isTenantAdmin = session.role === "tenant-admin";
  const source = isTenantAdmin ? "real" : ((query.source || "all") as "real" | "demo" | "imported" | "all");
  const range = (query.range || "30d") as "24h" | "7d" | "30d";
  const country = (query.country || "").trim();
  const origin = await getServerOrigin();

  const fallbackLocale = "es-AR" as const;
  const copy = dashboardContent[locale] || dashboardContent[fallbackLocale];
  const translation = messages[locale] || messages[fallbackLocale];
  const kpis = translation?.dashboard?.kpis || FALLBACK_KPIS;
  const analyticsData = await getAnalytics({ origin, tenantScope, source, range, country });
  const mapMode = isTenantAdmin ? "tenant" : "global";

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow={copy.nav.analytics}
        title={copy.pages.analytics.title}
        description={copy.pages.analytics.description}
      />
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>.
        <span className="ml-2">Fuente: <b className="text-white">{source}</b> · Rango: <b className="text-white">{range}</b> · Country: <b className="text-white">{country || "all"}</b>.</span>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <form className="grid gap-3 md:grid-cols-5">
          <select name="range" defaultValue={range} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
          </select>
          {session.role !== "tenant-admin" ? (
            <select name="source" defaultValue={source} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <option value="all">all</option>
              <option value="real">real</option>
              <option value="demo">demo</option>
              <option value="imported">imported</option>
            </select>
          ) : (
            <input type="hidden" name="source" value="real" />
          )}
          {session.role !== "tenant-admin" ? (
            <input name="tenant" defaultValue={tenantScope} placeholder="tenant slug" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          ) : (
            <input type="hidden" name="tenant" value={tenantScope} />
          )}
          <input name="country" defaultValue={country} placeholder="country (AR, BR, US...)" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <button type="submit" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100">Apply analytics scope</button>
        </form>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <form className="grid gap-3 md:grid-cols-5">
          <select name="range" defaultValue={range} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
          </select>
          {session.role !== "tenant-admin" ? (
            <select name="source" defaultValue={source} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <option value="all">all</option>
              <option value="real">real</option>
              <option value="demo">demo</option>
              <option value="imported">imported</option>
            </select>
          ) : (
            <input type="hidden" name="source" value="real" />
          )}
          {session.role !== "tenant-admin" ? (
            <input name="tenant" defaultValue={tenantScope} placeholder="tenant slug" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          ) : (
            <input type="hidden" name="tenant" value={tenantScope} />
          )}
          <input name="country" defaultValue={country} placeholder="country (AR, BR, US...)" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <button type="submit" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100">Apply analytics scope</button>
        </form>
      </div>
      <AnalyticsPanels
        kpis={kpis}
        extra={copy.analytics}
        data={analyticsData || undefined}
        mapMode={isTenantAdmin ? "tenant" : "global"}
      />
    </main>
  );
}