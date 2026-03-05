import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";
import { DashboardShell } from "../../components/dashboard-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <DashboardShell
      title="NFC Identity Cloud"
      subtitle={copy.shell.subtitle}
      nav={copy.nav}
      roles={copy.roles}
      shell={copy.shell}
    >
      {children}
    </DashboardShell>
  );
}
