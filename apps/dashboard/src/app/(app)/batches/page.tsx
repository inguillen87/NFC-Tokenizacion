import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../../components/admin-action-forms";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { requireDashboardSession } from "../../../lib/session";
import { getDashboardI18n } from "../../../lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

async function getBatchRows() {
  try {
    const response = await fetch(`${API_BASE}/admin/batches`, {
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
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const session = await requireDashboardSession();
  const batchRows = await getBatchRows();

  const rows = batchRows.map((row: Record<string, unknown>) => {
    const quantity = Number(row.quantity || 0);
    const active = Number(row.active_tags || 0);
    const inactive = Number(row.inactive_tags || 0);
    const requested = Number(row.requested_quantity || 0);
    const sku = String(row.sku || "-");
    const profile = String(row.batch_profile || "custom");
    return {
      batch: `${String(row.bid || "-")} · ${sku}`,
      type: `${profile} · ${String(row.tenant_slug || "ops")}`,
      status: String(row.status || "pending"),
      quantity: `${quantity.toLocaleString()} imported / ${requested.toLocaleString()} planned · ${active.toLocaleString()} active · ${inactive.toLocaleString()} pending`,
    };
  });

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.batches} title={copy.pages.batches.title} description={copy.pages.batches.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Batches muestran capacidad de emisión y control del inventario autenticable a escala.", decision: "Decidís qué líneas, regiones o partners tienen capacidad lista para crecer o requieren intervención.", cta: "Contalo como la capa donde el negocio se transforma en unidades emitibles y monetizables." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Batches es el punto donde se crean, activan, revocan e importan lotes para operación real.", decision: "Decidís qué lote activar, bloquear, importar o auditar según incidentes o rollout.", cta: "Leelo como el corazón operativo de emisión y lifecycle." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Batches demuestra que la solución no es artesanal: puede desplegarse por campañas, productos y mercados completos.", decision: "Decidís si el sistema escala desde piloto a rollout masivo sin perder control.", cta: "Mostralo cuando quieras hablar de implementación real y no solo de demo." }}
      />
      <Card className="p-5 text-sm text-slate-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Qué hacés acá en la práctica</h2>
          <Link href="/batches/supplier" className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">Register Supplier Batch</Link>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Crear o importar lotes nuevos para campañas, productos o partners.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Activar o revocar lotes según rollout, incidentes o compliance.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Conectar emisión con manifest, tags y perfil de producto.</div>
        </div>
      </Card>
      <DataTable title={copy.tables.batches.title} columns={[{ key: "batch", label: copy.tables.batches.batch }, { key: "type", label: copy.tables.batches.type }, { key: "status", label: copy.tables.batches.status }, { key: "quantity", label: copy.tables.batches.quantity }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Flujo recomendado para tags ya codificadas por proveedor</h2>
        <p className="mt-2 text-amber-100">No uses el form rápido de crear lote para supplier-coded tags si necesitás fijar K_META_BATCH y K_FILE_BATCH manualmente. Usá <Link href="/batches/supplier" className="underline decoration-amber-300/60 underline-offset-4">Register Supplier Batch</Link>.</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Crear el batch con tenant correcto, SKU, cantidad esperada y perfil de seguridad; guardar las batch keys que devuelve la API.</li>
          <li>Importar el CSV manifest y verificar que el <code>batch_id</code> del archivo coincida exactamente con el batch creado.</li>
          <li>Si las tags ya llegan programadas, activarlas en import o por cantidad/UID puntual para habilitar solo las unidades recibidas.</li>
          <li>Usar planned vs imported vs active para detectar temprano diferencias del proveedor antes de escalar a 10k/50k.</li>
        </ol>
      </Card>
      <AdminActionForms copy={t.dashboard.forms} roles={copy.roles} readyLabel={copy.shell.ready} currentRole={session.role} />
    </main>
  );
}
