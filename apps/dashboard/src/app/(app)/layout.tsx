import { DashboardShell } from "../../components/dashboard-shell";
import { getDashboardI18n } from "../../lib/locale";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { copy, locale, locales } = await getDashboardI18n();

  return (
    <DashboardShell
      title={copy.appName}
      subtitle={copy.shell.subtitle}
      nav={copy.nav}
      roles={copy.roles}
      shell={copy.shell}
      locale={locale}
      locales={[...locales]}
    >
      {children}
    </DashboardShell>
  );
}
