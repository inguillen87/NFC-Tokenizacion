import { Card } from "@product/ui";
import { requireDashboardSession } from "../../../lib/session";
import { requireDashboardTenantScope } from "../../../lib/admin-page-access";
import { UserManagementPanel } from "../../../components/user-management-panel";

export default async function UsersPage() {
  const session = await requireDashboardSession("users:manage");
  requireDashboardTenantScope(session);
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-white">Enterprise IAM</h1>
        <p className="mt-2 text-sm text-slate-400">Administrá usuarios, permisos y restablecimientos. El alta TOTP está bloqueada; sólo puede revocarse MFA legacy detectado.</p>
      </Card>
      <UserManagementPanel />
    </div>
  );
}
