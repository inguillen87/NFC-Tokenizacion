import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../../components/data-table";
import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";

async function getShipments(context: AdminPageContext) {
  try {
    const response = await fetchAdminPage(context, "logistics/shipments");
    if (!response.ok) return [];
    const payload = await response.json();
    return payload.shipments || [];
  } catch {
    return [];
  }
}

export default async function ShipmentsPage() {
  const session = await requireDashboardSession("logistics:read");
  const adminContext = await createAdminPageContext(session);

  const shipments = await getShipments(adminContext);

  const rows = shipments.map((row: any) => ({
    id: row.id,
    shipmentCode: (
      <Link href={`/logistics/shipments/${row.id}`} className="font-bold text-cyan-400 hover:underline">
        {row.shipment_code || row.id}
      </Link>
    ),
    tenant: row.tenant_id,
    sender: row.sender_name || "Unknown",
    recipient: row.recipient_name || "Unknown",
    status: row.status,
    dates: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
  }));

  const statusMap: Record<string, string> = {
    UNASSIGNED: "Unassigned",
    ASSIGNED: "Assigned",
    SEALED: "Sealed",
    IN_TRANSIT: "In Transit",
    DELIVERED_CLOSED: "Delivered (Intact)",
    DELIVERED_OPENED: "Delivered (Tampered)",
    QUARANTINED: "Quarantined",
  };

  return (
    <main className="space-y-8">
      <SectionHeading 
        eyebrow="Secure Delivery" 
        title="Shipments" 
        description="Audit the chain of custody and tamper events for all secure deliveries." 
      />

      <DataTable
        title="All Shipments"
        columns={[
          { key: "shipmentCode", label: "Shipment Code" },
          { key: "tenant", label: "Tenant" },
          { key: "sender", label: "Sender" },
          { key: "recipient", label: "Recipient" },
          { key: "status", label: "Status" },
          { key: "dates", label: "Created Date" },
        ]}
        rows={rows}
        filterKey="status"
        loadingLabel="Loading..."
        emptyLabel="No secure shipments found."
        searchPlaceholder="Search shipments..."
        allFilterLabel="All"
        refreshLabel="Refresh"
        statusMap={statusMap}
      />
    </main>
  );
}
