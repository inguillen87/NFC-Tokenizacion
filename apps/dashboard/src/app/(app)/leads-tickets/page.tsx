import { Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
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

function leadTenant(lead: Record<string, unknown>) {
  return (parseMeta(lead.message, "tenant") || parseMeta(lead.notes, "tenant") || String(lead.tenant_slug || "")).toLowerCase();
}

function hasMeetingSignal(item: Record<string, unknown>) {
  const text = [
    item.source,
    item.title,
    item.detail,
    item.message,
    item.notes,
    item.role_interest,
  ].map((value) => String(value || "").toLowerCase()).join(" ");
  return /realtime|meeting|reunion|private|privada|demo|call|llamada|videollamada/.test(text);
}

function fieldDate(value: unknown) {
  return String(value || "").toString().slice(0, 19).replace("T", " ") || "-";
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
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";
  const copy = dashboardContent[locale];

  const [leads, tickets, orders] = await Promise.all([
    adminGet("/admin/leads"),
    adminGet("/admin/tickets"),
    adminGet("/admin/consumer-portal/order-requests"),
  ]);

  const leadsArray = Array.isArray(leads) ? leads as Array<Record<string, unknown>> : [];
  const ticketsArray = Array.isArray(tickets) ? tickets as Array<Record<string, unknown>> : [];
  const ordersArray = Array.isArray(orders) ? orders as Array<Record<string, unknown>> : [];
  const scopedLeads = tenantScope ? leadsArray.filter((lead) => leadTenant(lead) === tenantScope) : leadsArray;
  const scopedTickets = tenantScope ? ticketsArray.filter((item) => String(item.tenant_slug || "").toLowerCase() === tenantScope) : ticketsArray;
  const scopedOrders = tenantScope ? ordersArray.filter((item) => String(item.tenant_slug || "").toLowerCase() === tenantScope) : ordersArray;
  const leadCount = scopedLeads.length;
  const ticketCount = scopedTickets.length;
  const orderCount = scopedOrders.length;
  const privateMeetingCount = [...scopedLeads, ...scopedTickets].filter(hasMeetingSignal).length;
  const hotPipeline = leadCount + orderCount + privateMeetingCount;

  const labels = locale === "en"
    ? {
        leads: "Prospects",
        tickets: "Tickets",
        meetings: "Private meetings",
        orders: "Orders",
        hot: "Hot pipeline",
        feed: "Commercial control room",
        scope: "Current scope",
        global: "global / multi-tenant",
        source: "Lead source",
        crmLite: "CRM-lite consolidated",
        opportunities: "Commercial opportunities",
        why: "Why this view matters",
      }
    : locale === "pt-BR"
      ? {
          leads: "Prospects",
          tickets: "Tickets",
          meetings: "Reunioes privadas",
          orders: "Pedidos",
          hot: "Pipeline quente",
          feed: "Sala de controle comercial",
          scope: "Escopo atual",
          global: "global / multi-tenant",
          source: "Fonte do lead",
          crmLite: "CRM-lite consolidado",
          opportunities: "Oportunidades comerciais",
          why: "Por que esta vista importa",
        }
      : {
          leads: "Prospectos",
          tickets: "Tickets",
          meetings: "Reuniones privadas",
          orders: "Ordenes",
          hot: "Pipeline caliente",
          feed: "Sala comercial",
          scope: "Scope actual",
          global: "global / multi-tenant",
          source: "Fuente del lead",
          crmLite: "CRM-lite consolidado",
          opportunities: "Oportunidades comerciales",
          why: "Por que esta vista importa",
        };

  const ctaOpportunities = leadsArray
    .map((lead) => {
      const tenant = parseMeta(lead.message, "tenant") || parseMeta(lead.notes, "tenant");
      const session = parseMeta(lead.message, "session") || parseMeta(lead.notes, "session");
      const interest = parseMeta(lead.message, "interest") || String(lead.role_interest || "-");
      return { lead, tenant, session, interest, source: String(lead.source || "unknown") };
    })
    .filter((item) => /public|demo|assistant|sales|realtime|chat/.test(item.source));
  const effectiveTenantFilter = tenantScope || tenantFilter;
  const filteredOpportunities = ctaOpportunities.filter((item) => {
    const byTenant = effectiveTenantFilter ? item.tenant.toLowerCase() === effectiveTenantFilter : true;
    const bySession = sessionFilter ? item.session.toLowerCase().includes(sessionFilter) : true;
    return byTenant && bySession;
  });
  const sourceStats = scopedLeads.reduce<Record<string, number>>((acc, lead) => {
    const source = String(lead.source || "unknown");
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});
  const topSources = Object.entries(sourceStats).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 4) as Array<[string, number]>;

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.leadsTickets} title={copy.pages.leadsTickets.title} description={copy.pages.leadsTickets.description} />

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
        {labels.scope}: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : labels.global}</b>.
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{labels.leads}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{leadCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{labels.tickets}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{ticketCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{labels.meetings}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{privateMeetingCount}</p>
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
        {topSources.length ? topSources.map(([source, count]: [string, number]) => (
          <div key={source} className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-violet-200">{labels.source}</p>
            <p className="mt-1 text-sm text-white">{source}</p>
            <p className="mt-2 text-xl font-semibold text-violet-100">{count}</p>
          </div>
        )) : <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300 md:col-span-4">No lead source stats yet.</div>}
      </section>

      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
        <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">{labels.crmLite}</p>
        <p className="mt-1">{labels.opportunities}: <b>{filteredOpportunities.length}</b></p>
        <p className="mt-1 text-xs text-cyan-200">Filters - tenant: <b>{effectiveTenantFilter || "all"}</b> - session: <b>{sessionFilter || "all"}</b></p>
      </section>

      <DataTable
        title={labels.opportunities}
        columns={[
          { key: "created_at", label: "Created" },
          { key: "tenant", label: "Tenant" },
          { key: "session", label: "Demo session" },
          { key: "interest", label: "Interest" },
          { key: "source", label: "Source" },
          { key: "status", label: "Status" },
        ]}
        rows={filteredOpportunities.map((item) => ({
          created_at: fieldDate(item.lead.created_at),
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
          {[...scopedLeads.slice(0, 3), ...scopedTickets.slice(0, 3), ...scopedOrders.slice(0, 2)].map((item: Record<string, unknown>, idx: number) => (
            <div key={`${String(item.contact || item.title || "entry")}-${idx}`} className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-300">
              <p className="font-semibold text-white">{String(item.contact || item.title || item.name || "-")}</p>
              <p className="mt-1">{String(item.company || item.detail || item.message || item.status || "-")}</p>
            </div>
          ))}
        </div>
      </section>

      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{labels.why}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Leads = demanda, vertical, contacto y caso de uso entrando al sistema.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Tickets = seguimiento operativo para cotizacion, demo, soporte y reunion privada.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Orders = pipeline cercano a revenue, muestras y abastecimiento.</div>
        </div>
      </Card>

      <DataTable
        title="Prospects inbox"
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
        title="Tickets and meetings"
        columns={[{ key: "contact", label: "Contact" }, { key: "title", label: "Title" }, { key: "source", label: "Source" }, { key: "status", label: "Status" }]}
        rows={scopedTickets.map((item: Record<string, unknown>) => ({
          contact: String(item.contact || "-"),
          title: String(item.title || "-"),
          source: String(item.source || "-"),
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
        title="Orders / chip requests"
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
