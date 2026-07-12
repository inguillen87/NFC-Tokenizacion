import { SectionHeading } from "@product/ui";
import { DemoLabControlCenter } from "../../../components/demo-lab";
import { dashboardPermissionMatches } from "../../../lib/permission-policy";
import { requireDashboardSession } from "../../../lib/session";

export default async function DemoLabPage() {
  const session = await requireDashboardSession("demo:read");
  const canRun = session.role === "super-admin" || dashboardPermissionMatches(session.permissions, "demo:run");
  const canReset = session.role === "super-admin" && dashboardPermissionMatches(session.permissions, "demo:reset");

  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Tenant demo operations"
        title="Demo Mission Control"
        description="Ejecuta un recorrido controlado, distingue simulacion de persistencia y abre la evidencia publica correcta. El panel no presenta un tap sintetico como blockchain ni mezcla datos entre tenants."
      />
      <DemoLabControlCenter
        canReset={canReset}
        canRun={canRun}
        tenantSlug={session.tenantSlug || "demobodega"}
      />
    </main>
  );
}
