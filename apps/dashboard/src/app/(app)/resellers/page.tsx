import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
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
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Resellers y CRM lite muestran pipeline, canal y señales de revenue en expansión.", decision: "Decidís qué partners escalar, qué cuentas priorizar y dónde hay conversión real.", cta: "Usalo para mostrar que la plataforma no solo autentica: también abre distribución y negocio." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Esta vista conecta soporte comercial con ejecución: leads, tickets y pedidos operativos en el mismo control plane.", decision: "Decidís cómo coordinar onboarding, incidencias y abastecimiento con el canal reseller.", cta: "Leelo como puente entre operación interna y red comercial externa." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "White-label / Resellers demuestra que la experiencia puede desplegarse en múltiples marcas, geografías y equipos.", decision: "Decidís si esto puede crecer en tu red comercial o cadena de distribución.", cta: "Mostralo como prueba de escalabilidad comercial más allá del caso demo inicial." }}
      />

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
        emptyLabel={copy.shell.empty}
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
