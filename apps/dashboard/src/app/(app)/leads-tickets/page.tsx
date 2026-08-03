import { Card, SectionHeading } from "@product/ui";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";
import { readDemoDataMetaFromResponse } from "../../../lib/demo-data-mode";
import { dashboardHighImpactPermissionMatches } from "../../../lib/permission-policy";
import { EnterpriseOpsState } from "../../../components/enterprise-ops-state";
import LeadsTicketsClient from "./leads-tickets-client";

type AdminCollectionResult = {
  rows: any[];
  availability: "ready" | "upstream_error" | "invalid_payload" | "unreachable" | "access_denied";
  source: "production" | "demo" | "unavailable";
};

function accessDeniedCollection(): AdminCollectionResult {
  return { rows: [], availability: "access_denied", source: "unavailable" };
}

async function adminGet(
  context: AdminPageContext,
  path: string,
  allowDemoData: boolean,
): Promise<AdminCollectionResult> {
  try {
    const response = await fetchAdminPage(context, path);
    const meta = readDemoDataMetaFromResponse(response);
    if (!response.ok) return { rows: [], availability: "upstream_error", source: "unavailable" };
    const payload = await response.json().catch(() => null);
    if (!Array.isArray(payload) || (meta.demoMode && !allowDemoData)) {
      return { rows: [], availability: "invalid_payload", source: "unavailable" };
    }
    return { rows: payload, availability: "ready", source: meta.demoMode ? "demo" : "production" };
  } catch {
    return { rows: [], availability: "unreachable", source: "unavailable" };
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
  const requestedTenant = String(query.tenant || "").trim().toLowerCase();
  const sessionFilter = String(query.session || "").trim().toLowerCase();
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const canManageLeads = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "leads.manage",
    session.deniedPermissions,
  );
  const adminContext = await createAdminPageContext(session, requestedTenant);
  const tenantScope = adminContext.tenantSlug;
  const tenantFilter = adminContext.canSelectTenant ? requestedTenant : tenantScope;
  const copy = dashboardContent[locale];
  const allowDemoData = Boolean(session.isDemo);
  const retryQuery = new URLSearchParams();
  if (tenantFilter) retryQuery.set("tenant", tenantFilter);
  if (sessionFilter) retryQuery.set("session", sessionFilter);
  const retryHref = `/leads-tickets${retryQuery.size ? `?${retryQuery.toString()}` : ""}`;

  const [leadsResult, ticketsResult, ordersResult] = await Promise.all([
    canManageLeads
      ? adminGet(adminContext, "/admin/leads", allowDemoData)
      : Promise.resolve(accessDeniedCollection()),
    adminGet(adminContext, "/admin/tickets", allowDemoData),
    adminGet(adminContext, "/admin/consumer-portal/order-requests", allowDemoData),
  ]);

  const leadsArray = leadsResult.rows;
  const ticketsArray = ticketsResult.rows;
  const ordersArray = ordersResult.rows;
  const unavailableSources = [
    { label: "prospectos", availability: leadsResult.availability },
    { label: "tickets", availability: ticketsResult.availability },
    { label: "pedidos", availability: ordersResult.availability },
  ].filter((source) => source.availability !== "ready" && source.availability !== "access_denied");
  
  const scopedLeads = tenantScope ? leadsArray.filter((lead) => leadTenant(lead) === tenantScope) : leadsArray;
  const scopedTickets = tenantScope ? ticketsArray.filter((item) => String(item.tenant_slug || "").toLowerCase() === tenantScope) : ticketsArray;
  const scopedOrders = tenantScope ? ordersArray.filter((item) => String(item.tenant_slug || "").toLowerCase() === tenantScope) : ordersArray;

  const baseLabels = locale === "en"
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
  const labels = { ...baseLabels, ...copy.crmAi };

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

      {!canManageLeads ? (
        <EnterpriseOpsState
          variant="warning"
          title="Acceso restringido a prospectos"
          description="Esta sesión no tiene la capacidad leads.manage. El servidor omitió la consulta de leads y sus datos de contacto; tickets y pedidos conservan sus controles y disponibilidad independientes."
          checklist={[
            "La bandeja de prospectos permanece vacía por autorización, no por ausencia de actividad.",
            "Solicitá leads.manage al administrador del tenant si tu función lo requiere.",
          ]}
          testId="leads-access-denied"
        />
      ) : null}

      {unavailableSources.length ? (
        <EnterpriseOpsState
          variant="warning"
          title={unavailableSources.length === 3 ? "CRM sin confirmación de upstream" : "CRM parcialmente disponible"}
          description="Una o más fuentes no pudieron confirmar su estado. Las colecciones afectadas se muestran vacías, pero no deben interpretarse como cero actividad comercial."
          checklist={unavailableSources.map((source) => `${source.label}: ${source.availability.replaceAll("_", " ")}`)}
          action={(
            <a href={retryHref} className="rounded-xl border border-amber-200/30 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-100 hover:bg-amber-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
              Reintentar fuentes
            </a>
          )}
          testId="crm-upstream-warning"
        />
      ) : null}

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
        demoMode={allowDemoData}
        leadsSource={leadsResult.source}
      />
    </main>
  );
}
