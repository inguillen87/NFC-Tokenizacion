import { Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { keyName: "tenant-bodega-prod", status: "active", scope: "tenant", lastUsed: "2026-03-03" },
  { keyName: "reseller-agency-stg", status: "pending", scope: "reseller", lastUsed: "never" },
  { keyName: "legacy-pharma", status: "revoked", scope: "tenant", lastUsed: "2025-12-14" },
];

export default async function ApiKeysPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.apiKeys} title={copy.pages.apiKeys.title} description={copy.pages.apiKeys.description + " (ⓘ API keys permiten integrar validación, webhooks y automatización externa.)"} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "API Keys muestran que la plataforma se integra con ecosistemas reales y no queda encerrada en una demo.", decision: "Decidís readiness enterprise, defensibilidad técnica y facilidad de expansión vía partners e integraciones.", cta: "Contalo como infraestructura lista para vender a clientes con stacks existentes." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "API Keys gobiernan autenticación entre sistemas, automatización y acceso seguro a eventos/webhooks.", decision: "Decidís qué scope dar, qué integraciones habilitar y cómo auditar uso o revocación.", cta: "Usalo como puente entre producto, operación y clientes integrados." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Aunque no sea la vista más sexy, esto explica que tu operación puede conectarse sin reinventar procesos.", decision: "Decidís si la adopción del producto encaja con ERP, apps, e-commerce o soporte actual.", cta: "Mostralo como garantía de implementación simple y enterprise-ready." }}
      />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Qué harías acá de verdad</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Emitir una key por tenant o reseller para integraciones controladas.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Revisar si una integración dejó de usarse, está pendiente o debe revocarse.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Explicar a un cliente enterprise que la plataforma entra en su stack sin romper procesos.</div>
        </div>
      </Card>
      <DataTable title={copy.tables.apiKeys.title} columns={[{ key: "keyName", label: copy.tables.apiKeys.keyName }, { key: "status", label: copy.tables.apiKeys.status }, { key: "scope", label: copy.tables.apiKeys.scope }, { key: "lastUsed", label: copy.tables.apiKeys.lastUsed }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
    </main>
  );
}
