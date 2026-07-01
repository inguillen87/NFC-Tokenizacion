import Link from "next/link";
import { SectionHeading } from "@product/ui";
import { ShieldAlert, PackageCheck, Package, ShieldCheck, Navigation, Truck, MapPin, Zap, Activity } from "lucide-react";
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
    <main className="space-y-8 pb-12">
      <SectionHeading 
        eyebrow="Secure Delivery" 
        title="Logistics Hub" 
        description="Manage premium shipments with tamper-evident NFC tags, cryptographic authenticity, and real-time proof of custody." 
      />
      
      {/* Visual Placeholder for Real-Time Tracking Map */}
      <div className="relative w-full h-[400px] rounded-3xl overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center shadow-2xl">
        {/* Map Background grid/gradient */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1),transparent_70%)]"></div>

        {/* Simulated routes */}
        <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M 10%,80% C 30%,50% 60%,90% 90%,30%" fill="none" stroke="url(#cyan-gradient)" strokeWidth="2" strokeDasharray="4 6" className="animate-pulse" />
          <path d="M 20%,20% C 40%,10% 70%,50% 80%,80%" fill="none" stroke="url(#cyan-gradient)" strokeWidth="1.5" strokeDasharray="3 5" className="animate-pulse" style={{ animationDelay: '1s' }} />
          <defs>
            <linearGradient id="cyan-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Animated Pings/Markers */}
        <div className="absolute top-[30%] left-[20%] flex items-center justify-center">
          <div className="absolute h-12 w-12 rounded-full bg-cyan-400/20 animate-ping"></div>
          <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]"></div>
          <div className="absolute -top-8 bg-slate-900/80 backdrop-blur-sm border border-cyan-500/30 text-cyan-400 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap">
            HUB-EAST
          </div>
          <Truck className="absolute -top-3 text-cyan-300 h-4 w-4" />
        </div>

        <div className="absolute top-[80%] left-[80%] flex items-center justify-center">
          <div className="absolute h-10 w-10 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDelay: '1.5s' }}></div>
          <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]"></div>
          <div className="absolute -top-8 bg-slate-900/80 backdrop-blur-sm border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap">
            DEST-39A
          </div>
          <MapPin className="absolute -top-3 text-emerald-300 h-4 w-4" />
        </div>

        <div className="absolute top-[50%] left-[60%] flex items-center justify-center">
          <div className="absolute h-16 w-16 rounded-full bg-blue-400/10 animate-ping" style={{ animationDelay: '0.8s' }}></div>
          <div className="h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.8)]"></div>
          <Navigation className="absolute -top-3 text-blue-300 h-3.5 w-3.5" />
        </div>

        <div className="absolute top-[20%] left-[70%] flex items-center justify-center">
          <div className="absolute h-14 w-14 rounded-full bg-rose-500/20 animate-ping" style={{ animationDelay: '0.2s' }}></div>
          <div className="h-3.5 w-3.5 rounded-full bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.8)]"></div>
          <div className="absolute -top-8 bg-slate-900/80 backdrop-blur-sm border border-rose-500/40 text-rose-400 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap">
            ALERT
          </div>
          <ShieldAlert className="absolute -top-4 text-rose-400 h-5 w-5" />
        </div>

        {/* Glassmorphic Overlay Box */}
        <div className="absolute bottom-6 left-6 right-6 md:left-auto md:right-8 md:w-72 rounded-2xl bg-slate-950/70 backdrop-blur-xl border border-white/10 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </div>
            <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Live Network</h3>
          </div>
          <div className="space-y-4 text-xs font-medium text-slate-300">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-cyan-400" /> Active Nodes</span>
              <span className="font-mono text-sm text-cyan-100">{stats.in_transit}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-emerald-400" /> Secure Handoffs</span>
              <span className="font-mono text-sm text-emerald-100">{stats.delivered}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5 text-rose-400" /> Active Alerts</span>
              <span className="font-mono text-sm text-rose-100">{stats.alerts}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 transition-all duration-300 hover:bg-slate-800/80 hover:shadow-lg hover:-translate-y-1 group">
          <div className="absolute -right-6 -top-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
            <Package className="h-32 w-32" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 border border-white/5 text-slate-300 shadow-inner">
              <Package className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm text-slate-400">Total Shipments</h3>
          </div>
          <p className="mt-5 text-4xl font-light tracking-tight text-white">{stats.total}</p>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-md border border-cyan-500/20 p-6 transition-all duration-300 hover:bg-slate-800/80 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:-translate-y-1 group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent"></div>
          <div className="absolute -right-6 -top-6 opacity-[0.05] group-hover:opacity-10 transition-opacity">
            <PackageCheck className="h-32 w-32 text-cyan-400" />
          </div>
          <div className="relative flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              <PackageCheck className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm text-cyan-400/80">In Transit</h3>
          </div>
          <p className="relative mt-5 text-4xl font-light tracking-tight text-white">{stats.in_transit}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-md border border-emerald-500/20 p-6 transition-all duration-300 hover:bg-slate-800/80 hover:shadow-[0_0_20px_rgba(52,211,153,0.1)] hover:-translate-y-1 group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent"></div>
          <div className="absolute -right-6 -top-6 opacity-[0.05] group-hover:opacity-10 transition-opacity">
            <ShieldCheck className="h-32 w-32 text-emerald-400" />
          </div>
          <div className="relative flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm text-emerald-400/80">Delivered Intact</h3>
          </div>
          <p className="relative mt-5 text-4xl font-light tracking-tight text-white">{stats.delivered}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-md border border-rose-500/20 p-6 transition-all duration-300 hover:bg-slate-800/80 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:-translate-y-1 group">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent"></div>
          <div className="absolute -right-6 -top-6 opacity-[0.05] group-hover:opacity-10 transition-opacity">
            <ShieldAlert className="h-32 w-32 text-rose-400" />
          </div>
          <div className="relative flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-950 border border-rose-500/30 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm text-rose-400/80">Tamper Alerts</h3>
          </div>
          <p className="relative mt-5 text-4xl font-light tracking-tight text-white">{stats.alerts}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-slate-900/30 backdrop-blur-xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]"></div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Command Center</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/logistics/shipments" className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 p-6 transition-all duration-300 hover:bg-slate-900 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] hover:-translate-y-1">
            <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.15] transition-all duration-500 transform group-hover:scale-110 translate-x-4 translate-y-4">
              <Navigation className="h-32 w-32 text-cyan-400" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-cyan-400 mb-3 flex items-center gap-2">
                View All Shipments
                <Navigation className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                Track and audit the cryptographic chain of custody for all secure deliveries in real-time.
              </p>
            </div>
          </Link>

          <Link href="/supplier-orders" className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 p-6 transition-all duration-300 hover:bg-slate-900 hover:border-purple-500/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:-translate-y-1">
            <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.15] transition-all duration-500 transform group-hover:scale-110 translate-x-4 translate-y-4">
              <Package className="h-32 w-32 text-purple-400" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-purple-400 mb-3 flex items-center gap-2">
                Order Seals
                <Package className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                Request new pre-encoded secure NFC tags to replenish your warehouse distribution pool.
              </p>
            </div>
          </Link>

          <div className="relative block overflow-hidden rounded-2xl border border-white/5 bg-slate-950/30 p-6 opacity-60 cursor-not-allowed group">
            <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-4 translate-y-4">
              <Activity className="h-32 w-32" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-emerald-500/80 mb-3 flex items-center gap-3">
                Scan & Assign
                <span className="text-[9px] uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-bold border border-emerald-500/30">App</span>
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Open the mobile Warehouse App to scan physical tags and cryptographicly bind them to shipments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
