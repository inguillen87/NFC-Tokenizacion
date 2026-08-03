import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";
import { DashboardShell } from "../../components/dashboard-shell";
import { requireDashboardSession } from "../../lib/session";
import { requireDashboardTenantScope } from "../../lib/admin-page-access";
import { SessionHeartbeat } from "../../components/session-heartbeat";
import { isClerkConfiguredForRuntime } from "../../lib/clerk-env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { locale, locales, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const session = await requireDashboardSession();
  requireDashboardTenantScope(session);

  return (
    <DashboardShell
      title={t.dashboard.title}
      subtitle={copy.shell.subtitle}
      nav={copy.nav}
      roles={copy.roles}
      shell={copy.shell}
      locale={locale}
      locales={locales}
      currentRole={session.role}
      currentEmail={session.email}
      currentLabel={session.label}
      currentPermissions={session.permissions}
      currentDeniedPermissions={session.deniedPermissions}
      currentTenantSlug={session.tenantSlug}
      currentMfaVerified={session.mfaVerified}
      currentSetupCompleted={session.setupCompleted}
      clerkEnabled={isClerkConfiguredForRuntime()}
    >
      <>
        <SessionHeartbeat />
        {children}
      </>
    </DashboardShell>
  );
}
