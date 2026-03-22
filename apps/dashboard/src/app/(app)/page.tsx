import { Badge, Card, SectionHeading } from "@product/ui";
import { DemoOpsMap } from "../../components/demo-ops-map";
import Link from "next/link";
import { AdminActionForms } from "../../components/admin-action-forms";
import { AnalyticsPanels } from "../../components/analytics-panels";
import { DataTable } from "../../components/data-table";
import { ModuleGrid } from "../../components/module-grid";
import { AudienceOverviewExplainer } from "../../components/audience-overview-explainer";
import { dashboardContent } from "../../lib/dashboard-content";
import { getDashboardI18n } from "../../lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

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
    return response.json();
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
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const [overviewRaw, liveEvents]: [Array<Record<string, unknown>>, Array<Record<string, unknown>>] = await Promise.all([getOverviewRows(), getLiveEvents()]);

  const labels = locale === "en"
    ? {
        liveFeed: "Live operations feed",
        mission: "Mission control",
        mapTitle: "Live scan map",
        mapSubtitle: "Geolocated scans from tenants, demo packs and reseller simulations",
        roleNote: "Contextual permissions visible across tenants, CRM and demo orchestration.",
      }
    : locale === "pt-BR"
    ? {
        liveFeed: "Feed de operações ao vivo",
        mission: "Mission control",
        mapTitle: "Mapa de scans ao vivo",
        mapSubtitle: "Scans geolocalizados de tenants, packs demo e simulações reseller",
        roleNote: "Permissões contextuais visíveis em tenants, CRM e orquestração demo.",
      }
    : {
        liveFeed: "Feed operativo en vivo",
        mission: "Mission control",
        mapTitle: "Mapa de escaneos en vivo",
        mapSubtitle: "Escaneos geolocalizados de tenants, packs demo y simulaciones reseller",
        roleNote: "Permisos contextuales visibles en tenants, CRM y orquestación demo.",
      };

  const overviewRows = overviewRaw.map((row: Record<string, unknown>) => {
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

  const mapPoints = liveEvents
    .filter((row: Record<string, unknown>) => typeof row.lat === "number" && typeof row.lng === "number")
    .slice(0, 10)
    .map((row: Record<string, unknown>) => ({
      city: String(row.city || row.reason || "Unknown"),
      country: String(row.country_code || "--"),
      lat: Number(row.lat),
      lng: Number(row.lng),
      scans: 1,
      risk: String(row.result || "VALID") === "VALID" ? 0 : 1,
    }));

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.overview} title={copy.pages.overview.title} description={copy.pages.overview.description} />

      <AnalyticsPanels kpis={t.dashboard.kpis} extra={copy.analytics} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{labels.liveFeed}</h2>
            <Badge tone="cyan">{labels.mission}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {liveEvents.slice(0, 8).map((event: Record<string, unknown>) => {
              const result = String(event.result || "VALID");
              const tone = result === "VALID" ? "text-emerald-300" : "text-rose-300";
              return (
                <div key={String(event.id)} className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm">
                  <p className={`font-semibold ${tone}`}>{result}</p>
                  <p className="mt-1 text-slate-300">
                    {String(event.tenant_slug || "-")} · {String(event.bid || "-")} · {String(event.uid_hex || "-")}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        <div>
          <p className="mb-2 text-xs text-slate-400">{labels.mapTitle} · {labels.mapSubtitle}</p>
          <DemoOpsMap points={mapPoints} />
        </div>
      </div>



<AudienceOverviewExplainer />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Cómo leer la plataforma</h2>
            <p className="mt-2 text-sm text-slate-400">Este admin ahora explica para qué sirve cada bloque, tanto si lo mira dirección como si lo mira un inversor o un cliente enterprise.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">CEO / inversor</p>
            <p className="mt-2">Overview, Analytics, Plans y Resellers muestran escala, monetización, riesgo y expansión comercial.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Operaciones / ingeniería</p>
            <p className="mt-2">Batches, Tags, Events y API Keys explican cómo se emite, valida, monitorea y conecta el sistema.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Cliente / comprador</p>
            <p className="mt-2">Demo Lab, Demo Control y Mobile Preview hacen visible la experiencia final y el valor de confianza.</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Qué hace cada módulo lateral</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-xs text-slate-300">
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><b className="text-white">Overview</b><br />Resumen ejecutivo de salud, riesgo y actividad.</div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><b className="text-white">Batches & Activation</b><br />Dónde nacen y se activan los tags o credenciales.</div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><b className="text-white">Analytics</b><br />Dónde se ve adopción, fraude, geografía y performance.</div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><b className="text-white">White-label / Resellers</b><br />Cómo escalar el negocio vía partners y cuentas enterprise.</div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><b className="text-white">Plans</b><br />Cómo se empaqueta monetización, renewals y expansión.</div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><b className="text-white">Demo Control</b><br />Versión rápida y limpia para reuniones comerciales.</div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><b className="text-white">Demo Lab</b><br />Orquestación completa con pitch, mobile y evidencia.</div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><b className="text-white">API Keys</b><br />Conectividad y gobierno técnico para integraciones reales.</div>
        </div>
      </Card>
      <Card className="p-4 text-xs text-slate-300">
        <p className="font-semibold text-cyan-200">ⓘ Mission control help</p>
        <p className="mt-2">Tenants: organización comercial. Batches: lotes de tags. Tags: unidades emitidas. Events: taps/alertas en vivo. Leads/Tickets/Orders: pipeline CRM-lite para seguimiento de negocio.</p>
      </Card>



      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Enterprise rollout readiness</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="font-semibold text-white">1. Batch governance</p>
            <p className="mt-2">Cada lote debe nacer con batch_id, SKU, perfil y volumen planificado definidos.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="font-semibold text-white">2. Supplier handoff</p>
            <p className="mt-2">El proveedor recibe URL template, ownership de keys y formato cerrado de manifest.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="font-semibold text-white">3. QA on arrival</p>
            <p className="mt-2">Importá solo manifests alineados con batch_id y compará planned / imported / active.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <p className="font-semibold text-white">4. Go-live discipline</p>
            <p className="mt-2">Activá únicamente las unidades recibidas y auditadas antes de abrirlas al mercado.</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Demo entry points</h2>
        <p className="mt-2 text-sm text-slate-400">Accesos directos para explorar el sistema completo desde landing profesional.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <Link className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-white" href="/demo-lab">Demo Lab</Link>
          <Link className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-white" href="/demo-sandbox">Sandbox anónimo</Link>
          <Link className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-white" href="/demo-lab/encode">Encode Station</Link>
          <Link className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-white" href="/demo-lab/mobile/demobodega/demo-item-001">Mobile preview</Link>
        </div>
      </Card>

      <ModuleGrid
        actionLabel={copy.shell.openModule}
        modules={[
          { title: copy.pages.tenants.title, description: copy.pages.tenants.description, href: "/tenants", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.batches.title, description: copy.pages.batches.description, href: "/batches", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.tags.title, description: copy.pages.tags.description, href: "/tags", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.events.title, description: copy.pages.events.description, href: "/events", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.resellers.title, description: copy.pages.resellers.description, href: "/resellers", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.apiKeys.title, description: copy.pages.apiKeys.description, href: "/api-keys", status: copy.statuses.pending, tone: "amber" },
        ]}
      />

      <DataTable
        title={copy.tables.tenants.title}
        columns={[
          { key: "tenant", label: copy.tables.tenants.tenant },
          { key: "status", label: copy.tables.tenants.status },
          { key: "scans", label: t.dashboard.kpis.scans },
          { key: "duplicates", label: t.dashboard.kpis.duplicates },
          { key: "tamper", label: t.dashboard.kpis.tamper },
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

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">{t.dashboard.roleBasedOps}</h2>
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

      <AdminActionForms copy={t.dashboard.forms} roles={copy.roles} readyLabel={copy.shell.ready} />
    </main>
  );
}
