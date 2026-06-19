import { Card, SectionHeading } from "@product/ui";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { SdkAdminConsole } from "../../../components/sdk-admin-console";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { getDashboardSession } from "../../../lib/session";

export default async function ApiKeysPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const session = await getDashboardSession();
  const tenantSlug = session?.tenantSlug || "";

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow={copy.nav.apiKeys}
        title="SDK, API Keys y webhooks"
        description="Control operativo para integrar POS, ERP, e-commerce y CRM sin convertir un escaneo de gondola en ownership. Las keys tienen scopes, uso auditable y revocacion inmediata."
      />
      <ModuleAudienceHero
        ceo={{
          eyebrow: "CEO / investor",
          summary: "Esta vista prueba que nexID entra en procesos reales: caja, marketplace, ERP, CRM, analitica y soporte.",
          decision: "Decidis readiness enterprise, defensibilidad tecnica y facilidad de expansion con partners.",
          cta: "Mostralo como infraestructura vendible, no como demo aislada.",
        }}
        operator={{
          eyebrow: "Operator / engineer",
          summary: "API Keys gobiernan autenticacion, scopes, webhooks firmados y reglas de claim por lote.",
          decision: "Decidis que integraciones habilitar, como auditar uso y como revocar acceso.",
          cta: "Usalo como puente entre producto fisico, POS y experiencia mobile.",
        }}
        buyer={{
          eyebrow: "Buyer / client",
          summary: "El cliente puede integrarnos sin cambiar todo su stack y sin regalar ownership a quien solo escanea en estanteria.",
          decision: "Decidis si la adopcion encaja con caja, e-commerce, soporte y fidelizacion actual.",
          cta: "Mostralo como garantia de implementacion simple y segura.",
        }}
      />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Que haria una empresa aca</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-4">Emitir una key por tenant o reseller para integraciones controladas.</div>
          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-4">Activar claim con POS token y PIN para separar lectura, compra y propiedad.</div>
          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-4">Enviar eventos firmados a ERP, Shopify, WooCommerce, CRM o data warehouse.</div>
        </div>
      </Card>
      <SdkAdminConsole tenantSlug={tenantSlug} />
    </main>
  );
}
