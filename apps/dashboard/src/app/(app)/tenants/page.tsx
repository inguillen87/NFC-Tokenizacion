import { Card, SectionHeading } from "@product/ui";
import Link from "next/link";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { tenant: "Bodega Andes", slug: "bodega-andes", plan: "secure", status: "active", region: "AR" },
  { tenant: "Cosmetica Norte", slug: "cosmetica-norte", plan: "enterprise", status: "active", region: "BR" },
  { tenant: "Pharma Delta", slug: "pharma-delta", plan: "secure", status: "risk", region: "CL" },
  { tenant: "Event Ops AR", slug: "event-ops-ar", plan: "basic", status: "pending", region: "AR" },
];

export default async function TenantsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.tenants} title={copy.pages.tenants.title} description={copy.pages.tenants.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Tenants son tu mapa de cuentas activas: clientes, regiones, planes y salud operativa.", decision: "Decidís dónde expandir, qué cuenta está en riesgo y qué mix de planes sostiene el negocio.", cta: "Usalo para mostrar cartera activa y potencial de expansión." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Tenants organiza multi-tenant real: qué cliente existe, en qué estado está y bajo qué plan opera.", decision: "Decidís prioridad de soporte, rollout, compliance o investigación según estado del tenant.", cta: "Leelo como la capa de gobierno de cuentas enterprise." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Tenants demuestra que la plataforma puede operar muchas marcas o unidades de negocio sin mezclar datos ni flujos.", decision: "Decidís si esto sirve para escalar por país, marca, canal o filial.", cta: "Mostralo cuando alguien dude de la capacidad multi-tenant del producto." }}
      />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Qué sentido tiene esta vista</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Ver clientes activos por región y plan.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Detectar cuentas en riesgo antes de impacto comercial.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Coordinar expansión, soporte y monetización por tenant.</div>
        </div>
      </Card>
      <DataTable title={copy.tables.tenants.title} columns={[{ key: "tenant", label: copy.tables.tenants.tenant }, { key: "plan", label: copy.tables.tenants.plan }, { key: "status", label: copy.tables.tenants.status }, { key: "region", label: copy.tables.tenants.region }]} rows={rows.map(({ slug, ...rest }) => rest)} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Tenant actions (usar en demo comercial)</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {rows.map((tenant) => (
            <div key={tenant.slug} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="font-semibold text-white">{tenant.tenant}</p>
              <p className="mt-1 text-xs text-slate-400">{tenant.slug} · {tenant.region} · {tenant.plan}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
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
