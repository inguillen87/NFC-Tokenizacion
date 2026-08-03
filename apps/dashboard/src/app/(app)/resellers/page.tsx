import { SectionHeading } from "@product/ui";
import { notFound } from "next/navigation";
import { DataTable } from "../../../components/data-table";
import { EnterpriseOpsState } from "../../../components/enterprise-ops-state";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { dashboardHighImpactPermissionMatches } from "../../../lib/permission-policy";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";

async function adminGet(context: AdminPageContext, path: string) {
  try {
    const response = await fetchAdminPage(context, path);

    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export default async function ResellersPage() {
  const session = await requireDashboardSession();
  if (session.role !== "super-admin") notFound();
  const canManageLeads = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "leads.manage",
    session.deniedPermissions,
  );
  const adminContext = await createAdminPageContext(session);
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  const [leads, tickets, orders] = await Promise.all([
    canManageLeads
      ? adminGet(adminContext, "/admin/leads")
      : Promise.resolve([] as Record<string, unknown>[]),
    adminGet(adminContext, "/admin/tickets"),
    adminGet(adminContext, "/admin/orders"),
  ]);

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.resellers} title={copy.pages.resellers.title} description={copy.pages.resellers.description} />
      {!canManageLeads ? (
        <EnterpriseOpsState
          variant="warning"
          title="Acceso restringido al inbox de leads"
          description="Esta sesión no tiene la capacidad leads.manage. El servidor no consultó datos de prospectos; tickets y pedidos continúan disponibles según sus controles actuales."
          checklist={[
            "El inbox vacío representa una restricción de acceso, no cero actividad.",
            "Las denegaciones explícitas prevalecen sobre los permisos concedidos.",
          ]}
          testId="reseller-leads-access-denied"
        />
      ) : null}
      <DataTable
        title="Leads inbox ⓘ"
        columns={[{ key: "contact", label: "Contact" }, { key: "company", label: "Company" }, { key: "status", label: "Status" }, { key: "source", label: "Source" }, { key: "volume", label: "Volume" }]}
        rows={leads.map((item: Record<string, unknown>) => ({
          contact: String(item.contact || "-"),
          company: String(item.company || "-"),
          status: String(item.status || "new"),
          source: String(item.source || "-"),
          volume: String(item.volume || "0"),
        }))}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={canManageLeads ? copy.shell.empty : "Inbox no consultado por falta de leads.manage."}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />

      <DataTable
        title="Tickets ⓘ"
        columns={[{ key: "contact", label: "Contact" }, { key: "title", label: "Title" }, { key: "status", label: "Status" }]}
        rows={tickets.map((item: Record<string, unknown>) => ({
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
        columns={[{ key: "contact", label: "Contact" }, { key: "company", label: "Company" }, { key: "status", label: "Status" }, { key: "source", label: "Source" }, { key: "volume", label: "Volume" }]}
        rows={orders.map((item: Record<string, unknown>) => ({
          contact: String(item.contact || "-"),
          company: String(item.company || "-"),
          status: String(item.status || "new"),
          source: String(item.source || "-"),
          volume: String(item.volume || "0"),
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
