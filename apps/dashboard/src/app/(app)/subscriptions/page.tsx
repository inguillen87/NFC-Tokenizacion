import Link from "next/link";
import { Badge, Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { requireDashboardTenantScope } from "../../../lib/admin-page-access";
import { TENANT_DIRECTORY, TENANT_DIRECTORY_SOURCE, type TenantDirectoryItem } from "../../../lib/tenant-directory";

type PlanKey = TenantDirectoryItem["plan"];
type SubscriptionStatus = "active" | "risk" | "pending";

type PlanCatalogItem = {
  label: string;
  monthlyListPrice: number;
  included: string;
  usage: string;
  sla: string;
  nextStep: string;
};

type SubscriptionAccount = TenantDirectoryItem & {
  scenarioRenewal: string;
  contractOwner: string;
  listPrice: number;
  usage: string;
  expansion: string;
  riskNote: string;
};

const PLAN_CATALOG: Record<PlanKey, PlanCatalogItem> = {
  basic: {
    label: "Pilot",
    monthlyListPrice: 1200,
    included: "QR/GS1 + CRM baseline",
    usage: "12k scans/mo",
    sla: "Business support",
    nextStep: "Move to Secure before public launch",
  },
  secure: {
    label: "Secure",
    monthlyListPrice: 4800,
    included: "NFC/QR, proof anchors, CRM, anti-replay",
    usage: "100k scans/mo",
    sla: "Priority support",
    nextStep: "Add marketplace, loyalty and advanced exports",
  },
  enterprise: {
    label: "Enterprise",
    monthlyListPrice: 12500,
    included: "Multi-tenant, API keys, webhooks, DPP-ready workflows",
    usage: "Unlimited contracted volume",
    sla: "Enterprise success path",
    nextStep: "Expand regions, API seats and partner channels",
  },
};

const SCENARIO_BY_TENANT: Record<string, Pick<SubscriptionAccount, "scenarioRenewal" | "contractOwner" | "usage" | "expansion" | "riskNote">> = {
  demobodega: {
    scenarioRenewal: "2026-09-18",
    contractOwner: "Owner de ejemplo",
    usage: "Volumen de ejemplo; billing no conectado",
    expansion: "Escenario: IOTA, Polygon y CRM",
    riskNote: "Cuenta demo para mostrar el flujo. No representa un cliente, contrato, uso ni revenue confirmado.",
  },
  "bodega-andes": {
    scenarioRenewal: "2026-09-01",
    contractOwner: "Owner ilustrativo",
    usage: "Escenario 78k / 100k; no observado",
    expansion: "Escenario: warranty + loyalty",
    riskNote: "Fixture comercial. No representa una cuenta ni una renovacion real.",
  },
  "cosmetica-norte": {
    scenarioRenewal: "2026-10-15",
    contractOwner: "Owner ilustrativo",
    usage: "Escenario 312k; no observado",
    expansion: "Escenario: marketplace + resellers",
    riskNote: "Fixture comercial. No representa crecimiento, SLA ni contrato real.",
  },
  "pharma-delta": {
    scenarioRenewal: "2026-08-20",
    contractOwner: "Owner ilustrativo",
    usage: "Escenario 64k / 100k; no observado",
    expansion: "Escenario: cold-chain + recalls",
    riskNote: "Fixture comercial. No representa una cuenta regulada ni un riesgo real.",
  },
  "event-ops-ar": {
    scenarioRenewal: "2026-08-05",
    contractOwner: "Owner ilustrativo",
    usage: "Escenario 2k / 12k; no observado",
    expansion: "Escenario: turnstile anti-replay",
    riskNote: "Fixture comercial. No representa un piloto ni una activacion contratada.",
  },
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function statusTone(status: SubscriptionStatus) {
  if (status === "active") return "green" as const;
  if (status === "risk") return "red" as const;
  return "amber" as const;
}

function planTone(plan: PlanKey) {
  if (plan === "enterprise") return "violet" as const;
  if (plan === "secure") return "cyan" as const;
  return "amber" as const;
}

function buildSubscriptionAccounts() {
  return TENANT_DIRECTORY.map((tenant): SubscriptionAccount => {
    const plan = PLAN_CATALOG[tenant.plan];
    const meta = SCENARIO_BY_TENANT[tenant.slug] || {
      scenarioRenewal: "2026-12-31",
      contractOwner: "Owner ilustrativo",
      usage: "Escenario sin baseline",
      expansion: "Escenario por definir",
      riskNote: "Fixture sin fuente comercial conectada.",
    };
    return {
      ...tenant,
      scenarioRenewal: meta.scenarioRenewal,
      contractOwner: meta.contractOwner,
      listPrice: plan.monthlyListPrice,
      usage: meta.usage,
      expansion: meta.expansion,
      riskNote: meta.riskNote,
    };
  });
}

function normalizeTenantParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || "").trim().toLowerCase();
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const session = await requireDashboardSession();
  const query = searchParams ? await searchParams : {};
  const requestedTenant = normalizeTenantParam(query.tenant);
  const scopedTenant = requireDashboardTenantScope(session, requestedTenant).tenantSlug;
  const accounts = buildSubscriptionAccounts();
  const visibleAccounts = scopedTenant ? accounts.filter((account) => account.slug === scopedTenant) : accounts;
  const primaryAccount = visibleAccounts[0] || accounts[0];
  const tenantQuery = primaryAccount ? `?tenant=${encodeURIComponent(primaryAccount.slug)}` : "";

  const rows = visibleAccounts.map((account) => ({
    tenant: account.tenant,
    source: account.source === "demo" ? "Demo" : "Ilustrativo",
    plan: PLAN_CATALOG[account.plan].label,
    status: `Ejemplo: ${account.status}`,
    renewal: `Ejemplo: ${account.scenarioRenewal}`,
    price: `${currency(account.listPrice)} lista modelada`,
    usage: account.usage,
    owner: account.contractOwner,
    expansion: account.expansion,
  }));

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow={copy.nav.subscriptions}
        title={scopedTenant ? `Escenario de plan: ${primaryAccount?.tenant || scopedTenant}` : "Simulador de planes y cuentas"}
        description="Vista ilustrativa para modelar precios, renovaciones, uso y expansion. Billing y contratos reales todavia no estan conectados a esta pantalla."
      />

      <ModuleAudienceHero
        ceo={{
          eyebrow: "CEO / Investor read",
          summary: "Subscriptions modela como se verian precios, renovaciones y expansion cuando billing este conectado; hoy usa fixtures visibles.",
          decision: "Proba escenarios comerciales sin confundirlos con MRR, clientes ni contratos confirmados.",
          cta: "Usalo como prototipo operativo y conecta billing antes de usarlo como reporte financiero.",
        }}
        operator={{
          eyebrow: "Operator / Engineer read",
          summary: "Cada plan ilustrativo traduce volumen, SLA, API, webhooks y proof anchors en una configuracion posible.",
          decision: "Disena el entitlement; no habilites features hasta confirmar el contrato en una fuente real.",
          cta: "Leelo como la union entre plataforma, billing y operacion.",
        }}
        buyer={{
          eyebrow: "Buyer / Client read",
          summary: "El comprador puede explorar un recorrido de escalamiento con precios y capacidades modelados.",
          decision: "Decidis si el plan cubre el rollout actual y que modulo conviene activar despues.",
          cta: "Mostralo cuando el comprador pregunte como crece nexID dentro de su empresa.",
        }}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Fuente</p>
          <p className="mt-3 text-3xl font-black text-white">Ejemplo</p>
          <p className="mt-2 text-sm text-slate-400">{TENANT_DIRECTORY_SOURCE}; sin billing conectado</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Precio del escenario</p>
          <p className="mt-3 text-3xl font-black text-white">{primaryAccount ? currency(primaryAccount.listPrice) : "—"}</p>
          <p className="mt-2 text-sm text-slate-400">Precio mensual modelado; no es MRR contratado.</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">MRR real</p>
          <p className="mt-3 text-3xl font-black text-white">No disponible</p>
          <p className="mt-2 text-sm text-slate-400">No se infiere revenue desde fixtures.</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">Renovaciones reales</p>
          <p className="mt-3 text-2xl font-black text-white">No conectadas</p>
          <p className="mt-2 text-sm text-slate-400">Las fechas de la tabla son escenarios de UX.</p>
        </Card>
      </section>

      {primaryAccount ? (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Escenario seleccionado</p>
                <h2 className="mt-2 text-2xl font-black text-white">{primaryAccount.tenant}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{primaryAccount.riskNote}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={planTone(primaryAccount.plan)}>{PLAN_CATALOG[primaryAccount.plan].label}</Badge>
                <Badge tone={statusTone(primaryAccount.status)}>estado ejemplo: {primaryAccount.status}</Badge>
                <Badge>{primaryAccount.source === "demo" ? "demo" : "ilustrativo"}</Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Incluye</p>
                <p className="mt-2 text-sm font-bold text-white">{PLAN_CATALOG[primaryAccount.plan].included}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Uso modelado</p>
                <p className="mt-2 text-sm font-bold text-white">{primaryAccount.usage}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">SLA propuesto</p>
                <p className="mt-2 text-sm font-bold text-white">{PLAN_CATALOG[primaryAccount.plan].sla}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Expansion modelada</p>
                <p className="mt-2 text-sm font-bold text-white">{primaryAccount.expansion}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Acciones de cuenta</p>
            <div className="mt-4 grid gap-2 text-sm">
              <Link href={`/tenants/${primaryAccount.slug}`} className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 font-bold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-400/16">
                Abrir perfil del tenant
              </Link>
              <Link href={`/api-keys${tenantQuery}`} className="rounded-xl border border-violet-300/25 bg-violet-500/10 px-4 py-3 font-bold text-violet-100 transition hover:border-violet-200/60 hover:bg-violet-500/16">
                Ver API keys y webhooks
              </Link>
              <Link href={`/leads-tickets${tenantQuery}`} className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 font-bold text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-500/16">
                Crear follow-up comercial
              </Link>
              <Link href="/sales-playbook" className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 font-bold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100">
                Abrir playbook de ROI
              </Link>
            </div>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        {Object.entries(PLAN_CATALOG).map(([plan, item]) => (
          <div key={plan} className={`rounded-2xl border p-5 ${plan === "enterprise" ? "border-violet-300/30 bg-violet-500/10" : plan === "secure" ? "border-cyan-300/25 bg-cyan-500/10" : "border-white/10 bg-slate-900/70"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone={planTone(plan as PlanKey)}>{item.label}</Badge>
                <h3 className="mt-4 text-xl font-black text-white">{currency(item.monthlyListPrice)} / mes</h3>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">{item.usage}</span>
            </div>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-100">Precio modelado; no es MRR contratado</p>
            <p className="mt-4 text-sm leading-6 text-slate-300">{item.included}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">{item.nextStep}</p>
          </div>
        ))}
      </section>

      <DataTable
        title="Escenarios ilustrativos de suscripcion"
        columns={[
          { key: "tenant", label: copy.tables.subscriptions.tenant },
          { key: "source", label: "Fuente" },
          { key: "plan", label: copy.tables.subscriptions.plan },
          { key: "status", label: "Estado ilustrativo" },
          { key: "renewal", label: "Fecha ilustrativa" },
          { key: "price", label: "Precio modelado" },
          { key: "usage", label: "Uso modelado" },
          { key: "owner", label: "Owner ilustrativo" },
          { key: "expansion", label: "Expansion modelada" },
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
