import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { tenant: "Bodega Andes", plan: "secure", status: "active", renewal: "2026-08-01" },
  { tenant: "Cosmetica Norte", plan: "enterprise", status: "active", renewal: "2026-05-15" },
  { tenant: "Event Ops AR", plan: "basic", status: "pending", renewal: "2026-04-10" },
];

export default async function SubscriptionsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.subscriptions} title={copy.pages.subscriptions.title} description={copy.pages.subscriptions.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Subscriptions muestran revenue recurrente, renovaciones y expansión de valor por tenant.", decision: "Decidís dónde proteger renewals, empujar upgrades y detectar churn temprano.", cta: "Usalo para contar estabilidad y calidad de ingresos." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Subscriptions alinean capacidad de servicio con el plan contratado y el estado operativo del tenant.", decision: "Decidís qué SLA, features o soporte sostener según renovación o riesgo de cuenta.", cta: "Leelo como contrato vivo entre plataforma y operación real." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Subscriptions muestra que el producto puede crecer con tu cuenta y no obliga a sobredimensionar desde el día uno.", decision: "Decidís cuándo renovar, escalar plan o sumar capacidades según adopción real.", cta: "Mostralo como continuidad comercial y evolución natural del producto." }}
      />
      <DataTable title={copy.tables.subscriptions.title} columns={[{ key: "tenant", label: copy.tables.subscriptions.tenant }, { key: "plan", label: copy.tables.subscriptions.plan }, { key: "status", label: copy.tables.subscriptions.status }, { key: "renewal", label: copy.tables.subscriptions.renewal }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
    </main>
  );
}
