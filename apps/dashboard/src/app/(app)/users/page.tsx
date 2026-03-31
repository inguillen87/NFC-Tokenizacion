import { Card } from "@product/ui";
import { requireDashboardSession } from "../../../lib/session";
import { UserManagementPanel } from "../../../components/user-management-panel";

export default async function UsersPage() {
  await requireDashboardSession("users:manage");
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-white">Enterprise IAM</h1>
        <p className="mt-2 text-sm text-slate-400">Administrá usuarios, permisos por recurso, reset tokens y MFA desde la UI.</p>
      </Card>
      <UserManagementPanel />
    </div>
  );
}
