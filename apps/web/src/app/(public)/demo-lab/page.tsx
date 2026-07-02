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

  // If a scenario or vertical is selected, render the Split-Screen Lab
  if (initialScenario || initialVertical) {
    const isPolygon = initialScenario === 'polygon-ownership';
    const isIota = initialScenario === 'iota-proof';
    const isOffline = initialScenario === 'offline-verifier';
    
    return (
      <div className="flex flex-col xl:flex-row min-h-screen bg-slate-950 text-slate-200">
        {/* Left Pane: Business Context */}
        <div className="w-full xl:w-[480px] p-8 md:p-12 xl:p-16 flex flex-col border-b xl:border-b-0 xl:border-r border-white/10 bg-slate-950 z-20 shadow-2xl xl:h-screen xl:overflow-y-auto">
           <Link href="/demo-lab" className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Volver al Hub
           </Link>
           <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
             {isPolygon ? 'Polygon Ownership Layer' : isIota ? 'IOTA Proof Layer' : isOffline ? 'Offline Field Scan' : 'Experiencia de Producto'}
           </h1>
           <p className="text-base text-slate-400 mb-10 leading-relaxed">
             {isPolygon 
                ? 'Gemelos digitales y propiedad tokenizada para productos premium. Esta capa registra la transferencia de propiedad en Polygon.' 
                : isIota 
                ? 'Auditoría logística inmutable. Cada lectura se hashea y se registra en la tangle de IOTA para asegurar la cadena de custodia.' 
                : isOffline 
                ? 'Verificación criptográfica sin conectividad a internet. Ideal para galpones, campo e industria. Los dispositivos sincronizan al recuperar conexión.' 
                : 'Explora el flujo end-to-end de nexID. Validá la autenticidad, trazabilidad y experiencia del consumidor en un solo tap.'}
           </p>
           
           <div className="space-y-6 flex-1">
             <div className="p-5 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
               <div className="flex items-center gap-3 mb-3">
                 <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Fingerprint className="w-5 h-5" /></div>
                 <h3 className="font-bold text-white text-lg">Contexto Técnico</h3>
               </div>
               <p className="text-sm text-slate-400 leading-relaxed">
                 Interactuá con el simulador interactivo a la derecha. Cambiá el estado del producto (Toque Válido, Copia, Apertura) y observá cómo el motor de validación SUN ajusta las alertas criptográficas en tiempo real.
               </p>
             </div>
             
             <div className="p-5 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
               <div className="flex items-center gap-3 mb-3">
                 <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><ShieldCheck className="w-5 h-5" /></div>
                 <h3 className="font-bold text-white text-lg">Valor de Negocio</h3>
               </div>
               <p className="text-sm text-slate-400 leading-relaxed">
                 Protegé tu marca del mercado gris, asegurá la procedencia de tus productos y conectá directamente con tu cliente final sin fricciones ni intermediarios.
               </p>
             </div>
             
             <div className="pt-6">
                <Link href="/docs" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
                  <ArrowRight className="w-4 h-4" /> Leer documentación técnica
                </Link>
             </div>
           </div>
        </div>
        
        {/* Right Pane: Interactive Simulator */}
        <div className="flex-1 relative bg-[#050505] xl:h-screen xl:overflow-y-auto">
          {/* Decorative gradients */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] mix-blend-screen" />
            <div className="absolute bottom-[10%] right-[20%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px] mix-blend-screen" />
          </div>
          <div className="relative z-10 w-full h-full flex flex-col justify-start">
             <DemoLabClient locale={locale} initialVertical={initialVertical} initialScenario={initialScenario} />
          </div>
        </div>
      </div>
    );
  }

  // Render the Bento Hub UI for the root /demo-lab
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans relative flex items-center justify-center overflow-hidden selection:bg-brand-500/30">
      {/* Animated Gradients Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[10%] right-[20%] w-[600px] h-[600px] bg-brand-500/20 rounded-full blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[100px] mix-blend-screen" />
      </div>

      <div className="relative z-10 w-full max-w-3xl mx-auto p-6 md:p-12">
        <div className="text-center mb-12">
           <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md mb-6 shadow-2xl relative">
              <div className="absolute inset-0 bg-brand-500/20 rounded-2xl blur-md" />
              <Fingerprint className="w-8 h-8 text-brand-300 relative z-10" />
           </div>
           <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
             nexID <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-blue-500">Demo Lab</span>
           </h1>
           <p className="text-lg text-neutral-400 max-w-xl mx-auto">Seleccioná un caso de uso o capa de confianza para simular la experiencia interactiva end-to-end.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Polygon Button */}
           <Link href="/demo-lab?scenario=polygon-ownership" className="group relative w-full p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-brand-500/50 backdrop-blur-md transition-all duration-300 overflow-hidden hover:shadow-lg hover:shadow-brand-500/10">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-brand-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Box className="w-6 h-6 text-brand-300" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-white group-hover:text-brand-100 transition-colors mb-1">Polygon Ownership</h3>
                   <p className="text-sm text-neutral-400 leading-relaxed">Gemelos digitales Web3 y transferencia de propiedad para productos de lujo.</p>
                </div>
              </div>
           </Link>

           {/* IOTA Button */}
           <Link href="/demo-lab?scenario=iota-proof" className="group relative w-full p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-emerald-500/50 backdrop-blur-md transition-all duration-300 overflow-hidden hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Network className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-white group-hover:text-emerald-100 transition-colors mb-1">IOTA Proof</h3>
                   <p className="text-sm text-neutral-400 leading-relaxed">Registro inmutable de auditoría logística (Chain of Custody) usando DLT rápida.</p>
                </div>
              </div>
           </Link>

           {/* Offline Button */}
           <Link href="/demo-lab?scenario=offline-verifier" className="group relative w-full p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-blue-500/50 backdrop-blur-md transition-all duration-300 overflow-hidden hover:shadow-lg hover:shadow-blue-500/10">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-400 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <ShieldCheck className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-white group-hover:text-blue-100 transition-colors mb-1">Offline Verifier</h3>
                   <p className="text-sm text-neutral-400 leading-relaxed">Validación criptográfica local para operaciones en galpón y campo sin internet.</p>
                </div>
              </div>
           </Link>

           {/* QR / Core Demo */}
           <Link href="/demo-lab?scenario=qr-gs1" className="group relative w-full p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-orange-500/50 backdrop-blur-md transition-all duration-300 overflow-hidden hover:shadow-lg hover:shadow-orange-500/10">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-400 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Smartphone className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-white group-hover:text-orange-100 transition-colors mb-1">Core Experience</h3>
                   <p className="text-sm text-neutral-400 leading-relaxed">Flujo completo de producto: origen, tap, validación y portal de fidelización.</p>
                </div>
              </div>
           </Link>
        </div>
        
        <div className="mt-12 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver a nexID
          </Link>
        </div>
      </div>
    </div>
  );
}
