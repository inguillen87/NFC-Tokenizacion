import { MfaSettingsPanel } from "../../../components/mfa-settings-panel";
import { requireDashboardSession } from "../../../lib/session";

export default async function MfaPage() {
  await requireDashboardSession();
  return <MfaSettingsPanel />;
}
