import { Terminal, ShieldCheck, Cpu, UploadCloud, ArrowLeft, Hexagon, Network, Key } from "lucide-react";
import Link from "next/link";

export default function AnchorPage() {
  return (
    <main className="min-h-screen bg-black text-emerald-500 font-mono p-4 sm:p-6 lg:p-8 relative overflow-hidden">
       {/* Background Cyberpunk Elements */}
       <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15)_0%,transparent_50%)]" />
       <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay" />
       
       <div className="max-w-6xl mx-auto space-y-6 relative z-10">
         <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-emerald-500/30 pb-4 gap-4">
           <div>
              <Link href="/proof" className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-400 text-xs uppercase tracking-widest mb-4 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Return to Command Center
              </Link>
              <div className="flex items-center gap-3">
                <Terminal className="h-8 w-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">
                    Manual Anchor Interface
                  </h1>
                  <p className="text-emerald-600 text-xs uppercase tracking-widest font-semibold flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-ping shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                    Awaiting Payload Injection
                  </p>
                </div>
              </div>
           </div>
           
           <div className="bg-emerald-950/40 border border-emerald-500/30 px-4 py-2 rounded flex items-center gap-3 shadow-inner">
             <Hexagon className="h-5 w-5 text-emerald-600" />
             <div className="flex flex-col">
               <span className="text-[10px] text-emerald-700 uppercase font-bold">Node Status</span>
               <span className="text-xs text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)] font-black">ONLINE</span>
             </div>
           </div>
         </header>

         <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-black/80 border border-emerald-500/30 rounded-xl p-6 shadow-[0_0_30px_rgba(16,185,129,0.05)] flex flex-col gap-6 relative group overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
               
               <div className="space-y-3">
                  <label className="text-xs uppercase text-emerald-500 font-black tracking-widest flex items-center gap-2">
                    <Network className="h-4 w-4" /> Target Network Layer
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                     <button className="bg-emerald-900/40 border border-emerald-400 text-emerald-300 py-3 px-4 text-sm uppercase tracking-widest rounded shadow-[0_0_15px_rgba(16,185,129,0.2)] font-bold flex flex-col items-center gap-1 group/btn">
                       <span>IOTA EVM Testnet</span>
                       <span className="text-[10px] text-emerald-500 group-hover/btn:text-emerald-300">Gasless Enabled</span>
                     </button>
                     <button className="bg-black/60 border border-emerald-500/20 text-emerald-700 py-3 px-4 text-sm uppercase tracking-widest rounded hover:border-emerald-500/50 hover:text-emerald-500 transition-all font-bold flex flex-col items-center gap-1 opacity-50 cursor-not-allowed">
                       <span>Polygon L2</span>
                       <span className="text-[10px]">Mainnet (Locked)</span>
                     </button>
                  </div>
               </div>

               <div className="space-y-3 flex-1 flex flex-col">
                  <label className="text-xs uppercase text-emerald-500 font-black tracking-widest flex items-center gap-2">
                    <Key className="h-4 w-4" /> Cryptographic Payload (JSON/HEX)
                  </label>
                  <div className="relative flex-1 min-h-[200px]">
                    <div className="absolute top-2 right-2 text-[10px] text-emerald-700 font-bold bg-emerald-950/80 px-2 py-1 rounded">UTF-8 / KECCAK256</div>
                    <textarea 
                      className="w-full h-full bg-emerald-950/10 border border-emerald-500/30 rounded p-4 text-emerald-300 text-sm focus:outline-none focus:border-emerald-400 focus:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all resize-none font-mono placeholder:text-emerald-800"
                      placeholder='{\n  "action": "certify",\n  "timestamp": "1719853482",\n  "data_hash": "0x..."\n}'
                    />
                  </div>
               </div>

               <button className="w-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-400 py-4 uppercase tracking-[0.2em] font-black text-sm rounded hover:bg-emerald-400 hover:text-black hover:shadow-[0_0_30px_rgba(52,211,153,0.6)] transition-all flex items-center justify-center gap-3 group relative overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[shimmer_2s_infinite] opacity-0 group-hover:opacity-100" />
                  <UploadCloud className="h-5 w-5 group-hover:-translate-y-1 transition-transform relative z-10" />
                  <span className="relative z-10">Initialize Anchor Sequence</span>
               </button>
            </div>

            <div className="lg:col-span-2 bg-emerald-950/20 border border-emerald-500/20 rounded-xl overflow-hidden flex flex-col shadow-inner">
              <div className="bg-emerald-900/40 px-4 py-3 border-b border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-emerald-400 animate-pulse" />
                  <span className="text-xs uppercase text-emerald-400 tracking-widest font-black text-shadow-sm">Execution Output</span>
                </div>
                <span className="text-[10px] text-emerald-600 animate-pulse">REC_MODE: ON</span>
              </div>
              <div className="p-5 space-y-3 text-xs sm:text-sm font-mono h-[300px] lg:h-auto lg:flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-700 scrollbar-track-transparent">
                <div className="text-emerald-700 font-bold">&gt; <span className="text-emerald-500">SYS.INIT</span> ... OK</div>
                <div className="text-emerald-700 font-bold">&gt; <span className="text-emerald-500">NET.CONNECT(IOTA_EVM)</span> ... <span className="text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">ESTABLISHED</span></div>
                <div className="text-emerald-700 font-bold mt-4">&gt; <span className="text-emerald-600 animate-pulse">AWAITING PAYLOAD INJECTION ...</span></div>
                <div className="w-full h-[1px] bg-emerald-500/20 my-4" />
                <div className="text-emerald-800 text-[10px] mt-auto pt-4">
                  // Anchor sequence will permanently immutabilize the provided payload onto the selected distributed ledger.
                  // Gas fees are currently subsidized by the Nexus relayer.
                </div>
              </div>
            </div>
         </div>
       </div>
    </main>
  );
}
