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

export default async function LeadsTicketsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  const [leads, tickets, orders] = await Promise.all([
    adminGet("/admin/leads"),
    adminGet("/admin/tickets"),
    adminGet("/admin/orders"),
  ]);

  const leadCount = Array.isArray(leads) ? leads.length : 0;
  const ticketCount = Array.isArray(tickets) ? tickets.length : 0;
  const orderCount = Array.isArray(orders) ? orders.length : 0;
  const hotPipeline = leadCount + orderCount;

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

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-200">{labels.feed}</h2>
        <div className="mt-3 grid gap-2">
          {[...leads.slice(0, 3), ...tickets.slice(0, 2), ...orders.slice(0, 2)].map((item: Record<string, unknown>, idx: number) => (
            <div key={`${String(item.contact || item.title || "entry")}-${idx}`} className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-300">
              <p className="font-semibold text-white">{String(item.contact || item.title || "-")}</p>
              <p className="mt-1">{String(item.company || item.detail || item.status || "-")}</p>
            </div>
          ))}
        </div>
      </section>

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
