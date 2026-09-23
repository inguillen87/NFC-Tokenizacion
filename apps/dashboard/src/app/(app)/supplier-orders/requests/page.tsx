import { notFound } from "next/navigation";
import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext } from "../../../../lib/admin-page-access";
import { SupplierRequestWorkspace } from "../../../../components/supplier-request-workspace";
import { SUPPLIER_REQUEST_UUID } from "../../../../lib/supplier-request-client";
export default async function SupplierRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireDashboardSession();
  const query = await searchParams;
  if (Array.isArray(query.tenant) || Array.isArray(query.request) || (query.request && !SUPPLIER_REQUEST_UUID.test(query.request))) notFound();
  if (session.role === "supplier-operator") {
    if (query.tenant !== undefined || !session.userId || !SUPPLIER_REQUEST_UUID.test(session.userId) || session.tenantId || session.tenantSlug) notFound();
    return <SupplierRequestWorkspace initialRequestId={query.request || ""} access={{ id: session.id, userId: session.userId, role: session.role, tenantId: session.tenantId, tenantSlug: null, permissions: session.permissions, deniedPermissions: session.deniedPermissions || [], isDemo: session.isDemo === true }} />;
  }
  const context = await createAdminPageContext(session, query.tenant);
  return <SupplierRequestWorkspace initialTenant={context.tenantSlug} initialRequestId={query.request || ""} access={{ id: session.id, role: session.role, tenantSlug: session.tenantSlug || null, permissions: session.permissions, deniedPermissions: session.deniedPermissions || [], isDemo: session.isDemo === true }} />;
}
