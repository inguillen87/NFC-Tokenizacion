import Link from "next/link";
import { Badge, Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { TENANT_DIRECTORY, type TenantDirectoryItem } from "../../../lib/tenant-directory";

type PlanKey = TenantDirectoryItem["plan"];
type SubscriptionStatus = "active" | "risk" | "pending";

type PlanCatalogItem = {
  label: string;
  mrr: number;
  included: string;
  usage: string;
  sla: string;
  nextStep: string;
};

type SubscriptionAccount = TenantDirectoryItem & {
  renewal: string;
  contractOwner: string;
  mrr: number;
  usage: string;
  expansion: string;
  riskNote: string;
};

const PLAN_CATALOG: Record<PlanKey, PlanCatalogItem> = {
  basic: {
    label: "Pilot",
    mrr: 1200,
    included: "QR/GS1 + CRM baseline",
    usage: "12k scans/mo",
    sla: "Business support",
    nextStep: "Move to Secure before public launch",
  },
  secure: {
    label: "Secure",
    mrr: 4800,
    included: "NFC/QR, proof anchors, CRM, anti-replay",
    usage: "100k scans/mo",
    sla: "Priority support",
    nextStep: "Add marketplace, loyalty and advanced exports",
  },
  enterprise: {
    label: "Enterprise",
    mrr: 12500,
    included: "Multi-tenant, API keys, webhooks, DPP-ready workflows",
    usage: "Unlimited contracted volume",
    sla: "Enterprise success path",
    nextStep: "Expand regions, API seats and partner channels",
  },
};

const RENEWAL_BY_TENANT: Record<string, Pick<SubscriptionAccount, "renewal" | "contractOwner" | "usage" | "expansion" | "riskNote">> = {
  demobodega: {
    renewal: "2026-09-18",
    contractOwner: "Founder + Enterprise success",
    usage: "Demo live / enterprise scope",
    expansion: "IOTA proof, Polygon ownership and CRM growth",
    riskNote: "Cuenta demo enterprise para mostrar plan, uso, API y expansion sin mezclar clientes reales",
  },
  "bodega-andes": {
    renewal: "2026-09-01",
    contractOwner: "Revenue + Ops",
    usage: "78k scans / 100k",
    expansion: "Warranty + loyalty club",
    riskNote: "Healthy renewal; push ownership module",
  },
  "cosmetica-norte": {
    renewal: "2026-10-15",
    contractOwner: "Enterprise success",
    usage: "312k scans / contracted",
    expansion: "Marketplace + reseller portal",
    riskNote: "High growth; protect enterprise SLA",
  },
  "pharma-delta": {
    renewal: "2026-08-20",
    contractOwner: "Compliance + QA",
    usage: "64k scans / 100k",
    expansion: "Cold-chain proof + recall workflow",
    riskNote: "Compliance follow-up before renewal",
  },
  "event-ops-ar": {
    renewal: "2026-08-05",
    contractOwner: "Pilot owner",
    usage: "2k validations / 12k",
    expansion: "Turnstile anti-replay package",
    riskNote: "Pilot pending; needs activation owner",
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
    const meta = RENEWAL_BY_TENANT[tenant.slug] || {
      renewal: "2026-12-31",
      contractOwner: "Enterprise success",
      usage: "Pending contract baseline",
      expansion: "Define rollout path",
      riskNote: "Tenant pendiente de baseline comercial",
    };
    return {
      ...tenant,
      renewal: meta.renewal,
      contractOwner: meta.contractOwner,
      mrr: plan.mrr,
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

function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00.000Z`).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((target - now) / (24 * 60 * 60 * 1000)));
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
  const sessionTenant = String(session.tenantSlug || "").trim().toLowerCase();
  const scopedTenant = session.role === "tenant-admin" ? sessionTenant : requestedTenant;
  const accounts = buildSubscriptionAccounts();
  const visibleAccounts = scopedTenant ? accounts.filter((account) => account.slug === scopedTenant) : accounts;
  const primaryAccount = visibleAccounts[0] || accounts[0];
  const totalMrr = visibleAccounts.reduce((sum, account) => sum + account.mrr, 0);
  const atRisk = visibleAccounts.filter((account) => account.status === "risk").length;
  const active = visibleAccounts.filter((account) => account.status === "active").length;
  const renewalQueue = [...visibleAccounts].sort((a, b) => a.renewal.localeCompare(b.renewal));
  const nextRenewal = renewalQueue[0];
  const tenantQuery = primaryAccount ? `?tenant=${encodeURIComponent(primaryAccount.slug)}` : "";

  const rows = visibleAccounts.map((account) => ({
    tenant: account.tenant,
    plan: PLAN_CATALOG[account.plan].label,
    status: account.status,
    renewal: account.renewal,
    mrr: currency(account.mrr),
    usage: account.usage,
    owner: account.contractOwner,
    expansion: account.expansion,
  }));

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow={copy.nav.subscriptions}
        title={scopedTenant ? `Plan y revenue: ${primaryAccount?.tenant || scopedTenant}` : copy.pages.subscriptions.title}
        description="Command center de contratos: MRR, renovaciones, uso contratado, riesgo de churn, expansion y acciones concretas por tenant."
      />

      <ModuleAudienceHero
        ceo={{
          eyebrow: "CEO / Investor read",
          summary: "Subscriptions muestra revenue recurrente, riesgo de renovacion y expansion por cuenta sin esconderlo en una tabla tecnica.",
          decision: "Decidis donde proteger renewals, empujar upgrades y defender margen enterprise.",
          cta: "Usalo como prueba de negocio SaaS: no solo tags, tambien contrato, uso y crecimiento.",
        }}
        operator={{
          eyebrow: "Operator / Engineer read",
          summary: "Cada plan se traduce en capacidad operativa: volumen, SLA, API, webhooks, soporte, proof anchors y controles por tenant.",
          decision: "Decidis que features, soporte o integraciones habilitar segun el contrato real.",
          cta: "Leelo como la union entre plataforma, billing y operacion.",
        }}
        buyer={{
          eyebrow: "Buyer / Client read",
          summary: "El cliente entiende que puede arrancar chico y escalar sin redisenar toda su operacion.",
          decision: "Decidis si el plan cubre el rollout actual y que modulo conviene activar despues.",
          cta: "Mostralo cuando el comprador pregunte como crece nexID dentro de su empresa.",
        }}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">MRR visible</p>
          <p className="mt-3 text-3xl font-black text-white">{currency(totalMrr)}</p>
          <p className="mt-2 text-sm text-slate-400">{visibleAccounts.length} cuenta{visibleAccounts.length === 1 ? "" : "s"} en scope</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Renewals sanos</p>
          <p className="mt-3 text-3xl font-black text-white">{active}</p>
          <p className="mt-2 text-sm text-slate-400">Cuentas activas con continuidad operativa.</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">Riesgo comercial</p>
          <p className="mt-3 text-3xl font-black text-white">{atRisk}</p>
          <p className="mt-2 text-sm text-slate-400">Cuenta con follow-up antes de renovar.</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">Proximo hito</p>
          <p className="mt-3 text-2xl font-black text-white">{nextRenewal?.renewal || "Sin agenda"}</p>
          <p className="mt-2 text-sm text-slate-400">{nextRenewal ? `${daysUntil(nextRenewal.renewal)} dias para ${nextRenewal.tenant}` : "No hay renovaciones."}</p>
        </Card>
      </section>

      {primaryAccount ? (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Cuenta prioritaria</p>
                <h2 className="mt-2 text-2xl font-black text-white">{primaryAccount.tenant}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{primaryAccount.riskNote}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={planTone(primaryAccount.plan)}>{PLAN_CATALOG[primaryAccount.plan].label}</Badge>
                <Badge tone={statusTone(primaryAccount.status)}>{primaryAccount.status}</Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Incluye</p>
                <p className="mt-2 text-sm font-bold text-white">{PLAN_CATALOG[primaryAccount.plan].included}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Uso</p>
                <p className="mt-2 text-sm font-bold text-white">{primaryAccount.usage}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">SLA</p>
                <p className="mt-2 text-sm font-bold text-white">{PLAN_CATALOG[primaryAccount.plan].sla}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Expansion</p>
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
                <h3 className="mt-4 text-xl font-black text-white">{currency(item.mrr)} / mo</h3>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">{item.usage}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{item.included}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">{item.nextStep}</p>
          </div>
        ))}
      </section>

      <DataTable
        title={copy.tables.subscriptions.title}
        columns={[
          { key: "tenant", label: copy.tables.subscriptions.tenant },
          { key: "plan", label: copy.tables.subscriptions.plan },
          { key: "status", label: copy.tables.subscriptions.status },
          { key: "renewal", label: copy.tables.subscriptions.renewal },
          { key: "mrr", label: "MRR" },
          { key: "usage", label: "Uso" },
          { key: "owner", label: "Owner" },
          { key: "expansion", label: "Expansion" },
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
