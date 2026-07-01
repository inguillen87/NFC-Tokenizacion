import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { ShieldAlert, PackageCheck, Package, ShieldCheck } from "lucide-react";
import { productUrls } from "@product/config";
import { requireDashboardSession } from "../../../lib/session";

const API_BASE = productUrls.api;

async function getLogisticsStats(tenantScope = "") {
  try {
    const query = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";
    const response = await fetch(`${API_BASE}/admin/logistics/shipments${query}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return { total: 0, in_transit: 0, delivered: 0, alerts: 0 };
    const payload = await response.json();
    return payload.stats;
  } catch {
    return { total: 0, in_transit: 0, delivered: 0, alerts: 0 };
  }
}

export default async function LogisticsHubPage() {
  const session = await requireDashboardSession("logistics:read");
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";

  const stats = await getLogisticsStats(tenantScope);

  return (
    <main className="space-y-8">
      <SectionHeading 
        eyebrow="Secure Delivery" 
        title="Logistics Hub" 
        description="Manage premium shipments with tamper-evident NFC tags, cryptographic authenticity, and proof of custody." 
      />
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-zinc-400" />
            <h3 className="font-semibold text-zinc-300">Total Shipments</h3>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">{stats.total}</p>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <PackageCheck className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold text-cyan-300">In Transit</h3>
          </div>
          <p className="mt-4 text-3xl font-bold text-cyan-400">{stats.in_transit}</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h3 className="font-semibold text-emerald-300">Delivered Intact</h3>
          </div>
          <p className="mt-4 text-3xl font-bold text-emerald-400">{stats.delivered}</p>
        </Card>

        <Card className="p-6 border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            <h3 className="font-semibold text-red-300">Tamper Alerts</h3>
          </div>
          <p className="mt-4 text-3xl font-bold text-red-400">{stats.alerts}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Operations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/logistics/shipments" className="block p-4 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors">
            <h3 className="font-bold text-cyan-400">View All Shipments</h3>
            <p className="text-sm text-zinc-400 mt-1">Track and audit the chain of custody for all secure deliveries.</p>
          </Link>
          <Link href="/supplier-orders" className="block p-4 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors">
            <h3 className="font-bold text-purple-400">Order Seals</h3>
            <p className="text-sm text-zinc-400 mt-1">Order pre-encoded secure NFC tags for the warehouse pool.</p>
          </Link>
          <div className="block p-4 rounded-lg border border-zinc-800 bg-zinc-900 opacity-50 cursor-not-allowed">
            <h3 className="font-bold text-emerald-400">Scan & Assign (App)</h3>
            <p className="text-sm text-zinc-400 mt-1">Open the Warehouse App to scan and assign tags to shipments.</p>
          </div>
        </div>
      </Card>

    </main>
  );
}
