import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, FolderLock } from "lucide-react";
import { Card, SectionHeading } from "@product/ui";
import { TenantVaultBrowser } from "../../../../../components/tenant-vault-browser";
import { createAdminPageContext, fetchAdminPage } from "../../../../../lib/admin-page-access";
import { readAdminResourceResponse } from "../../../../../lib/admin-resource-read";
import { requireDashboardSession } from "../../../../../lib/session";
import { selectTenantVaultPayload } from "../../../../../lib/tenant-vault-contract";

function normalizeIdentifier(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export default async function TenantVaultPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const session = await requireDashboardSession("supplier_orders:read");
  const { tenantId } = await params;
  const requestedTenant = normalizeIdentifier(tenantId);
  if (!requestedTenant) notFound();

  const sessionIdentifiers = [session.tenantId, session.tenantSlug]
    .map(normalizeIdentifier)
    .filter(Boolean);
  if (session.role !== "super-admin" && !sessionIdentifiers.includes(requestedTenant)) notFound();

  const expectedIdentifiers = session.role === "super-admin" ? [requestedTenant] : sessionIdentifiers;
  const expectedViewer = session.role === "super-admin" ? "operator" : "tenant";
  const context = await createAdminPageContext(session, session.role === "super-admin" ? requestedTenant : session.tenantSlug);
  const response = await fetchAdminPage(context, `tenant-vault/${encodeURIComponent(requestedTenant)}`).catch(() => null);
  const result = response
    ? await readAdminResourceResponse(response, (payload) => selectTenantVaultPayload(payload, expectedIdentifiers, expectedViewer))
    : { availability: "unreachable" as const, data: null, status: null };

  if (result.availability === "not_found" || result.availability === "scope_mismatch") notFound();
  if (result.availability !== "ready") {
    return (
      <main className="space-y-8" data-testid="tenant-vault-unavailable">
        <SectionHeading eyebrow="Tenant Vault" title="Bóveda no disponible" description="La fuente operativa no pudo confirmar el alcance o la evidencia. No se muestran datos de demostración como reemplazo." />
        <Card className="p-6">
          <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 text-amber-200" /><div><h2 className="font-bold text-white">Acceso cerrado de forma segura</h2><p className="mt-2 text-sm leading-6 text-slate-300">Estado: {result.availability}. Reintente cuando la API y la base de auditoría estén disponibles. Ningún pack ni metadata sensible fue expuesto.</p></div></div>
          <div className="mt-5 flex flex-wrap gap-3"><Link href="/supplier-orders" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-slate-100">Volver a órdenes</Link></div>
        </Card>
        <Card className="p-5 text-sm text-slate-300"><div className="flex items-center gap-3"><FolderLock className="h-5 w-5 text-slate-500" />Las descargas permanecen deshabilitadas mientras la lectura autoritativa no esté disponible.</div></Card>
      </main>
    );
  }

  return <TenantVaultBrowser vault={result.data} />;
}
