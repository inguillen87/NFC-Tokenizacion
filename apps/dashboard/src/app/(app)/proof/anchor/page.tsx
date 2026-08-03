import { notFound } from "next/navigation";
import { dashboardHighImpactPermissionMatches } from "../../../../lib/permission-policy";
import { requireDashboardSession } from "../../../../lib/session";
import { requireDashboardTenantScope } from "../../../../lib/admin-page-access";
import { ProofAnchorComposer } from "./proof-anchor-composer";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function AnchorPage({ searchParams }: PageProps) {
  const session = await requireDashboardSession();
  const canRead = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "proofs.read",
    session.deniedPermissions,
  );
  if (!canRead) notFound();
  const params = searchParams ? await searchParams : {};
  const requestedTenant = firstValue(params.tenant).trim().toLowerCase();
  const tenantScope = requireDashboardTenantScope(session, requestedTenant);
  const canWrite = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "proofs.anchor",
    session.deniedPermissions,
  );

  return (
    <ProofAnchorComposer
      canWrite={canWrite}
      defaultOccurredAt={new Date().toISOString()}
      initialTenantSlug={tenantScope.tenantSlug}
      isDemo={Boolean(session.isDemo)}
      role={session.role}
    />
  );
}
