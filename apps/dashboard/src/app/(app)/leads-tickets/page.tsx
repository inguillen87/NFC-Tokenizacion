import { Card, SectionHeading } from "@product/ui";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import LeadsTicketsClient from "./leads-tickets-client";

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

  const leadsArray = Array.isArray(leads) ? (leads as any[]) : [];
  const ticketsArray = Array.isArray(tickets) ? (tickets as any[]) : [];
  const ordersArray = Array.isArray(orders) ? (orders as any[]) : [];
  
  const scopedLeads = tenantScope ? leadsArray.filter((lead) => leadTenant(lead) === tenantScope) : leadsArray;
  const scopedTickets = tenantScope ? ticketsArray.filter((item) => String(item.tenant_slug || "").toLowerCase() === tenantScope) : ticketsArray;
  const scopedOrders = tenantScope ? ordersArray.filter((item) => String(item.tenant_slug || "").toLowerCase() === tenantScope) : ordersArray;

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
      const sessionVal = parseMeta(lead.message, "session") || parseMeta(lead.notes, "session");
      const interest = parseMeta(lead.message, "interest") || String(lead.role_interest || "-");
      return { lead, tenant, session: sessionVal, interest, source: String(lead.source || "unknown") };
    })
    .filter((item) => /public|demo|assistant|sales|realtime|chat/.test(item.source));
    
  const effectiveTenantFilterVal = tenantScope || tenantFilter;
  const filteredOpportunities = ctaOpportunities.filter((item) => {
    const byTenant = effectiveTenantFilterVal ? item.tenant.toLowerCase() === effectiveTenantFilterVal : true;
    const bySession = sessionFilter ? item.session.toLowerCase().includes(sessionFilter) : true;
    return byTenant && bySession;
  });

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.leadsTickets} title={copy.pages.leadsTickets.title} description={copy.pages.leadsTickets.description} />

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
        {labels.scope}: <b className="text-cyan-300 font-mono">{tenantScope ? `tenant:${tenantScope}` : labels.global}</b>.
      </section>

      <LeadsTicketsClient
        initialLeads={scopedLeads}
        initialTickets={scopedTickets}
        initialOrders={scopedOrders}
        filteredOpportunities={filteredOpportunities}
        tenantScope={tenantScope}
        sessionFilter={sessionFilter}
        tenantFilter={tenantFilter}
        copy={copy}
        labels={labels}
      />
    </main>
  );
}
