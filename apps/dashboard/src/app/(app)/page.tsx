import { Badge, Card, SectionHeading, StatusChip } from "@product/ui";
import Link from "next/link";
import { AdminActionForms } from "../../components/admin-action-forms";
import { AnalyticsPanels } from "../../components/analytics-panels";
import { DataTable } from "../../components/data-table";
import { ModuleGrid } from "../../components/module-grid";
import { MultirubroOpsPanel } from "../../components/multirubro-ops-panel";
import { RealtimeOpsMonitor } from "../../components/realtime-ops-monitor";
import { dashboardContent } from "../../lib/dashboard-content";
import { requireDashboardSession } from "../../lib/session";
import { getDashboardI18n } from "../../lib/locale";
import { messages, productUrls } from "@product/config";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
const FALLBACK_KPIS = {
  scans: "Scans",
  validInvalid: "Valid / Invalid",
  duplicates: "Duplicados",
  tamper: "Tamper alerts",
};

async function getOverviewRows() {
  try {
    const response = await fetch(`${API_BASE}/admin/tenants?withStats=1`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [] as Array<Record<string, unknown>>;
    return response.json();
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

async function getLiveEvents() {
  try {
    const response = await fetch(`${API_BASE}/admin/events?limit=18`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [] as Array<Record<string, unknown>>;
    const payload = await response.json().catch(() => null) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null;
    if (!payload) return [] as Array<Record<string, unknown>>;
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload.rows) ? payload.rows : [] as Array<Record<string, unknown>>;
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

async function getTokenizationRows() {
  try {
    const response = await fetch(`${API_BASE}/admin/tokenization/requests?limit=30`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [] as Array<Record<string, unknown>>;
    const payload = await response.json().catch(() => ({})) as { rows?: Array<Record<string, unknown>> };
    return payload.rows || [];
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

async function getTokenizationRows() {
  try {
    const response = await fetch(`${API_BASE}/admin/tokenization/requests?limit=30`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [] as Array<Record<string, unknown>>;
    const payload = await response.json().catch(() => ({})) as { rows?: Array<Record<string, unknown>> };
    return payload.rows || [];
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

function resolveTenantStatus(scans: number, duplicates: number, tamper: number) {
  if (scans === 0) return "pending";
  const riskRatio = scans > 0 ? (duplicates + tamper) / scans : 0;
  if (tamper > 5 || riskRatio > 0.06) return "risk";
  if (duplicates > 0 || tamper > 0) return "healthy";
  return "active";
}

export default async function DashboardHome() {
  const { locale } = await getDashboardI18n();
  const fallbackLocale = "es-AR" as const;
  const t = messages[locale] || messages[fallbackLocale];
  const kpis = t?.dashboard?.kpis || FALLBACK_KPIS;
  const dashboardText = t?.dashboard || messages[fallbackLocale].dashboard;
  const copy = dashboardContent[locale] || dashboardContent[fallbackLocale];
  const publicMobileBase = `${productUrls.web}/demo-lab/mobile`;
  const session = await requireDashboardSession();
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";
  const isTenantAdmin = session.role === "tenant-admin";
  const [overviewRaw, liveEvents, tokenizationRows]: [Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>] = await Promise.all([getOverviewRows(), getLiveEvents(), getTokenizationRows()]);

  const labels = locale === "en"
    ? {
        liveFeed: "Live operations feed",
        mission: "Mission control",
        mapTitle: "Live scan map",
        mapSubtitle: isTenantAdmin ? "Geolocated scans for your tenant operations." : "Geolocated scans from tenants, demo packs and reseller simulations",
        roleNote: isTenantAdmin ? "Tenant-level operations scope with no cross-tenant demo noise." : "Contextual permissions visible across tenants, CRM and demo orchestration.",
      }
    : locale === "pt-BR"
    ? {
        liveFeed: "Feed de operações ao vivo",
        mission: "Mission control",
        mapTitle: "Mapa de scans ao vivo",
        mapSubtitle: isTenantAdmin ? "Scans geolocalizados das operações do seu tenant." : "Scans geolocalizados de tenants, packs demo e simulações reseller",
        roleNote: isTenantAdmin ? "Escopo operacional por tenant, sem ruído de demos cross-tenant." : "Permissões contextuais visíveis em tenants, CRM e orquestração demo.",
      }
    : {
        liveFeed: "Feed operativo en vivo",
        mission: "Mission control",
        mapTitle: "Mapa de escaneos en vivo",
        mapSubtitle: isTenantAdmin ? "Escaneos geolocalizados de la operación de tu tenant." : "Escaneos geolocalizados de tenants, packs demo y simulaciones reseller",
        roleNote: isTenantAdmin ? "Alcance operativo por tenant, sin ruido de demos cross-tenant." : "Permisos contextuales visibles en tenants, CRM y orquestación demo.",
      };

  const scopedOverviewRaw = tenantScope
    ? overviewRaw.filter((row: Record<string, unknown>) => String(row.slug || "").toLowerCase() === tenantScope)
    : overviewRaw;

  const tenantFromRow = (row: Record<string, unknown>) =>
    String(row.tenant_slug || row.tenantSlug || row.tenant_id || row.tenantId || "").toLowerCase();

  const scopedLiveEvents = tenantScope
    ? liveEvents.filter((row: Record<string, unknown>) => tenantFromRow(row) === tenantScope)
    : liveEvents;
  const scopedTokenizationRows = tenantScope
    ? tokenizationRows.filter((row: Record<string, unknown>) => String(row.tenant_slug || "").toLowerCase() === tenantScope)
    : tokenizationRows;

  const overviewRows = scopedOverviewRaw.map((row: Record<string, unknown>) => {
    const scans = Number(row.scans || 0);
    const duplicates = Number(row.duplicates || 0);
    const tamper = Number(row.tamper || 0);
    return {
      tenant: String(row.name || row.slug || "-"),
      status: resolveTenantStatus(scans, duplicates, tamper),
      scans: scans.toLocaleString(),
      duplicates: duplicates.toLocaleString(),
      tamper: tamper.toLocaleString(),
    };
  });

  const successfulTaps = scopedLiveEvents.filter((event) => String(event.result || "").toUpperCase() === "VALID").length;
  const failedTaps = scopedLiveEvents.length - successfulTaps;
  const tokenizationByStatus: Record<string, number> = {};
  for (const row of scopedTokenizationRows) {
    const status = String(row.status || "unknown").toLowerCase();
    tokenizationByStatus[status] = Number(tokenizationByStatus[status] || 0) + 1;
  }

  const demoPacks = [
    { key: "wine-secure", label: "Wine secure", tenant: "demobodega", itemId: "demo-item-001" },
    { key: "events-basic", label: "Events basic", tenant: "demoevents", itemId: "demo-item-001" },
    { key: "cosmetics-secure", label: "Cosmetics secure", tenant: "democosmetics", itemId: "demo-item-001" },
    { key: "agro-secure", label: "Agro secure", tenant: "demoagro", itemId: "demo-item-001" },
    { key: "pharma-secure", label: "Pharma secure", tenant: "demopharma", itemId: "demo-item-001" },
    { key: "luxury-basic", label: "Luxury basic", tenant: "demoluxury", itemId: "demo-item-001" },
    { key: "docs-presence", label: "Docs & presence", tenant: "demodocs", itemId: "demo-item-001" },
    { key: "reseller-flow", label: "Reseller flow", tenant: "demoreseller", itemId: "demo-item-001" },
    { key: "government-proof", label: "Government proof", tenant: "demogov", itemId: "demo-item-001" },
    { key: "operator-qa", label: "Operator QA", tenant: "demoops", itemId: "demo-item-001" },
  ];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.overview} title={copy.pages.overview.title} description={copy.pages.overview.description} />

      <AnalyticsPanels kpis={kpis} extra={copy.analytics} />
      <MultirubroOpsPanel />

      <RealtimeOpsMonitor
        initialEvents={scopedLiveEvents}
        tenantScope={tenantScope}
        mode={isTenantAdmin ? "tenant" : "global"}
        labels={labels}
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Tap simulation & Polygon status</h2>
          <Badge tone="cyan">Simulación SUN + tokenización</Badge>
        </div>
        <p className="mt-2 text-xs text-slate-400">Comparativa rápida de taps válidos/invalidos y estado de transacciones de tokenización en Polygon Amoy.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Taps exitosos<br /><b className="text-base text-emerald-300">{successfulTaps}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Taps fallidos<br /><b className="text-base text-rose-300">{failedTaps}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Minted / anchored<br /><b className="text-base text-cyan-200">{Number(tokenizationByStatus.anchored || 0)}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Pending / failed<br /><b className="text-base text-amber-200">{Number(tokenizationByStatus.pending || 0) + Number(tokenizationByStatus.failed || 0)}</b></div>
        </div>
        <div className="mt-4 grid gap-2">
          {scopedTokenizationRows.slice(0, 8).map((row: Record<string, unknown>) => {
            const status = String(row.status || "unknown").toLowerCase();
            const tone = status === "anchored" ? "good" : status === "failed" ? "risk" : status === "processing" ? "warn" : "neutral";
            return (
              <div key={String(row.id)} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip label={status} tone={tone} />
                  <span>{String(row.bid || "-")} · {String(row.uid_hex || "-")}</span>
                  <span className="text-slate-400">{String(row.network || "polygon-amoy")}</span>
                </div>
                <p className="mt-1 break-all text-slate-400">Tx: {String(row.tx_hash || "-")} · Token: {String(row.token_id || "-")}</p>
              </div>
            );
          })}
          {!scopedTokenizationRows.length ? <p className="rounded-xl border border-dashed border-white/15 bg-slate-900/40 p-3 text-xs text-slate-400">Sin requests de tokenización en el alcance actual. Podés usar el modo simulación (`POST /sun/simulate`) para poblar esta vista.</p> : null}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Tap simulation & Polygon status</h2>
          <Badge tone="cyan">Simulación SUN + tokenización</Badge>
        </div>
        <p className="mt-2 text-xs text-slate-400">Comparativa rápida de taps válidos/invalidos y estado de transacciones de tokenización en Polygon Amoy.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Taps exitosos<br /><b className="text-base text-emerald-300">{successfulTaps}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Taps fallidos<br /><b className="text-base text-rose-300">{failedTaps}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Minted / anchored<br /><b className="text-base text-cyan-200">{Number(tokenizationByStatus.anchored || 0)}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Pending / failed<br /><b className="text-base text-amber-200">{Number(tokenizationByStatus.pending || 0) + Number(tokenizationByStatus.failed || 0)}</b></div>
        </div>
        <div className="mt-4 grid gap-2">
          {scopedTokenizationRows.slice(0, 8).map((row: Record<string, unknown>) => {
            const status = String(row.status || "unknown").toLowerCase();
            const tone = status === "anchored" ? "good" : status === "failed" ? "risk" : status === "processing" ? "warn" : "neutral";
            return (
              <div key={String(row.id)} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip label={status} tone={tone} />
                  <span>{String(row.bid || "-")} · {String(row.uid_hex || "-")}</span>
                  <span className="text-slate-400">{String(row.network || "polygon-amoy")}</span>
                </div>
                <p className="mt-1 break-all text-slate-400">Tx: {String(row.tx_hash || "-")} · Token: {String(row.token_id || "-")}</p>
              </div>
            );
          })}
          {!scopedTokenizationRows.length ? <p className="rounded-xl border border-dashed border-white/15 bg-slate-900/40 p-3 text-xs text-slate-400">Sin requests de tokenización en el alcance actual. Podés usar el modo simulación (`POST /sun/simulate`) para poblar esta vista.</p> : null}
        </div>
      </Card>

      {!isTenantAdmin ? <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Demo express · first time flow</h2>
          <div className="flex flex-wrap gap-2">
            <Badge tone="cyan">CEO</Badge>
            <Badge tone="green">Operator</Badge>
            <Badge tone="default">Buyer</Badge>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">1) Elegí demo pack</p>
            <p className="mt-1">Seleccioná uno de los 10 escenarios según industria.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">2) Mostrá mobile</p>
            <p className="mt-1">Abrí preview móvil y explicá trust state en 15 segundos.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">3) Simulá operación</p>
            <p className="mt-1">Cargá manifest, activá tags y validá URL SUN en Batch Ops.</p>
          </div>
        </div>
      </Card> : null}

      {!isTenantAdmin ? <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">10 demo packs listos</h2>
          <Link href="/demo-lab" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">Open orchestrator</Link>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {demoPacks.map((pack) => (
            <div key={pack.key} className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
              <p className="text-sm font-semibold text-white">{pack.label}</p>
              <div className="mt-2 grid gap-2">
                <a href={`${publicMobileBase}/${pack.tenant}/${pack.itemId}?pack=${encodeURIComponent(pack.key)}&demoMode=consumer_tap`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-100">Mobile view (public)</a>
                <Link href="/batches" className="rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-100">Manifest flow</Link>
              </div>
            </div>
          ))}
        </div>
      </Card> : null}

      <ModuleGrid
        actionLabel={copy.shell.openModule}
        modules={isTenantAdmin
          ? [
              { title: copy.pages.batches.title, description: copy.pages.batches.description, href: "/batches", status: copy.statuses.active, tone: "green" as const },
              { title: copy.pages.tags.title, description: copy.pages.tags.description, href: "/tags", status: copy.statuses.active, tone: "green" as const },
              { title: copy.pages.events.title, description: copy.pages.events.description, href: "/events", status: copy.statuses.active, tone: "green" as const },
              { title: copy.pages.analytics.title, description: copy.pages.analytics.description, href: "/analytics", status: copy.statuses.active, tone: "green" as const },
              { title: copy.pages.leadsTickets.title, description: copy.pages.leadsTickets.description, href: "/leads-tickets", status: copy.statuses.active, tone: "green" as const },
            ]
          : [
              { title: copy.pages.tenants.title, description: copy.pages.tenants.description, href: "/tenants", status: copy.statuses.active, tone: "green" as const },
              { title: copy.pages.batches.title, description: copy.pages.batches.description, href: "/batches", status: copy.statuses.active, tone: "green" as const },
              { title: copy.pages.tags.title, description: copy.pages.tags.description, href: "/tags", status: copy.statuses.active, tone: "green" as const },
              { title: copy.pages.events.title, description: copy.pages.events.description, href: "/events", status: copy.statuses.active, tone: "green" as const },
              { title: copy.pages.resellers.title, description: copy.pages.resellers.description, href: "/resellers", status: copy.statuses.active, tone: "green" as const },
              { title: copy.pages.apiKeys.title, description: copy.pages.apiKeys.description, href: "/api-keys", status: copy.statuses.pending, tone: "amber" as const },
            ]}
      />

      <DataTable
        title={copy.tables.tenants.title}
        columns={[
          { key: "tenant", label: copy.tables.tenants.tenant },
          { key: "status", label: copy.tables.tenants.status },
          { key: "scans", label: kpis.scans },
          { key: "duplicates", label: kpis.duplicates },
          { key: "tamper", label: kpis.tamper },
        ]}
        rows={overviewRows}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />

      {!isTenantAdmin ? <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">{dashboardText.roleBasedOps}</h2>
        <p className="mt-2 text-sm text-slate-400">{copy.pages.batches.description}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {Object.entries(copy.roles).map(([roleKey, roleLabel]) => (
            <div key={roleKey} className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-300">
              <p className="font-semibold uppercase tracking-[0.12em] text-cyan-200">{roleLabel}</p>
              <p className="mt-2">{labels.roleNote}</p>
            </div>
          ))}
        </div>
      </Card>
      : null}

      {!isTenantAdmin ? <AdminActionForms copy={dashboardText.forms} roles={copy.roles} readyLabel={copy.shell.ready} currentRole={session.role} /> : null}
    </main>
  );
}
