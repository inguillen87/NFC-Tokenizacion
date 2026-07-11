import Link from "next/link";
import { headers } from "next/headers";
import { Terminal, ShieldCheck, Cpu, Activity, Zap, Server } from "lucide-react";
import { requireDashboardSession } from "../../../lib/session";
import { getServerOrigin } from "../../../lib/server-origin";

async function getAnchors(origin: string, cookie: string) {
  try {
    const response = await fetch(`${origin}/api/admin/proof/anchors`, {
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return payload.anchors || [];
  } catch {
    return [];
  }
}

export default async function ProofPage() {
  await requireDashboardSession("proof:read");
  const origin = await getServerOrigin();
  const cookie = (await headers()).get("cookie") || "";
  const anchors = await getAnchors(origin, cookie);

  return (
    <main className="min-h-screen bg-black text-emerald-500 font-mono p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Cyberpunk Elements */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08)_0%,transparent_80%)]" />
      <div className="absolute top-0 left-0 w-full h-[1px] bg-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,1)] animate-pulse" />
      <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-emerald-500/30 pb-6 mb-8 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Activity className="h-8 w-8 text-emerald-400 animate-pulse drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">
                Nexus Command Center
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping shadow-[0_0_5px_rgba(52,211,153,1)]" />
                <p className="text-emerald-600 text-xs uppercase tracking-widest font-bold">
                  Live Hash Validation Stream :: SYS.ONLINE
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 text-xs font-bold w-full md:w-auto">
            <div className="flex-1 md:flex-none bg-emerald-950/40 border border-emerald-500/30 px-4 py-2 rounded flex flex-col items-start md:items-end shadow-inner">
              <span className="text-emerald-700 uppercase">Network</span>
              <span className="text-emerald-400 flex items-center gap-1.5 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] text-sm">
                <Zap className="h-3.5 w-3.5 text-emerald-300" /> IOTA EVM
              </span>
            </div>
            <div className="flex-1 md:flex-none bg-emerald-950/40 border border-emerald-500/30 px-4 py-2 rounded flex flex-col items-start md:items-end shadow-inner">
              <span className="text-emerald-700 uppercase">Status</span>
              <span className="text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] text-sm flex items-center gap-1.5">
                 <ShieldCheck className="h-3.5 w-3.5" /> SECURE
              </span>
            </div>
          </div>
        </header>

        {/* Grid of panels */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* Main Terminal Feed */}
          <div className="xl:col-span-3 bg-black/80 border border-emerald-500/20 rounded-xl shadow-inner flex flex-col relative overflow-hidden h-[70vh] min-h-[600px]">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
            
            <div className="bg-emerald-950/40 px-5 py-3 border-b border-emerald-500/20 flex items-center justify-between z-10 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span className="text-xs uppercase text-emerald-400 tracking-widest font-black text-shadow-sm">Anchors.Log</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-bold bg-emerald-950/80 px-2 py-1 rounded border border-emerald-500/20">
                TOTAL_RECORDS: {anchors.length}
              </div>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-700 scrollbar-track-transparent flex-1 z-10">
              {anchors.length === 0 ? (
                <div className="text-emerald-700 animate-pulse text-sm font-bold flex items-center gap-3">
                  <span className="w-1.5 h-4 bg-emerald-600 inline-block animate-ping" />
                  AWAITING INCOMING HASHES...
                </div>
              ) : (
                anchors.map((anchor: any, idx: number) => (
                  <div key={anchor.id || idx} className="group flex flex-col bg-emerald-950/20 hover:bg-emerald-900/40 border border-emerald-500/10 hover:border-emerald-500/40 transition-colors p-4 rounded-lg relative">
                    {/* Decorative cyber corner */}
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-500/30 group-hover:border-emerald-400 rounded-br-lg transition-colors" />
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-500/30 group-hover:border-emerald-400 rounded-tl-lg transition-colors" />
                    
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                      <span className="text-xs sm:text-sm text-emerald-600 font-bold tracking-wider flex items-center gap-2">
                        <span className="text-emerald-800">[</span>
                        {new Date(anchor.created_at || Date.now()).toISOString()}
                        <span className="text-emerald-800">]</span>
                      </span>
                      <span className="text-[10px] sm:text-xs bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded uppercase border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)] font-bold">
                        {anchor.network || "UNKNOWN"}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 mb-4">
                      <span className="text-[10px] text-emerald-700 uppercase font-bold tracking-widest flex items-center gap-2">
                        Merkle Root
                      </span>
                      <span className="text-sm sm:text-base md:text-lg text-emerald-400 break-all font-black drop-shadow-[0_0_5px_rgba(52,211,153,0.5)] group-hover:text-emerald-200 group-hover:drop-shadow-[0_0_12px_rgba(52,211,153,0.9)] transition-all">
                        <span className="text-emerald-700 mr-2 group-hover:text-emerald-500">&gt;</span>
                        {anchor.merkle_root || "0x0000000000000000000000000000000000000000000000000000000000000000"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-emerald-600 border-t border-emerald-500/10 pt-3 group-hover:border-emerald-500/30 transition-colors">
                      <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded">
                        <Server className="h-3 w-3 text-emerald-500" />
                        <span className="font-bold">{anchor.provider || "SYSTEM"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded">
                        <Cpu className="h-3 w-3 text-emerald-500" />
                        <span className="font-bold">{anchor.resource_type || "batch"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded text-emerald-500">
                        <span className="font-bold tracking-widest text-[10px]">EVT_COUNT:</span>
                        <span className="font-black text-emerald-400">{anchor.event_count || 0}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Fade effect at bottom */}
            <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-black to-transparent pointer-events-none z-20" />
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-6 relative overflow-hidden group shadow-inner">
              <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
              <h3 className="text-emerald-400 font-black uppercase tracking-widest text-sm flex items-center gap-2 mb-6 border-b border-emerald-500/20 pb-3">
                <ShieldCheck className="h-4 w-4" /> System Integrity
              </h3>
              
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-emerald-600 font-bold tracking-wider">IOTA L2 Sync</span>
                    <span className="text-emerald-400 font-black drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">100%</span>
                  </div>
                  <div className="h-1.5 bg-emerald-950/80 w-full rounded-full overflow-hidden border border-emerald-900/50">
                    <div className="h-full bg-emerald-400 w-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-emerald-600 font-bold tracking-wider">Polygon Bridge</span>
                    <span className="text-emerald-400 font-black drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] animate-pulse">98%</span>
                  </div>
                  <div className="h-1.5 bg-emerald-950/80 w-full rounded-full overflow-hidden border border-emerald-900/50">
                    <div className="h-full bg-emerald-500 w-[98%] shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                  </div>
                </div>
              </div>

              <div className="mt-8 p-3 bg-red-950/20 border border-red-500/20 rounded">
                <div className="text-[10px] text-red-400/80 uppercase leading-relaxed font-bold tracking-wider">
                  <span className="text-red-500 block mb-1">! WARNING</span>
                  IOTA EVM Testnet is actively prototyping. Data streams are volatile. Do not deploy commercial assertions without consensus override.
                </div>
              </div>
            </div>

            <div className="bg-black/60 border border-emerald-500/30 rounded-xl p-6 shadow-inner relative overflow-hidden">
               <div className="absolute bottom-0 right-0 w-16 h-16 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
               <h3 className="text-emerald-400 font-black uppercase tracking-widest text-sm mb-5 flex items-center gap-2">
                <Terminal className="h-4 w-4" /> Quick Commands
              </h3>
              <div className="space-y-3">
                <Link href="/tokenization" className="block w-full text-left px-4 py-3 bg-emerald-950/30 border border-emerald-500/20 hover:border-emerald-400 hover:bg-emerald-900/40 text-emerald-400 text-xs uppercase tracking-widest transition-all group font-bold shadow-[0_0_10px_rgba(16,185,129,0.05)] rounded">
                  <span className="text-emerald-700 mr-2 group-hover:text-emerald-300 transition-colors">&gt;</span> Initialize Tokenization
                </Link>
                <Link href="/proof/anchor" className="block w-full text-left px-4 py-3 bg-emerald-950/30 border border-emerald-500/20 hover:border-emerald-400 hover:bg-emerald-900/40 text-emerald-400 text-xs uppercase tracking-widest transition-all group font-bold shadow-[0_0_10px_rgba(16,185,129,0.05)] rounded relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <span className="text-emerald-700 mr-2 group-hover:text-emerald-300 transition-colors">&gt;</span> Manual Anchor Tool
                </Link>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </main>
  );
}
