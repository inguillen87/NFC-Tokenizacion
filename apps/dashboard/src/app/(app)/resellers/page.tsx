import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

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

export default async function ResellersPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  const [leads, tickets, orders] = await Promise.all([
    adminGet("/admin/leads"),
    adminGet("/admin/tickets"),
    adminGet("/admin/orders"),
  ]);

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.resellers} title={copy.pages.resellers.title} description="CRM lite: leads, tickets y pedidos para super admin." />

      <DataTable
        title="Leads inbox"
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
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />

      <DataTable
        title="Tickets"
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
        title="Orders / Chip requests"
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
