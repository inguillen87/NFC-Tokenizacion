"use client";

import { useEffect, useState } from "react";
import { productUrls } from "@product/config";
import { Card, SectionHeading } from "@product/ui";

type DemoSummary = {
  tenant?: { slug: string; name: string };
  batch?: { bid: string; status: string };
  tagCount?: number;
  events?: Array<{ id: string; created_at: string; result: string; uid_hex: string; city: string }>;
};

async function call(endpoint: string, method = "GET", payload?: unknown) {
  const res = await fetch(`/api/internal/demo/${endpoint}`, {
    method,
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  return res.json();
}

export function DemoLabControlCenter() {
  const [summary, setSummary] = useState<DemoSummary>({});
  const [pack, setPack] = useState("wine-secure");
  const [pending, setPending] = useState(false);
  const [pulseScenario, setPulseScenario] = useState("");

  const refresh = async () => {
    try {
      const data = await call("summary");
      setSummary(data);
    } catch {}
  };

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 4000);
    return () => clearInterval(interval);
  }, []);

  const runAction = async (fn: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    try {
      await fn();
      await refresh();
    } finally {
      setPending(false);
    }
  };

  const triggerScenario = async (scenario: "valid" | "tamper" | "replay") => {
    setPulseScenario(scenario);
    await runAction(() => call("simulate-tap", "POST", { mode: scenario, scenario, vertical: pack.split("-")[0] || "wine" }));
    setTimeout(() => setPulseScenario(""), 1200);
  };

  const openMobilePreviewHref = `${productUrls.web}/sun/simulate?demoMode=true&pack=${pack}`;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-4 md:p-8 font-sans relative overflow-hidden">
      {/* Vercel-like Premium Background Glow */}
      <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[800px] h-[800px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

      <header className="relative z-10 mb-8 border-b border-white/10 pb-6 flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
               Demo Mission Control
               <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 text-[10px] uppercase tracking-widest font-bold border border-cyan-500/30">Live Environment</span>
            </h1>
            <p className="text-sm text-slate-400 mt-2">NFC Interaction Engine. Simulate taps, replay attacks, and tamper events globally.</p>
         </div>
         <div className="flex gap-3">
            <button onClick={() => runAction(() => call("reset", "POST"))} disabled={pending} className="px-4 py-2 bg-slate-900 border border-white/10 hover:border-white/30 text-white text-xs font-semibold rounded-xl transition-all shadow-sm">
               Factory Reset
            </button>
            <a href="/analytics" className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-200 text-xs font-bold rounded-xl transition-all shadow-md">
               View Live Analytics
            </a>
         </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_450px] gap-8 relative z-10">

         {/* LEFT COLUMN: SCENARIOS & ENGINE */}
         <div className="space-y-6">

            {/* Core Scenarios */}
            <Card className="p-6 md:p-8 bg-slate-900/60 backdrop-blur-xl border-white/5 shadow-2xl rounded-3xl">
               <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Tap Scenarios</h2>
                  <span className="text-xs text-slate-500 font-mono">Pack: {pack}</span>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button onClick={() => triggerScenario("valid")} disabled={pending} className={`relative group p-5 rounded-2xl border transition-all duration-300 text-left overflow-hidden ${pulseScenario === "valid" ? "border-emerald-400 bg-emerald-500/10 scale-95" : "border-emerald-500/20 bg-slate-950/50 hover:border-emerald-400/50 hover:bg-emerald-950/40"}`}>
                     {pulseScenario === "valid" && <div className="absolute inset-0 bg-emerald-400/20 animate-ping" />}
                     <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">✓</div>
                     <p className="text-sm font-bold text-white mb-1">Valid Authentication</p>
                     <p className="text-[11px] text-slate-400 leading-relaxed">Simulate a perfect factory-sealed NFC tap in Mendoza.</p>
                  </button>

                  <button onClick={() => triggerScenario("replay")} disabled={pending} className={`relative group p-5 rounded-2xl border transition-all duration-300 text-left overflow-hidden ${pulseScenario === "replay" ? "border-amber-400 bg-amber-500/10 scale-95" : "border-amber-500/20 bg-slate-950/50 hover:border-amber-400/50 hover:bg-amber-950/40"}`}>
                     {pulseScenario === "replay" && <div className="absolute inset-0 bg-amber-400/20 animate-ping" />}
                     <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">⚠️</div>
                     <p className="text-sm font-bold text-white mb-1">Replay Attack</p>
                     <p className="text-[11px] text-slate-400 leading-relaxed">Trigger a cloned URL scan from a suspect IP address.</p>
                  </button>

                  <button onClick={() => triggerScenario("tamper")} disabled={pending} className={`relative group p-5 rounded-2xl border transition-all duration-300 text-left overflow-hidden ${pulseScenario === "tamper" ? "border-rose-400 bg-rose-500/10 scale-95" : "border-rose-500/20 bg-slate-950/50 hover:border-rose-400/50 hover:bg-rose-950/40"}`}>
                     {pulseScenario === "tamper" && <div className="absolute inset-0 bg-rose-400/20 animate-ping" />}
                     <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-110 transition-transform">❌</div>
                     <p className="text-sm font-bold text-white mb-1">Tamper Alert</p>
                     <p className="text-[11px] text-slate-400 leading-relaxed">Simulate an opened seal or physically broken tag.</p>
                  </button>
               </div>
            </Card>

            {/* Technical Stream Log */}
            <Card className="p-6 bg-black/40 backdrop-blur-md border-white/5 shadow-inner rounded-3xl h-[300px] flex flex-col">
               <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                     Live Stream Pipeline
                  </h2>
               </div>
               <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs pr-2">
                  {(summary.events || []).length === 0 ? (
                     <p className="text-slate-600 italic">Awaiting NFC interactions...</p>
                  ) : (
                     (summary.events || []).slice(0, 20).map((ev) => (
                        <div key={ev.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                           <span className="text-slate-500">[{new Date(ev.created_at).toLocaleTimeString()}]</span>
                           <span className={`font-bold w-24 ${ev.result === "valid" ? "text-emerald-400" : ev.result === "replay_suspect" ? "text-amber-400" : "text-rose-400"}`}>
                              {ev.result.toUpperCase()}
                           </span>
                           <span className="text-slate-400 flex-1 truncate">{ev.uid_hex || "UID_UNKNOWN"}</span>
                           <span className="text-cyan-300 text-[10px] uppercase">{ev.city || "Unknown"}</span>
                        </div>
                     ))
                  )}
               </div>
            </Card>
         </div>

         {/* RIGHT COLUMN: INTERACTIVE HARDWARE PREVIEW */}
         <div className="flex justify-center items-start lg:sticky lg:top-8 h-full">
            <div className="relative w-[340px] h-[720px] rounded-[3.5rem] border-[12px] border-slate-950 bg-black shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden shrink-0 ring-1 ring-white/10">
               {/* Hardware Frame UI Details */}
               <div className="absolute top-0 inset-x-0 h-6 bg-slate-950 rounded-b-2xl w-32 mx-auto z-50 flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                  <div className="w-8 h-1.5 rounded-full bg-slate-800" />
               </div>

               {/* Concentric Scan Pulse Overlay (Active on Tap) */}
               {pulseScenario && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/60 backdrop-blur-sm">
                     <div className="absolute w-32 h-32 rounded-full border-4 border-cyan-400/50 animate-ping" />
                     <div className="absolute w-64 h-64 rounded-full border-2 border-cyan-400/30 animate-ping" style={{ animationDelay: "150ms" }} />
                     <div className="absolute w-96 h-96 rounded-full border border-cyan-400/10 animate-ping" style={{ animationDelay: "300ms" }} />
                     <div className="w-16 h-16 rounded-full bg-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.8)] flex items-center justify-center">
                        <span className="text-2xl animate-bounce">📱</span>
                     </div>
                  </div>
               )}

               <iframe
                  src={openMobilePreviewHref}
                  className="w-full h-full border-0 bg-black relative z-10"
                  title="Mobile Preview"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
               />
            </div>
         </div>
      </div>
    </div>
  );
}
