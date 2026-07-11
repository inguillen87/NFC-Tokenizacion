import { dashboardPermissionMatches } from "../../../../lib/permission-policy";
import { requireDashboardSession } from "../../../../lib/session";
import { ProofAnchorComposer } from "./proof-anchor-composer";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function AnchorPage({ searchParams }: PageProps) {
  const session = await requireDashboardSession("proof:read");
  const params = searchParams ? await searchParams : {};
  const requestedTenant = firstValue(params.tenant).trim().toLowerCase();
  const canWrite = session.role === "super-admin"
    || dashboardPermissionMatches(session.permissions, "proof:write");

  return (
    <ProofAnchorComposer
      canWrite={canWrite}
      defaultOccurredAt={new Date().toISOString()}
      initialTenantSlug={session.tenantSlug || requestedTenant}
      isDemo={Boolean(session.isDemo)}
      role={session.role}
    />
  );
}
