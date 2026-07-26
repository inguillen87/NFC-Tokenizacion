import { Card, SectionHeading } from "@product/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { TENANT_DIRECTORY, TENANT_DIRECTORY_SOURCE } from "../../../lib/tenant-directory";
import { requireDashboardSession } from "../../../lib/session";

export default async function TenantsPage() {
  const session = await requireDashboardSession();
  if (session.role !== "super-admin") notFound();
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.tenants} title="Directorio ilustrativo de tenants" description="Fixtures para recorrer la UX multi-tenant. No representan clientes, contratos, revenue ni health productivo." />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read · DEMO", summary: "Esta vista modela cómo se ordenarían cuentas, regiones, planes y health cuando el directorio productivo esté conectado.", decision: "Evaluá la UX y el modelo operativo; no uses estos fixtures como evidencia de clientes o cartera activa.", cta: "Conectá el tenant API y billing antes de usarla como reporte comercial." }}
        operator={{ eyebrow: "Operator / Engineer read · DEMO", summary: "El directorio ilustra gobierno multi-tenant, soporte y rollout con identidades ficticias claramente marcadas.", decision: "Probá navegación y permisos; confirmá cualquier estado en la fuente operativa correspondiente.", cta: "Leelo como prototipo de la capa de gobierno enterprise." }}
        buyer={{ eyebrow: "Buyer / Client read · DEMO", summary: "El escenario muestra cómo nexID puede separar marcas o unidades sin afirmar que estas cuentas existen.", decision: "Evaluá si el modelo sirve para escalar por país, marca, canal o filial.", cta: "Usalo como demostración funcional, no como lista de referencias comerciales." }}
      />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Fuente: {TENANT_DIRECTORY_SOURCE}</h2>
        <p className="mt-2 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-amber-50">Todos los registros son demo o ilustrativos. No se agregan como clientes, cuentas activas ni métricas de negocio.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Probar segmentación por región y plan.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Ensayar estados y workflows de seguimiento.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Validar navegación y aislamiento por tenant.</div>
        </div>
      </Card>
      <DataTable title="Escenarios de tenant (no clientes reales)" columns={[{ key: "tenant", label: copy.tables.tenants.tenant }, { key: "source", label: "Fuente" }, { key: "plan", label: "Plan ilustrativo" }, { key: "status", label: "Estado ilustrativo" }, { key: "region", label: copy.tables.tenants.region }]} rows={TENANT_DIRECTORY.map(({ slug, ...rest }) => rest)} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Acciones sobre fixtures de demostración</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {TENANT_DIRECTORY.map((tenant) => (
            <div key={tenant.slug} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="font-semibold text-white">{tenant.tenant}</p>
              <p className="mt-1 text-xs text-slate-400">{tenant.source.toUpperCase()} · {tenant.slug} · {tenant.region} · {tenant.plan}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link href={`/tenants/${tenant.slug}`} className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-100">Overview</Link>
                <Link href={`/events?tenant=${tenant.slug}`} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-slate-100">Ver eventos</Link>
                <Link href={`/analytics?tenant=${tenant.slug}`} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-1.5 text-cyan-100">Ver analytics</Link>
                <Link href={`/batches?tenant=${tenant.slug}`} className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-2.5 py-1.5 text-violet-100">Ver lotes</Link>
                <Link href={`/leads-tickets?tenant=${tenant.slug}`} className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2.5 py-1.5 text-amber-100">Soporte/CRM</Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
