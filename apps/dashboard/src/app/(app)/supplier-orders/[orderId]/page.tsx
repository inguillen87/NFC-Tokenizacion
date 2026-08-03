import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../../components/data-table";
import { getDashboardI18n } from "../../../../lib/locale";
import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";
import { dashboardHighImpactPermissionMatches } from "../../../../lib/permission-policy";
import { ExportPackForm } from "./export-form";
import { PackagingGovernancePanel } from "./packaging-governance-panel";
import { PackagingLabPanel } from "./packaging-lab-panel";
import { SupplierOrderLifecyclePanel } from "../../../../components/supplier-order-lifecycle-panel";

async function getOrderDetails(context: AdminPageContext, orderId: string) {
  try {
    const response = await fetchAdminPage(context, "supplier-orders");
    if (!response.ok) return null;
    const payload = await response.json();
    const order = payload.orders?.find((item: any) => item.id === orderId) || null;
    if (!order) return null;

    const orderTenantSlug = String(order.tenant_slug || "").trim().toLowerCase();
    if (context.tenantSlug && orderTenantSlug !== context.tenantSlug) return null;
    return order;
  } catch {
    return null;
  }
}

async function getPackagingGovernance(context: AdminPageContext, orderId: string) {
  try {
    const response = await fetchAdminPage(context, `supplier-orders/${encodeURIComponent(orderId)}/packaging`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function getPackagingLab(context: AdminPageContext, orderId: string) {
  try {
    const response = await fetchAdminPage(context, `supplier-orders/${encodeURIComponent(orderId)}/packaging-lab`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default async function SupplierOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const session = await requireDashboardSession("supplier_orders:read");
  const { orderId } = await params;
  const { locale } = await getDashboardI18n();
  const adminContext = await createAdminPageContext(session);
  const canExportFactoryPack = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "supplier_pack.export",
    session.deniedPermissions,
  );
  const canManageLifecycle = session.role === "super-admin";

  const order = await getOrderDetails(adminContext, orderId);
  if (!order) {
    return (
      <main className="space-y-8">
        <SectionHeading eyebrow="Supplier Ops" title="Order Not Found" description="The requested order does not exist or you lack permission." />
      </main>
    );
  }

  const [packaging, packagingLab] = await Promise.all([
    getPackagingGovernance(adminContext, orderId),
    getPackagingLab(adminContext, orderId),
  ]);
  const packagingStatus = String(packaging?.governance?.status || order.packaging_governance_status || "legacy_unverified");
  const packagingApproved = packagingStatus === "approved";
  const effectivePackPurpose = String(order.effective_pack_purpose || order.pack_purpose || "legacy_unclassified");

  const subBatches = order.sub_batches || [];

  const rows = subBatches.map((sb: any) => ({
    id: sb.id,
    bid: sb.bid,
    sequence: sb.sequence_index,
    quantity: sb.expected_quantity,
    manifest: sb.manifest_status,
    qa: sb.qa_status,
  }));

  const exportAction = async (formData: FormData) => {
    "use server";
    const actionSession = await requireDashboardSession("supplier_orders:read");
    if (!dashboardHighImpactPermissionMatches(
      actionSession.role,
      actionSession.permissions,
      "supplier_pack.export",
      actionSession.deniedPermissions,
    )) {
      throw new Error("supplier_pack_export_required");
    }
    const actionContext = await createAdminPageContext(actionSession);
    const password = formData.get("password") as string;

    const res = await fetchAdminPage(actionContext, `supplier-orders/${encodeURIComponent(orderId)}/export-pack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || data.reason || "Export failed");
    }

    revalidatePath(`/supplier-orders/${orderId}`);
    return data;
  };

  return (
    <main className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/supplier-orders" className="text-slate-400 hover:text-white">&larr; Back to Orders</Link>
        <Link href={`/admin/tenant-vault/${encodeURIComponent(order.tenant_slug)}`} className="rounded-lg border border-violet-300/25 bg-violet-500/10 px-3 py-1.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/20">
          Open Tenant Vault
        </Link>
      </div>

      <SectionHeading 
        eyebrow="Supplier Order Details" 
        title={order.order_name} 
        description={`Customer: ${order.customer_slug || order.tenant_slug} | Total Quantity: ${order.total_quantity}`} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">Configuration</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Order ID</dt><dd className="text-white font-mono">{order.id}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Chip Model</dt><dd className="text-white">{order.chip_model}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Carrier Profile</dt><dd className="text-white">{order.carrier_profile_code}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Sub-batch Size</dt><dd className="text-white">{order.sub_batch_size}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd className="text-emerald-400 font-bold">{order.status}</dd></div>
          </dl>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">Export Factory Pack</h3>
          <p className="text-xs text-slate-400 mb-4">
            Generates the encrypted zip containing K_META_BATCH and K_FILE_BATCH along with the PDF instructions for the factory.
            <strong> Exporting is atomic and can only be done once.</strong>
          </p>
          <ExportPackForm
            action={exportAction}
            disabled={!canExportFactoryPack || !packagingApproved}
            disabledReason={!canExportFactoryPack
              ? "Factory key packs require the explicit supplier_pack.export capability. Creating an order never grants key export."
              : `Factory export is blocked while packaging is ${packagingStatus}. Complete the industrial specification, physical trials and approval first.`}
          />
        </Card>
      </div>

      <PackagingGovernancePanel orderId={orderId} initialData={packaging} />

      <PackagingLabPanel orderId={orderId} initialData={packagingLab} />

      <SupplierOrderLifecyclePanel
        orderId={orderId}
        orderStatus={order.status}
        packPurpose={effectivePackPurpose}
        sentToSupplierAt={order.sent_to_supplier_at}
        tenantHandoverRecordedAt={order.tenant_handover_recorded_at}
        subBatches={subBatches}
        canManage={canManageLifecycle}
        mfaVerified={session.mfaVerified}
      />

      <DataTable
        title="Sub-batches"
        columns={[
          { key: "sequence", label: "#" },
          { key: "bid", label: "Batch ID (BID)" },
          { key: "quantity", label: "Expected Qty" },
          { key: "manifest", label: "Manifest Status" },
          { key: "qa", label: "QA Status" },
        ]}
        rows={rows}
        filterKey="qa"
        loadingLabel="Loading..."
        emptyLabel="No sub-batches found."
        searchPlaceholder="Search sub-batches..."
        allFilterLabel="All"
        refreshLabel="Refresh"
        statusMap={{}}
      />
    </main>
  );
}
