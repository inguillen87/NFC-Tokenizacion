import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { productUrls } from "@product/config";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { QuickOnboardingPanel } from "../../../components/quick-onboarding-panel";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";

const API_BASE = productUrls.api;

async function getBatchRows(tenantScope = "") {
  try {
    const query = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";
    const response = await fetch(`${API_BASE}/admin/batches${query}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [] as Array<Record<string, unknown>>;
    return response.json();
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

export default async function BatchesPage() {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession("batches:read");
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";
  const isTenantAdmin = session.role === "tenant-admin";
  const copy = dashboardContent[locale];
  const batchRows = await getBatchRows(tenantScope);

  const rows = batchRows.map((row: Record<string, unknown>) => {
    const quantity = Number(row.quantity || 0);
    const active = Number(row.active_tags || 0);
    const inactive = Number(row.inactive_tags || 0);
    const requested = Number(row.requested_quantity || 0);
    const sku = row.sku ? String(row.sku) : "SKU pendiente";
    const profile = row.batch_profile ? String(row.batch_profile) : "Perfil pendiente";
    return {
      batch: `${String(row.bid || "BID pendiente")} - ${sku}`,
      type: `${profile} - ${String(row.tenant_slug || "tenant pendiente")}`,
      status: String(row.status || "pending"),
      quantity: `${quantity.toLocaleString()} imported / ${requested.toLocaleString()} planned - ${active.toLocaleString()} active - ${inactive.toLocaleString()} pending`,
    };
  });

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.batches} title={copy.pages.batches.title} description={copy.pages.batches.description} />
      <Card className="p-4 text-sm text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>.
      </Card>
      <ModuleAudienceHero
        ceo={{
          eyebrow: "CEO / Investor read",
          summary: "Batches muestran capacidad de emision y control del inventario autenticable a escala.",
          decision: "Decidis que lineas, regiones o partners tienen capacidad lista para crecer o requieren intervencion.",
          cta: "Contalo como la capa donde el negocio se transforma en unidades emitibles y monetizables.",
        }}
        operator={{
          eyebrow: "Operator / Engineer read",
          summary: "Batches es el punto donde se crean, activan, revocan e importan lotes para operacion real.",
          decision: "Decidis que lote activar, bloquear, importar o auditar segun incidentes o rollout.",
          cta: "Leelo como el corazon operativo de emision y lifecycle.",
        }}
        buyer={{
          eyebrow: "Buyer / Client read",
          summary: "Batches demuestra que la solucion puede desplegarse por campanas, productos y mercados completos.",
          decision: "Decidis si el sistema escala desde piloto a rollout masivo sin perder control.",
          cta: "Mostralo cuando quieras hablar de implementacion real y no solo de demo.",
        }}
      />
      {!isTenantAdmin ? (
        <Card className="p-5 text-sm text-slate-300">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Elegi modo de operacion</h2>
          <p className="mt-2 text-xs text-slate-400">Separado en dos flujos para evitar confusion: lote interno vs lote supplier programado por proveedor.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">Modo 1</p>
              <p className="mt-1 text-base font-semibold text-white">Create internal batch</p>
              <p className="mt-2 text-xs text-slate-300">Para lotes que nacen dentro de nexID. Puede autogenerar keys.</p>
              <Link href="/batches/internal" className="mt-3 inline-block rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">Open internal flow</Link>
            </div>
            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-amber-200">Modo 2</p>
              <p className="mt-1 text-base font-semibold text-white">Register supplier batch</p>
              <p className="mt-2 text-xs text-slate-300">Para tags programadas por proveedor. K_META_BATCH y K_FILE_BATCH obligatorias.</p>
              <Link href="/batches/supplier" className="mt-3 inline-block rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Open supplier wizard</Link>
            </div>
          </div>
        </Card>
      ) : null}
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Wizard lineal recomendado (1 - 7)</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {[
            "1) Crear tenant passport completo",
            "2) Registrar batch proveedor",
            "3) Cargar llaves K_META/K_FILE",
            "4) Importar TXT/CSV con preflight",
            "5) Activar tags importadas",
            "6) Validar URL /sun real",
            "7) Entregar portal y permisos al operador",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">{item}</div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/batches/supplier" className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Abrir supplier wizard</Link>
          <Link href="/onboarding" className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">Abrir onboarding guiado</Link>
        </div>
      </Card>
      <QuickOnboardingPanel context="dashboard" />
      <DataTable
        title={copy.tables.batches.title}
        columns={[
          { key: "batch", label: copy.tables.batches.batch },
          { key: "type", label: copy.tables.batches.type },
          { key: "status", label: copy.tables.batches.status },
          { key: "quantity", label: copy.tables.batches.quantity },
        ]}
        rows={rows}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />
    </main>
  );
}
