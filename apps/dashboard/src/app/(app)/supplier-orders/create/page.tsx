"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeading } from "@product/ui";
import {
  parseSupplierOrderCreationPurpose,
  type SupplierOrderCreationPurpose,
} from "../../../../lib/supplier-pack-purpose-policy";
import { dashboardHighImpactPermissionMatches } from "../../../../lib/permission-policy";

export default function CreateSupplierOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [packPurpose, setPackPurpose] = useState<SupplierOrderCreationPurpose | "">("");
  const [accessResolved, setAccessResolved] = useState(false);
  const [canCreateSupplierOrder, setCanCreateSupplierOrder] = useState(false);
  const [canGenerateBatchKeys, setCanGenerateBatchKeys] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetch("/api/session/current", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.json().catch(() => null))
      .then((payload) => {
        if (!active) return;
        const session = payload?.session;
        const allowed = dashboardHighImpactPermissionMatches(
          session?.role,
          session?.permissions,
          "supplier_order.create",
          session?.deniedPermissions,
        );
        setCanCreateSupplierOrder(allowed);
        setCanGenerateBatchKeys(dashboardHighImpactPermissionMatches(
          session?.role,
          session?.permissions,
          "batch.keys.generate",
          session?.deniedPermissions,
        ));
        if (!allowed) {
          setError("Your session does not have supplier_order.create.");
        }
      })
      .catch(() => {
        if (active) setError("Unable to verify the supplier-order capability.");
      })
      .finally(() => {
        if (active) setAccessResolved(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!canCreateSupplierOrder) {
      setError("Your session does not have supplier_order.create.");
      return;
    }

    const exactPurpose = parseSupplierOrderCreationPurpose(packPurpose);
    if (!exactPurpose) {
      setError("Choose the supplier pack purpose explicitly before creating the order.");
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      tenant_slug: formData.get("tenant_slug"),
      customer_slug: formData.get("customer_slug"),
      order_name: formData.get("order_name"),
      base_batch_id: formData.get("base_batch_id"),
      total_quantity: Number(formData.get("total_quantity")),
      sub_batch_size: Number(formData.get("sub_batch_size")),
      chip_model: formData.get("chip_model"),
      carrier_profile_code: formData.get("carrier_profile_code"),
      material_type: formData.get("material_type"),
      notes: formData.get("notes"),
      pack_purpose: exactPurpose,
    };

    try {
      const res = await fetch("/api/admin/supplier-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.reason || data.message || "Failed to create order");
      }

      router.push(`/supplier-orders/${data.order.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create order");
      setLoading(false);
    }
  };

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow="Supplier Ops" title="Create Supplier Order" description="Order creation is independent from batch-key generation and encrypted factory-pack export." />

      <Card className="p-6 max-w-2xl">
        <p className="mb-4 rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-50">
          This session {canGenerateBatchKeys ? "also has batch.keys.generate" : "does not have batch.keys.generate"}. The backend evaluates key generation separately; creating an order never grants factory-pack export.
        </p>
        {error && <div role="alert" className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supplier-order-tenant-slug" className="block text-xs font-bold text-slate-400 mb-1">Tenant Slug</label>
              <input id="supplier-order-tenant-slug" name="tenant_slug" required autoComplete="organization" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
            <div>
              <label htmlFor="supplier-order-customer-slug" className="block text-xs font-bold text-slate-400 mb-1">Customer Slug</label>
              <input id="supplier-order-customer-slug" name="customer_slug" autoComplete="off" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supplier-order-name" className="block text-xs font-bold text-slate-400 mb-1">Order Name</label>
              <input id="supplier-order-name" name="order_name" required autoComplete="off" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
            <div>
              <label htmlFor="supplier-order-base-batch-id" className="block text-xs font-bold text-slate-400 mb-1">Base Batch ID</label>
              <input id="supplier-order-base-batch-id" name="base_batch_id" required autoComplete="off" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
          </div>

          <fieldset aria-describedby="pack-purpose-help" className="rounded-lg border border-slate-700 p-4">
            <legend className="px-1 text-sm font-bold text-white">Supplier pack purpose</legend>
            <p id="pack-purpose-help" className="mb-3 text-xs text-slate-400">
              Required. NexID never infers this choice from the tenant, brand, product, or quantity.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-lg border p-3 ${packPurpose === "trial_integration" ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700 bg-slate-900"}`}>
                <span className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="pack_purpose"
                    value="trial_integration"
                    checked={packPurpose === "trial_integration"}
                    onChange={() => setPackPurpose("trial_integration")}
                    required
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-bold text-white">Trial integration</span>
                    <span className="mt-1 block text-xs text-slate-400">
                      NON_SELLABLE. Integration and physical validation only; tags cannot be sold, claimed, tokenized, or activated.
                    </span>
                  </span>
                </span>
              </label>
              <label className={`cursor-pointer rounded-lg border p-3 ${packPurpose === "production" ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700 bg-slate-900"}`}>
                <span className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="pack_purpose"
                    value="production"
                    checked={packPurpose === "production"}
                    onChange={() => setPackPurpose("production")}
                    required
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-bold text-white">Production</span>
                    <span className="mt-1 block text-xs text-slate-400">
                      Requires a tenant-approved AQL plan and production receiving QA v2. Creation leaves every tag blocked and does not activate it.
                    </span>
                  </span>
                </span>
              </label>
            </div>
            {packPurpose ? (
              <div data-testid="supplier-order-create-purpose-contract" role="status" className="mt-3 rounded border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
                {packPurpose === "trial_integration"
                  ? "Contract: trial_integration / NON_SELLABLE / activation prohibited."
                  : "Contract: production / blocked until the approved AQL plan and receiving QA v2 pass."}
              </div>
            ) : null}
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supplier-order-total-quantity" className="block text-xs font-bold text-slate-400 mb-1">Total Quantity</label>
              <input id="supplier-order-total-quantity" name="total_quantity" type="number" inputMode="numeric" required min="1" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
            <div>
              <label htmlFor="supplier-order-sub-batch-size" className="block text-xs font-bold text-slate-400 mb-1">Sub Batch Size</label>
              <input id="supplier-order-sub-batch-size" name="sub_batch_size" type="number" inputMode="numeric" required min="1" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supplier-order-chip-model" className="block text-xs font-bold text-slate-400 mb-1">Chip Model</label>
              <select id="supplier-order-chip-model" name="chip_model" required className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                <option value="NTAG424_DNA">NTAG424 DNA</option>
                <option value="NTAG424_DNA_TT">NTAG424 DNA TT</option>
                <option value="NTAG213">NTAG213</option>
                <option value="UCODE_9">UCODE 9</option>
              </select>
            </div>
            <div>
              <label htmlFor="supplier-order-carrier-profile" className="block text-xs font-bold text-slate-400 mb-1">Carrier Profile</label>
              <select id="supplier-order-carrier-profile" name="carrier_profile_code" required className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                <option value="ntag424_dna">NTAG424 DNA (Secure SUN)</option>
                <option value="ntag424_dna_tt">NTAG424 DNA TT (TagTamper)</option>
                <option value="gs1_digital_link">GS1 Digital Link</option>
                <option value="event_wristband">Event Wristband</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="supplier-order-material-type" className="block text-xs font-bold text-slate-400 mb-1">Material Type (Optional)</label>
            <input id="supplier-order-material-type" name="material_type" autoComplete="off" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="e.g. wet_inlay, paper_sticker" />
          </div>

          <div>
            <label htmlFor="supplier-order-notes" className="block text-xs font-bold text-slate-400 mb-1">Notes (Optional)</label>
            <textarea id="supplier-order-notes" name="notes" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white h-20"></textarea>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" disabled={loading || !accessResolved || !canCreateSupplierOrder || !parseSupplierOrderCreationPurpose(packPurpose)} className="rounded-lg bg-cyan-600 px-6 py-2 font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Creating..." : !accessResolved ? "Verifying authority..." : "Create Order"}
            </button>
          </div>
        </form>
      </Card>
    </main>
  );
}
