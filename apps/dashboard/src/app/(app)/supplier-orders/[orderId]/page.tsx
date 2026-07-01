import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { productUrls } from "@product/config";
import { DataTable } from "../../../../components/data-table";
import { getDashboardI18n } from "../../../../lib/locale";
import { requireDashboardSession } from "../../../../lib/session";
import { ExportPackForm } from "./export-form";

const API_BASE = productUrls.api;

async function getOrderDetails(orderId: string, tenantScope = "") {
  const query = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";
  const response = await fetch(`${API_BASE}/admin/supplier-orders${query}`, {
    headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.orders?.find((o: any) => o.id === orderId) || null;
}

export default async function SupplierOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession("supplier_orders:read");
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";

  const order = await getOrderDetails(orderId, tenantScope);
  if (!order) {
    return (
      <main className="space-y-8">
        <SectionHeading eyebrow="Supplier Ops" title="Order Not Found" description="The requested order does not exist or you lack permission." />
      </main>
    );
  }

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
    const password = formData.get("password") as string;
    
    const res = await fetch(`${API_BASE}/admin/supplier-orders/${orderId}/export-pack`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}`,
        "X-NexID-Actor": session.userId || "",
      },
      body: JSON.stringify({ password }),
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
          <ExportPackForm action={exportAction} />
        </Card>
      </div>

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
