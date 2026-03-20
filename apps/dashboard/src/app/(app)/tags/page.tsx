import { Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { profile: "NTAG215", status: "active", inventory: "54,200", activation: "92%" },
  { profile: "NTAG 424 DNA TT", status: "active", inventory: "21,400", activation: "87%" },
  { profile: "TagTamper Seal", status: "pending", inventory: "8,000", activation: "0%" },
];

export default async function TagsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.tags} title={copy.pages.tags.title} description={copy.pages.tags.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Tags muestran el activo base del negocio: inventario, activación y capacidad de protección por perfil tecnológico.", decision: "Decidís qué tecnología empuja margen, seguridad y escalabilidad por vertical o cliente.", cta: "Usalo para explicar la profundidad tecnológica detrás del producto." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Tags es la vista donde comparás perfiles, stock disponible y activación efectiva en operación.", decision: "Decidís qué perfil desplegar, dónde falta activación y qué capacidad queda para nuevas emisiones.", cta: "Leelo como catálogo operativo de hardware/identity substrate." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Tags traduce tecnología compleja a algo simple: qué tan protegido está tu producto y cuán listo está para desplegarse.", decision: "Decidís si necesitás algo básico, secure o tamper-evident según tu riesgo y experiencia deseada.", cta: "Mostralo si el cliente pregunta qué hay detrás de la experiencia mobile o de autenticidad." }}
      />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Por qué importa</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Inventario disponible para campañas y producción.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Nivel de seguridad por perfil físico/digital.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Activación real sobre unidades ya emitidas.</div>
        </div>
      </Card>
      <DataTable title={copy.tables.tags.title} columns={[{ key: "profile", label: copy.tables.tags.profile }, { key: "status", label: copy.tables.tags.status }, { key: "inventory", label: copy.tables.tags.inventory }, { key: "activation", label: copy.tables.tags.activation }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
    </main>
  );
}
