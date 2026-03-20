import { Card, SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../../components/admin-action-forms";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { batch: "WINE-AR-2026-03", type: "secure", status: "active", quantity: "10,000" },
  { batch: "COS-BR-2026-01", type: "secure", status: "active", quantity: "8,500" },
  { batch: "EVENT-AR-APRIL", type: "basic", status: "pending", quantity: "3,000" },
  { batch: "PHARMA-CL-09", type: "secure", status: "revoked", quantity: "1,200" },
];

export default async function BatchesPage() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.batches} title={copy.pages.batches.title} description={copy.pages.batches.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Batches muestran capacidad de emisión y control del inventario autenticable a escala.", decision: "Decidís qué líneas, regiones o partners tienen capacidad lista para crecer o requieren intervención.", cta: "Contalo como la capa donde el negocio se transforma en unidades emitibles y monetizables." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Batches es el punto donde se crean, activan, revocan e importan lotes para operación real.", decision: "Decidís qué lote activar, bloquear, importar o auditar según incidentes o rollout.", cta: "Leelo como el corazón operativo de emisión y lifecycle." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Batches demuestra que la solución no es artesanal: puede desplegarse por campañas, productos y mercados completos.", decision: "Decidís si el sistema escala desde piloto a rollout masivo sin perder control.", cta: "Mostralo cuando quieras hablar de implementación real y no solo de demo." }}
      />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Qué hacés acá en la práctica</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Crear o importar lotes nuevos para campañas, productos o partners.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Activar o revocar lotes según rollout, incidentes o compliance.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Conectar emisión con manifest, tags y perfil de producto.</div>
        </div>
      </Card>
      <DataTable title={copy.tables.batches.title} columns={[{ key: "batch", label: copy.tables.batches.batch }, { key: "type", label: copy.tables.batches.type }, { key: "status", label: copy.tables.batches.status }, { key: "quantity", label: copy.tables.batches.quantity }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
      <AdminActionForms copy={t.dashboard.forms} roles={copy.roles} readyLabel={copy.shell.ready} />
    </main>
  );
}
