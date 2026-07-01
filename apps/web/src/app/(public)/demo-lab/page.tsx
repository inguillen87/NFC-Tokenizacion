import type { Metadata } from "next";
import Link from "next/link";
import { getWebI18n } from "../../../lib/locale";
import { DemoLabClient } from "./demo-lab-client";
import { 
  Box, 
  Network, 
  ShieldCheck, 
  ArrowRight, 
  Smartphone,
  ScanLine,
  Fingerprint,
  Wifi,
  Battery
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  return {
    title: "Demo Lab · nexID",
    openGraph: {
      title: "Demo Lab · nexID",
      images: [{ url: `/opengraph-image?surface=demo-lab&campaign=investor&locale=${encodeURIComponent(locale)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Demo Lab · nexID",
      images: [`/twitter-image?surface=demo-lab&campaign=investor&locale=${encodeURIComponent(locale)}`],
    },
  };
}

type DemoLabPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DemoLabPage({ searchParams }: DemoLabPageProps) {
  const { locale } = await getWebI18n();
  const params = searchParams ? await searchParams : {};
  const initialVertical = firstParam(params.vertical || params.rubro || params.industry || params.useCase);
  const initialScenario = firstParam(params.scenario || params.proof || params.layer);

  // If a scenario or vertical is selected, render the lab client
  if (initialScenario || initialVertical) {
    return <DemoLabClient locale={locale} initialVertical={initialVertical} initialScenario={initialScenario} />;
  }

  // Otherwise, render the New Immersive Scanner UI
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans relative flex items-center justify-center overflow-hidden selection:bg-brand-500/30">
      {/* Animated Gradients Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[10%] right-[20%] w-[600px] h-[600px] bg-brand-500/20 rounded-full blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[100px] mix-blend-screen" />
      </div>

      {/* Mobile App Wrapper */}
      <div className="relative z-10 w-full max-w-[400px] h-[800px] max-h-[90vh] bg-black/40 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(255,255,255,0.05)] overflow-hidden flex flex-col mx-4 ring-1 ring-white/5">
        
        {/* Fake Status Bar */}
        <div className="w-full h-12 flex items-center justify-between px-8 text-[11px] font-medium text-white/70 pt-2 shrink-0">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4" />
          </div>
        </div>

        {/* Dynamic Island / Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-full flex items-center justify-center border border-white/5 shadow-inner">
           <div className="w-2 h-2 rounded-full bg-white/20 mr-4" />
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
        </div>

        {/* Content Area */}
        <div 
          className="flex-1 w-full flex flex-col p-6 overflow-y-auto overflow-x-hidden relative"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
          <style>{`
            ::-webkit-scrollbar { display: none; }
          `}</style>
          
          <div className="text-center mt-6 mb-8 flex flex-col items-center">
             <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md mb-6 shadow-2xl relative">
                <div className="absolute inset-0 bg-brand-500/20 rounded-2xl blur-md" />
                <Fingerprint className="w-8 h-8 text-brand-300 relative z-10" />
             </div>
             <h1 className="text-3xl font-extrabold tracking-tight mb-2">
               nexID <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-blue-500">Scanner</span>
             </h1>
             <p className="text-sm text-neutral-400">Hold near a product to verify</p>
          </div>

          {/* Scanner Radar / Big Button */}
          <div className="relative w-full flex items-center justify-center my-6 h-64 shrink-0">
             <div className="absolute inset-0 bg-brand-500/5 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '3s' }} />
             
             {/* Ripple rings */}
             <div className="absolute w-[200px] h-[200px] rounded-full border border-brand-500/30 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
             <div className="absolute w-[280px] h-[280px] rounded-full border border-brand-500/20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" style={{ animationDelay: '1s' }} />

             <button className="relative z-10 w-44 h-44 rounded-full bg-gradient-to-b from-brand-400/20 to-brand-600/5 border border-brand-300/30 backdrop-blur-xl shadow-2xl shadow-brand-500/20 flex flex-col items-center justify-center group hover:scale-105 active:scale-95 transition-all duration-500 ease-out cursor-default">
               <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
               <ScanLine className="w-14 h-14 text-brand-300 mb-3 group-hover:scale-110 transition-transform duration-500 group-hover:text-white" />
               <span className="text-sm font-bold text-white tracking-widest uppercase opacity-90">Scan NFC</span>
             </button>
          </div>

          <div className="w-full mt-auto space-y-3 z-10 relative pb-10">
             <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest pl-2 mb-3">Select Simulation Layer</div>
             
             {/* Polygon Button */}
             <Link href="/demo-lab?scenario=polygon-ownership" className="group relative w-full p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-brand-500/50 backdrop-blur-md transition-all duration-300 flex items-center overflow-hidden hover:shadow-lg hover:shadow-brand-500/10">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                   <Box className="w-5 h-5 text-brand-300" />
                </div>
                <div className="flex-1">
                   <h3 className="text-sm font-bold text-white group-hover:text-brand-100 transition-colors">Polygon Ownership</h3>
                   <p className="text-xs text-neutral-400">Web3 Digital Twins</p>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
             </Link>

             {/* IOTA Button */}
             <Link href="/demo-lab?scenario=iota-proof" className="group relative w-full p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-emerald-500/50 backdrop-blur-md transition-all duration-300 flex items-center overflow-hidden hover:shadow-lg hover:shadow-emerald-500/10">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                   <Network className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                   <h3 className="text-sm font-bold text-white group-hover:text-emerald-100 transition-colors">IOTA Proof</h3>
                   <p className="text-xs text-neutral-400">Logistics Audit Trail</p>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
             </Link>

             {/* Offline Button */}
             <Link href="/demo-lab?scenario=offline-verifier" className="group relative w-full p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-blue-500/50 backdrop-blur-md transition-all duration-300 flex items-center overflow-hidden hover:shadow-lg hover:shadow-blue-500/10">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                   <ShieldCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                   <h3 className="text-sm font-bold text-white group-hover:text-blue-100 transition-colors">Offline Field Scan</h3>
                   <p className="text-xs text-neutral-400">No-connectivity checks</p>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
             </Link>
             
             <div className="w-full pt-2 text-center">
               <Link href="/demo-lab?scenario=qr-gs1" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors py-2 px-4 rounded-full hover:bg-white/5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Standard QR/GS1 Tracking</span>
               </Link>
             </div>
          </div>

        </div>

        {/* Bottom Home Indicator */}
        <div className="w-full h-6 flex items-center justify-center pb-2 bg-gradient-to-t from-black/80 to-transparent absolute bottom-0 z-20 pointer-events-none">
           <div className="w-32 h-1 bg-white/30 rounded-full" />
        </div>
      </div>
      
      {/* Decorative environment elements */}
      <div className="absolute bottom-6 text-center w-full max-w-md pointer-events-none opacity-40">
        <p className="text-[10px] font-mono text-white/50 tracking-widest uppercase">nexID Web3 Consumer Experience</p>
      </div>
    </div>
  );
}
