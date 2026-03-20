import { Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { tenant: "Bodega Andes", result: "valid", status: "active", geo: "AR-MDZ", time: "14:21" },
  { tenant: "Bodega Andes", result: "duplicate", status: "risk", geo: "AR-MDZ", time: "14:22" },
  { tenant: "Pharma Delta", result: "tamper", status: "risk", geo: "CL-SCL", time: "14:25" },
  { tenant: "Event Ops AR", result: "valid", status: "active", geo: "AR-CBA", time: "14:29" },
];

export default async function EventsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.events} title={copy.pages.events.title} description={copy.pages.events.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Events muestran actividad real, alertas y evidencia de que la plataforma protege operaciones activas.", decision: "Decidís qué cuentas o verticales tienen mayor tracción o mayor riesgo operacional.", cta: "Usalo como feed vivo para probar que el sistema ya está operando y generando valor." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Events es la consola para revisar autenticaciones, replay, tamper y comportamiento en tiempo casi real.", decision: "Decidís dónde investigar anomalías, ajustar reglas y priorizar incident response.", cta: "Conectalo mentalmente con Analytics, Ops Map y API Keys." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Events demuestra que el sistema no solo promete: detecta riesgos y confirma autenticidad en escenarios reales.", decision: "Decidís si esta visibilidad mejora confianza y control en tu operación o canal.", cta: "Mostralo después del mobile preview para cerrar con evidencia operacional." }}
      />
      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Cómo leer este feed</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><b className="text-white">valid</b><br />Autenticidad y flujo esperado.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><b className="text-white">duplicate</b><br />Relectura o posible clonación/replay.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><b className="text-white">tamper</b><br />Apertura o manipulación sospechosa.</div>
        </div>
      </Card>
      <DataTable
        title={copy.tables.events.title}
        columns={[
          { key: "tenant", label: copy.tables.events.tenant },
          { key: "result", label: copy.tables.events.result },
          { key: "status", label: copy.tables.events.status },
          { key: "geo", label: copy.tables.events.geo },
          { key: "time", label: copy.tables.events.time },
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
