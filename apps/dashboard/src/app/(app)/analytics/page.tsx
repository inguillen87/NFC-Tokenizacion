import { SectionHeading } from "@product/ui";
import { messages } from "@product/config";
import { AnalyticsPanels } from "../../../components/analytics-panels";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
type AnalyticsPayload = {
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

function inferTenantScope(session: { role: string; email: string }) {
  if (session.role !== "tenant-admin") return "";
  const email = session.email.toLowerCase();
  const explicit = email.match(/(?:admin|ops|tenant)[._-]([a-z0-9-]+)/)?.[1];
  if (explicit) return explicit;
  if (email.includes("demobodega")) return "demobodega";
  return "";
}

async function getAnalytics(tenantScope = ""): Promise<AnalyticsPayload | null> {
  if (!(process.env.ADMIN_API_KEY || "").trim()) {
    return {
      kpis: {
        scans: 1240,
        validRate: 97.9,
        invalidRate: 2.1,
        duplicates: 23,
        tamper: 7,
        activeBatches: 2,
        activeTenants: tenantScope ? 1 : 4,
        geoRegions: 3,
        resellerPerformance: 18200,
      },
      trend: [
        { day: "Mon", scans: 120, duplicates: 2, tamper: 1 },
        { day: "Tue", scans: 150, duplicates: 3, tamper: 0 },
        { day: "Wed", scans: 170, duplicates: 4, tamper: 1 },
        { day: "Thu", scans: 190, duplicates: 2, tamper: 1 },
        { day: "Fri", scans: 210, duplicates: 5, tamper: 2 },
        { day: "Sat", scans: 230, duplicates: 4, tamper: 1 },
        { day: "Sun", scans: 170, duplicates: 3, tamper: 1 },
      ],
      batchStatus: [
        { name: "Active", value: 2 },
        { name: "Pending", value: 1 },
        { name: "Revoked", value: 0 },
      ],
      geoPoints: [
        { city: "Mendoza", country: "AR", scans: 220, risk: 0, lat: -32.8895, lng: -68.8458 },
        { city: "Buenos Aires", country: "AR", scans: 180, risk: 1, lat: -34.6037, lng: -58.3816 },
      ],
      deviceSignals: [
        { device: "iPhone Safari", scans: 220, countries: 3, validRate: 98.1, risk: 4 },
        { device: "Android Chrome", scans: 180, countries: 4, validRate: 96.7, risk: 8 },
      ],
      tagJourney: [
        {
          uid: "04A1B2C3D4E5F6",
          taps: 9,
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          origin: { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458 },
          current: { city: "São Paulo", country: "BR", lat: -23.5505, lng: -46.6333 },
          lastDevice: "iPhone Safari",
        },
      ],
    };
  }
  try {
    const query = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";
    const response = await fetch(`${API_BASE}/admin/analytics${query}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default async function AnalyticsPage() {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const tenantScope = inferTenantScope(session);
  const isTenantAdmin = session.role === "tenant-admin";

  const fallbackLocale = "es-AR" as const;
  const copy = dashboardContent[locale] || dashboardContent[fallbackLocale];
  const translation = messages[locale] || messages[fallbackLocale];
  const kpis = translation?.dashboard?.kpis || FALLBACK_KPIS;
  const analyticsData = await getAnalytics(tenantScope);

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow={copy.nav.analytics}
        title={copy.pages.analytics.title}
        description={copy.pages.analytics.description}
      />
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>.
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