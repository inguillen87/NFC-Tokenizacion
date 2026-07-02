"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Activity, CheckCircle2, PackagePlus, Radio, ShieldAlert, Truck } from "lucide-react";

type ShipmentResult = {
  id?: string;
  shipmentCode?: string;
  trackingNumber?: string | null;
  status?: string;
  tenantId?: string;
  itemCount?: number;
};

type Props = {
  tenantSlug?: string | null;
  role?: string;
};

function readText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function ResultPanel({ result }: { result: unknown }) {
  if (!result) return null;
  return (
    <pre className="mt-4 max-h-56 overflow-auto rounded-2xl border border-cyan-500/20 bg-slate-950/80 p-4 text-xs leading-relaxed text-cyan-50">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

export function SecureDeliveryOpsConsole({ tenantSlug, role }: Props) {
  const router = useRouter();
  const [activeShipment, setActiveShipment] = useState<ShipmentResult | null>(null);
  const [createResult, setCreateResult] = useState<unknown>(null);
  const [scanResult, setScanResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"shipment" | "scan" | null>(null);
  const [context, setContext] = useState<"APPLY" | "HANDOFF" | "VERIFY">("APPLY");

  const tenantLocked = Boolean(tenantSlug);
  const operatorLabel = useMemo(() => {
    if (role === "tenant-admin" && tenantSlug) return `Tenant scope: ${tenantSlug}`;
    if (role) return `Role: ${role}`;
    return "Secure Delivery operator";
  }, [role, tenantSlug]);

  async function createShipment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("shipment");
    setError("");
    setCreateResult(null);
    const formData = new FormData(event.currentTarget);
    const tenant = tenantSlug || readText(formData, "tenant_slug");
    const productName = readText(formData, "product_name");
    const quantity = Math.max(1, Number(formData.get("quantity") || 1));

    if (!tenant && !tenantLocked) {
      setError("Tenant slug is required for super-admin/security-operator workflows.");
      setLoading(null);
      return;
    }
    if (!productName) {
      setError("Product or asset name is required.");
      setLoading(null);
      return;
    }

    const payload = {
      tenant_slug: tenant,
      shipment_code: readText(formData, "shipment_code"),
      carrier_code: readText(formData, "carrier_code"),
      tracking_number: readText(formData, "tracking_number"),
      origin_address: readText(formData, "origin_address"),
      destination_address: readText(formData, "destination_address"),
      items: [{ productName, quantity }],
    };

    try {
      const response = await fetch("/api/admin/logistics/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || data.reason || "Shipment creation failed");
      setActiveShipment(data.shipment || null);
      setCreateResult(data);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Shipment creation failed");
    } finally {
      setLoading(null);
    }
  }

  async function runScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("scan");
    setError("");
    setScanResult(null);
    const formData = new FormData(event.currentTarget);
    const shipmentId = readText(formData, "shipment_id") || activeShipment?.id || "";
    const uidHex = readText(formData, "uid_hex");
    const tenant = tenantSlug || readText(formData, "tenant_slug");

    if (!uidHex) {
      setError("Seal UID is required.");
      setLoading(null);
      return;
    }
    if (context === "APPLY" && !shipmentId) {
      setError("Shipment ID is required before applying a seal.");
      setLoading(null);
      return;
    }

    const payload = {
      context,
      tenant_slug: tenant,
      shipment_id: shipmentId,
      uid_hex: uidHex,
      tt_raw: readText(formData, "tt_raw") || "4343",
      location: readText(formData, "location"),
      scanned_by: readText(formData, "scanned_by"),
      recipient_name: readText(formData, "recipient_name"),
      verification_method: readText(formData, "verification_method") || "NFC_TAP",
    };

    try {
      const response = await fetch("/api/admin/logistics/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || data.reason || "Scan failed");
      setScanResult(data);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Scan failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section id="secure-delivery-ops" className="rounded-3xl border border-cyan-500/15 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/20 md:p-7">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Warehouse operation</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Create shipment, bind seal, verify delivery</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            The premium logistics workflow uses pre-encoded seal inventory, then binds a UID to a specific shipment at packing time. No CLI, no exposed admin key, no generic tracking theater.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-slate-300">
          {operatorLabel}
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={createShipment} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300"><PackagePlus className="h-5 w-5" /></span>
            <div>
              <h3 className="text-lg font-black text-white">1. Shipment registry</h3>
              <p className="text-xs text-slate-400">Register the package or asset before the operator applies a physical seal.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {!tenantLocked ? (
              <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Tenant slug
                <input name="tenant_slug" required className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-cyan-400" placeholder="demobodega" />
              </label>
            ) : null}
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Shipment code
              <input name="shipment_code" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-cyan-400" placeholder="Auto if blank" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Tracking / order ID
              <input name="tracking_number" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-cyan-400" placeholder="IT-ONBOARD-7421" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Carrier code
              <input name="carrier_code" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-cyan-400" placeholder="private-courier" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Origin
              <input name="origin_address" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-cyan-400" placeholder="Warehouse AR" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Destination
              <input name="destination_address" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-cyan-400" placeholder="Employee / premium buyer" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Product / asset
              <input name="product_name" required className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-cyan-400" placeholder="MacBook Pro M4 sealed kit" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Quantity
              <input name="quantity" type="number" min="1" defaultValue="1" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-cyan-400" />
            </label>
          </div>

          <button disabled={loading === "shipment"} className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">
            {loading === "shipment" ? "Creating..." : "Create secure shipment"}
          </button>
          <ResultPanel result={createResult} />
        </form>

        <form onSubmit={runScan} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300"><Radio className="h-5 w-5" /></span>
            <div>
              <h3 className="text-lg font-black text-white">2. Seal operation</h3>
              <p className="text-xs text-slate-400">Apply, handoff or recipient verification scan for the physical seal.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1">
            {(["APPLY", "HANDOFF", "VERIFY"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setContext(item)} className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide transition ${context === item ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>
                {item}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {!tenantLocked ? (
              <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Tenant slug
                <input name="tenant_slug" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-emerald-400" placeholder="Optional if shipment ID resolves tenant" />
              </label>
            ) : null}
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Shipment ID
              <input name="shipment_id" defaultValue={activeShipment?.id || ""} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-emerald-400" placeholder="Created shipment UUID" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Seal UID
              <input name="uid_hex" required className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm uppercase text-white outline-none focus:border-emerald-400" placeholder="04AABBCCDD1090" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              TTSTATUS
              <select name="tt_raw" defaultValue="4343" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400">
                <option value="4343">4343 - closed</option>
                <option value="4F4F">4F4F - opened</option>
                <option value="4F43">4F43 - opened previously</option>
                <option value="4949">4949 - invalid</option>
                <option value="">unknown / missing</option>
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Location
              <input name="location" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-emerald-400" placeholder="Packing bench / courier hub" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Operator
              <input name="scanned_by" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-emerald-400" placeholder="ops@nexid.lat" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Recipient
              <input name="recipient_name" disabled={context !== "VERIFY"} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-emerald-400 disabled:opacity-40" placeholder="Only for verify" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Verification method
              <input name="verification_method" disabled={context !== "VERIFY"} defaultValue="NFC_TAP" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white outline-none focus:border-emerald-400 disabled:opacity-40" />
            </label>
          </div>

          <button disabled={loading === "scan"} className="mt-5 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60">
            {loading === "scan" ? "Scanning..." : `Run ${context.toLowerCase()} scan`}
          </button>
          <ResultPanel result={scanResult} />
        </form>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          { icon: PackagePlus, label: "Shipment created", body: "Order, carrier, origin and destination become auditable." },
          { icon: CheckCircle2, label: "Seal applied", body: "Pre-encoded UID is bound to the physical package." },
          { icon: Truck, label: "Courier handoff", body: "Transfer events keep chain of custody visible." },
          { icon: ShieldAlert, label: "Recipient verify", body: "Closed seal confirms delivery; opened seal triggers review." },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <item.icon className="h-5 w-5 text-cyan-300" />
            <h4 className="mt-3 text-sm font-black text-white">{item.label}</h4>
            <p className="mt-1 text-xs leading-5 text-slate-400">{item.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <Activity className="h-3.5 w-3.5 text-cyan-300" />
        Seal UID must already exist in secure inventory from Supplier Ops. This console binds and audits, it does not expose factory keys.
      </p>
    </section>
  );
}
