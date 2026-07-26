import { Card, SectionHeading } from "@product/ui";
import { SdkAdminConsole } from "../../../components/sdk-admin-console";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { requireDashboardTenantScope } from "../../../lib/admin-page-access";

export default async function ApiKeysPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const session = await requireDashboardSession();
  const tenantSlug = requireDashboardTenantScope(session).tenantSlug;

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow={copy.nav.apiKeys}
        title="Developer Hub: API keys, quickstart y webhooks"
        description="Llevá una integración desde cero hasta su primera llamada verificable. Empezá con un perfil de mínimo privilegio, guardá la credencial en tu backend y observá cada entrega hacia tu stack."
      />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Elegí la complejidad que tu operación necesita</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-4"><strong className="block text-white">Piloto / pyme</strong><span className="mt-1 block text-xs leading-5 text-slate-400">Una key server-side para verificar tags y consultar productos. Webhook opcional.</span></div>
          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-4"><strong className="block text-white">Comercio</strong><span className="mt-1 block text-xs leading-5 text-slate-400">POS y claims para separar lectura, compra y ownership sin rehacer el stack.</span></div>
          <div className="rounded-lg border border-white/10 bg-slate-900/70 p-4"><strong className="block text-white">Enterprise</strong><span className="mt-1 block text-xs leading-5 text-slate-400">Credenciales por servicio, logística, eventos firmados y auditoría de entregas.</span></div>
        </div>
      </Card>
      <SdkAdminConsole tenantSlug={tenantSlug} />
    </main>
  );
}
