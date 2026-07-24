import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";

async function getSupplierOrders(context: AdminPageContext) {
  try {
    const response = await fetchAdminPage(context, "supplier-orders");
    if (!response.ok) return [];
    const payload = await response.json();
    return payload.orders || [];
  } catch {
    return [];
  }
}

export default async function SupplierOrdersPage() {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession("supplier_orders:read");
  const adminContext = await createAdminPageContext(session);

  const orders = await getSupplierOrders(adminContext);

  const rows = orders.map((row: any) => ({
    id: row.id,
    order: (
      <Link href={`/supplier-orders/${row.id}`} className="font-bold text-cyan-400 hover:underline">
        {row.order_name || row.id}
      </Link>
    ),
    customer: row.customer_slug || row.tenant_slug,
    chip: row.chip_model,
    profile: row.carrier_profile_code,
    status: row.status,
    quantity: `${row.total_quantity} total / ${row.sub_batch_count} sub-batches`,
  }));

  return (
    <main className="space-y-8">
      <SectionHeading 
        eyebrow="Supplier Ops" 
        title="Supplier Orders" 
        description="Manage factory orders, sub-batches, and export encryption packs." 
      />
      
      <Card className="p-5 text-sm text-slate-300 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">New Supplier Order</h2>
          <p className="mt-2 text-xs text-slate-400">Create a new batch order for a factory, ready for export.</p>
        </div>
        <Link href="/supplier-orders/create" className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-4 py-2 font-bold text-emerald-100">
          Create Order
        </Link>
      </Card>

      <DataTable
        title="Supplier Orders"
        columns={[
          { key: "order", label: "Order" },
          { key: "customer", label: "Customer" },
          { key: "chip", label: "Chip Model" },
          { key: "profile", label: "Carrier Profile" },
          { key: "status", label: "Status" },
          { key: "quantity", label: "Quantity" },
        ]}
        rows={rows}
        filterKey="status"
        loadingLabel="Loading..."
        emptyLabel="No supplier orders found."
        searchPlaceholder="Search orders..."
        allFilterLabel="All"
        refreshLabel="Refresh"
        statusMap={{}}
      />
    </main>
  );
}
