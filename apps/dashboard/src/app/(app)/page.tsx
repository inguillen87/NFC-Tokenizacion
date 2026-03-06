import { Card, SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../components/admin-action-forms";
import { AnalyticsPanels } from "../../components/analytics-panels";
import { DataTable } from "../../components/data-table";
import { ModuleGrid } from "../../components/module-grid";
import { dashboardContent } from "../../lib/dashboard-content";
import { getDashboardI18n } from "../../lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3003";

async function getOverviewRows() {
  try {
    const response = await fetch(`${API_BASE}/admin/tenants?withStats=1`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [] as Array<Record<string, unknown>>;
    return response.json();
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

function resolveTenantStatus(scans: number, duplicates: number, tamper: number) {
  if (scans === 0) return "pending";
  const riskRatio = scans > 0 ? (duplicates + tamper) / scans : 0;
  if (tamper > 5 || riskRatio > 0.06) return "risk";
  if (duplicates > 0 || tamper > 0) return "healthy";
  return "active";
}

export default async function DashboardHome() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const overviewRaw = await getOverviewRows();

  const overviewRows = overviewRaw.map((row) => {
    const scans = Number(row.scans || 0);
    const duplicates = Number(row.duplicates || 0);
    const tamper = Number(row.tamper || 0);
    return {
      tenant: String(row.name || row.slug || "-"),
      status: resolveTenantStatus(scans, duplicates, tamper),
      scans: scans.toLocaleString(),
      duplicates: duplicates.toLocaleString(),
      tamper: tamper.toLocaleString(),
    };
  });

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.overview} title={copy.pages.overview.title} description={copy.pages.overview.description} />

      <AnalyticsPanels kpis={t.dashboard.kpis} extra={copy.analytics} />

      <ModuleGrid
        actionLabel={copy.shell.openModule}
        modules={[
          { title: copy.pages.tenants.title, description: copy.pages.tenants.description, href: "/tenants", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.batches.title, description: copy.pages.batches.description, href: "/batches", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.tags.title, description: copy.pages.tags.description, href: "/tags", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.events.title, description: copy.pages.events.description, href: "/events", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.resellers.title, description: copy.pages.resellers.description, href: "/resellers", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.apiKeys.title, description: copy.pages.apiKeys.description, href: "/api-keys", status: copy.statuses.pending, tone: "amber" },
        ]}
      />

      <DataTable
        title={copy.tables.tenants.title}
        columns={[
          { key: "tenant", label: copy.tables.tenants.tenant },
          { key: "status", label: copy.tables.tenants.status },
          { key: "scans", label: t.dashboard.kpis.scans },
          { key: "duplicates", label: t.dashboard.kpis.duplicates },
          { key: "tamper", label: t.dashboard.kpis.tamper },
        ]}
        rows={overviewRows}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">{t.dashboard.roleBasedOps}</h2>
        <p className="mt-2 text-sm text-slate-400">{copy.pages.batches.description}</p>
      </Card>

      <AdminActionForms copy={t.dashboard.forms} roles={copy.roles} readyLabel={copy.shell.ready} />
    </main>
  );
}
