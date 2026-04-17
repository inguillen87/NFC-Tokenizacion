import { Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

async function adminGet(path: string) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });

    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

function parseMeta(raw: unknown, key: string) {
  const text = String(raw || "");
  const pattern = new RegExp(`(?:\\[|\\b|\\|\\s*)${key}=([^\\]\\|\\s]+)`, "i");
  const match = text.match(pattern);
  return match?.[1] || "";
}

function inferTenantScope(session: { role: string; email: string }) {
  if (session.role !== "tenant-admin") return "";
  const email = session.email.toLowerCase();
  const explicit = email.match(/(?:admin|ops|tenant)[._-]([a-z0-9-]+)/)?.[1];
  if (explicit) return explicit;
  if (email.includes("demobodega")) return "demobodega";
  return "";
}

function leadTenant(lead: Record<string, unknown>) {
  return (parseMeta(lead.message, "tenant") || parseMeta(lead.notes, "tenant") || String(lead.tenant_slug || "")).toLowerCase();
}

export default async function LeadsTicketsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const tenantFilter = String(query.tenant || "").trim().toLowerCase();
  const sessionFilter = String(query.session || "").trim().toLowerCase();
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const tenantScope = inferTenantScope(session);
  const isTenantAdmin = session.role === "tenant-admin";
  const copy = dashboardContent[locale];

  const [leads, tickets, orders] = await Promise.all([
    adminGet("/admin/leads"),
    adminGet("/admin/tickets"),
    adminGet("/admin/orders"),
  ]);

  const leadsArray = Array.isArray(leads) ? leads as Array<Record<string, unknown>> : [];
  const scopedLeads = tenantScope ? leadsArray.filter((lead) => leadTenant(lead) === tenantScope) : leadsArray;
  const scopedTickets = Array.isArray(tickets)
    ? (tenantScope ? tickets.filter((item: Record<string, unknown>) => String(item.tenant_slug || "").toLowerCase() === tenantScope) : tickets)
    : [];
  const scopedOrders = Array.isArray(orders)
    ? (tenantScope ? orders.filter((item: Record<string, unknown>) => String(item.tenant_slug || "").toLowerCase() === tenantScope) : orders)
    : [];
  const leadCount = scopedLeads.length;
  const ticketCount = scopedTickets.length;
  const orderCount = scopedOrders.length;
  const hotPipeline = leadCount + orderCount;

  const ctaOpportunities = leadsArray
    .map((lead) => {
      const tenant = parseMeta(lead.message, "tenant") || parseMeta(lead.notes, "tenant");
      const session = parseMeta(lead.message, "session") || parseMeta(lead.notes, "session");
      const interest = parseMeta(lead.message, "interest") || String(lead.role_interest || "-");
      return { lead, tenant, session, interest, source: String(lead.source || "unknown") };
    })
    .filter((item) => item.source.includes("public") || item.source.includes("demo"));
  const effectiveTenantFilter = tenantScope || tenantFilter;
  const filteredOpportunities = ctaOpportunities.filter((item) => {
    const byTenant = effectiveTenantFilter ? item.tenant.toLowerCase() === effectiveTenantFilter : true;
    const bySession = sessionFilter ? item.session.toLowerCase().includes(sessionFilter) : true;
    return byTenant && bySession;
  });
  const sourceStats = scopedLeads.reduce((acc, lead) => {
    const source = String(lead.source || "unknown");
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topSources = Object.entries(sourceStats).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const labels = locale === "en"
    ? {
        leads: "Leads",
        tickets: "Tickets",
        orders: "Orders",
        hot: "Hot pipeline",
        feed: "Commercial control room feed",
      }
    : locale === "pt-BR"
    ? {
        leads: "Leads",
        tickets: "Tickets",
        orders: "Pedidos",
        hot: "Pipeline quente",
        feed: "Feed comercial de controle",
      }
    : {
        leads: "Leads",
        tickets: "Tickets",
        orders: "Órdenes",
        hot: "Pipeline caliente",
        feed: "Feed comercial de control",
      };

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.leadsTickets} title={copy.pages.leadsTickets.title} description={copy.pages.leadsTickets.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: isTenantAdmin ? "Leads & Tickets del tenant: demanda, soporte y señal comercial en una sola vista." : "Leads & Tickets muestra demanda, soporte y señal comercial en un mismo tablero.", decision: "Decidís si el pipeline está sano, si el interés se convierte y si soporte acompaña crecimiento.", cta: "Usalo para mostrar que la plataforma también mueve negocio, no solo autenticación." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Esta vista mezcla input comercial y soporte para que la operación responda con contexto.", decision: "Decidís dónde priorizar onboarding, resolver incidencias y coordinar abastecimiento o activación.", cta: "Leelo como mesa de control entre customer success, ops y soporte." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Leads & Tickets demuestra que la experiencia sigue viva después de venderse: onboarding, soporte y pedidos tienen continuidad.", decision: "Decidís si la solución viene acompañada por operación y atención real, no solo software." , cta: "Mostralo como evidencia de una plataforma lista para implementación y soporte continuo." }}
      />
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>.
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{labels.leads}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{leadCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{labels.tickets}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{ticketCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{labels.orders}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{orderCount}</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">{labels.hot}</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-100">{hotPipeline}</p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {topSources.length ? topSources.map(([source, count]) => (
          <div key={source} className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-violet-200">Lead source</p>
            <p className="mt-1 text-sm text-white">{source}</p>
            <p className="mt-2 text-xl font-semibold text-violet-100">{count}</p>
          </div>
        )) : <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300 md:col-span-4">No lead source stats yet.</div>}
      </section>

      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
        <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">CRM-lite consolidated (public CTA)</p>
        <p className="mt-1">Opportunities from demo/public CTA: <b>{filteredOpportunities.length}</b></p>
        <p className="mt-1 text-xs text-cyan-200">Filters · tenant: <b>{effectiveTenantFilter || "all"}</b> · session: <b>{sessionFilter || "all"}</b></p>
      </section>

      <DataTable
        title="CTA opportunities ⓘ"
        columns={[
          { key: "created_at", label: "Created" },
          { key: "tenant", label: "Tenant" },
          { key: "session", label: "Demo session" },
          { key: "interest", label: "Interest" },
          { key: "source", label: "Source" },
          { key: "status", label: "Status" },
        ]}
        rows={filteredOpportunities.map((item) => ({
          created_at: String((item.lead.created_at || "").toString().slice(0, 19).replace("T", " ") || "-"),
          tenant: item.tenant || "-",
          session: item.session || "-",
          interest: item.interest || "-",
          source: item.source,
          status: String(item.lead.status || "new"),
        }))}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-200">{labels.feed}</h2>
        <div className="mt-3 grid gap-2">
          {[...scopedLeads.slice(0, 3), ...scopedTickets.slice(0, 2), ...scopedOrders.slice(0, 2)].map((item: Record<string, unknown>, idx: number) => (
            <div key={`${String(item.contact || item.title || "entry")}-${idx}`} className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-300">
              <p className="font-semibold text-white">{String(item.contact || item.title || "-")}</p>
              <p className="mt-1">{String(item.company || item.detail || item.status || "-")}</p>
            </div>
          ))}
        </div>
      </section>

      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Por qué esta vista sí importa</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Leads = demanda y nuevos casos de uso entrando al sistema.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Tickets = fricción real que hay que resolver para retener y escalar.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Orders = pipeline que ya se acerca a revenue y abastecimiento.</div>
        </div>
      </Card>

      <DataTable
        title="Leads inbox ⓘ"
        columns={[{ key: "name", label: "Name" }, { key: "contact", label: "Contact" }, { key: "company", label: "Company" }, { key: "vertical", label: "Vertical" }, { key: "status", label: "Status" }, { key: "source", label: "Source" }, { key: "estimated", label: "Est. volume" }]}
        rows={scopedLeads.map((item: Record<string, unknown>) => ({
          name: String(item.name || "-"),
          contact: String(item.contact || item.email || item.phone || "-"),
          company: String(item.company || "-"),
          vertical: String(item.vertical || "-"),
          status: String(item.status || "new"),
          source: String(item.source || "-"),
          estimated: String(item.estimated_volume || item.volume || "0"),
        }))}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />

      <DataTable
        title="Tickets ⓘ"
        columns={[{ key: "contact", label: "Contact" }, { key: "title", label: "Title" }, { key: "status", label: "Status" }]}
        rows={scopedTickets.map((item: Record<string, unknown>) => ({
          contact: String(item.contact || "-"),
          title: String(item.title || "-"),
          status: String(item.status || "open"),
        }))}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />

      <DataTable
        title="Orders / Chip requests ⓘ"
        columns={[{ key: "name", label: "Name" }, { key: "contact", label: "Contact" }, { key: "company", label: "Company" }, { key: "vertical", label: "Vertical" }, { key: "status", label: "Status" }, { key: "source", label: "Source" }, { key: "estimated", label: "Est. volume" }]}
        rows={scopedOrders.map((item: Record<string, unknown>) => ({
          name: String(item.name || "-"),
          contact: String(item.contact || item.email || item.phone || "-"),
          company: String(item.company || "-"),
          vertical: String(item.vertical || "-"),
          status: String(item.status || "new"),
          source: String(item.source || "-"),
          estimated: String(item.estimated_volume || item.volume || "0"),
        }))}
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
