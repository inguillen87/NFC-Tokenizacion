import {SDK_INTEGRATION_PROFILES} from "../../../lib/sdk-developer-experience";
import { Card, SectionHeading } from "@product/ui";
import { SdkAdminConsole } from "../../../components/sdk-admin-console";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { requireDashboardTenantScope } from "../../../lib/admin-page-access";
import { dashboardHighImpactPermissionMatches } from "../../../lib/permission-policy";

export default async function ApiKeysPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const session = await requireDashboardSession();
  const query=searchParams?await searchParams:{};
  const tenantSlug = requireDashboardTenantScope(session,query.tenant).tenantSlug;
  const initialProfile=SDK_INTEGRATION_PROFILES.find(p=>p.id===query.profile)||SDK_INTEGRATION_PROFILES[0];
  const canReadApiKeys = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "api_keys.read",
    session.deniedPermissions,
  );
  const canManageApiKeys = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "api_keys.manage",
    session.deniedPermissions,
  );
  const canManageClaimPolicy = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "ownership.claim_policy.manage",
    session.deniedPermissions,
  );

  if (!canReadApiKeys) {
    return (
      <main className="space-y-8" data-api-keys-availability="access_denied">
        <SectionHeading
          eyebrow={copy.nav.apiKeys}
          title="Developer Hub no disponible"
          description="Tu rol o sus denegaciones explícitas no permiten consultar credenciales de este tenant. Solicitá api_keys.read a un administrador autorizado."
        />
        <Card className="border-amber-300/25 bg-amber-500/10 p-5 text-sm text-amber-50">
          El acceso permanece bloqueado y no se cargaron metadatos de API keys, políticas de ownership ni secretos.
        </Card>
      </main>
    );
  }

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
      <SdkAdminConsole
        key={`${tenantSlug}:${initialProfile.id}`}
        initialProfileId={initialProfile.id}
        tenantSlug={tenantSlug}
        canManageApiKeys={canManageApiKeys}
        canManageClaimPolicy={canManageClaimPolicy}
        mfaVerified={session.mfaVerified}
      />
    </main>
  );
}
