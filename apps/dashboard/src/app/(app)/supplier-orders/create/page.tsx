"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeading } from "@product/ui";

export default function CreateSupplierOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

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
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow="Supplier Ops" title="Create Supplier Order" description="Provision a new supplier batch order." />

      <Card className="p-6 max-w-2xl">
        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Tenant Slug</label>
              <input name="tenant_slug" required className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Customer Slug</label>
              <input name="customer_slug" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Order Name</label>
              <input name="order_name" required className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Base Batch ID</label>
              <input name="base_batch_id" required className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Total Quantity</label>
              <input name="total_quantity" type="number" required min="1" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Sub Batch Size</label>
              <input name="sub_batch_size" type="number" required min="1" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Chip Model</label>
              <select name="chip_model" required className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                <option value="NTAG424_DNA">NTAG424 DNA</option>
                <option value="NTAG424_DNA_TT">NTAG424 DNA TT</option>
                <option value="NTAG213">NTAG213</option>
                <option value="UCODE_9">UCODE 9</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Carrier Profile</label>
              <select name="carrier_profile_code" required className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                <option value="ntag424_dna">NTAG424 DNA (Secure SUN)</option>
                <option value="ntag424_dna_tt">NTAG424 DNA TT (TagTamper)</option>
                <option value="gs1_digital_link">GS1 Digital Link</option>
                <option value="event_wristband">Event Wristband</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Material Type (Optional)</label>
            <input name="material_type" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="e.g. wet_inlay, paper_sticker" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Notes (Optional)</label>
            <textarea name="notes" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white h-20"></textarea>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" disabled={loading} className="rounded-lg bg-cyan-600 px-6 py-2 font-bold text-white hover:bg-cyan-500 disabled:opacity-50">
              {loading ? "Creating..." : "Create Order"}
            </button>
          </div>
        </form>
      </Card>
    </main>
  );
}
