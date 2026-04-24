import { PortalShell } from "../_components/portal-shell";

export default function TapsTimelinePage() {
  return (
    <PortalShell
      title="Historial de Taps"
      subtitle="La trazabilidad de todas tus interacciones físicas con productos de la red."
    >
      <div className="relative max-w-3xl mx-auto space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">

         {/* Tap 1 (Valid) */}
         <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            {/* Icon */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0a0a0c] bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
               <span className="text-xs">✓</span>
            </div>

            {/* Card */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-emerald-500/20 bg-slate-900/60 backdrop-blur-sm shadow-xl group-hover:border-emerald-500/40 transition-colors">
               <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Demo Bodega</span>
                  <span className="text-[10px] font-mono text-slate-400">Hace 2 horas</span>
               </div>
               <h3 className="text-sm font-bold text-white">Gran Reserva Malbec 2022</h3>
               <p className="text-xs text-slate-400 mt-1">Mendoza, Argentina (GPS Aproximado)</p>
               <div className="mt-3 flex gap-2">
                  <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">AUTÉNTICO</span>
                  <span className="inline-flex px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold">+10 Pts</span>
               </div>
            </div>
         </div>

         {/* Tap 2 (Replay Suspect) */}
         <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
            {/* Icon */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0a0a0c] bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
               <span className="text-xs">⚠️</span>
            </div>

            {/* Card */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-amber-500/20 bg-slate-900/60 backdrop-blur-sm shadow-xl group-hover:border-amber-500/40 transition-colors">
               <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Demo Perfume</span>
                  <span className="text-[10px] font-mono text-slate-400">Ayer, 14:30</span>
               </div>
               <h3 className="text-sm font-bold text-white">Le Parfum Absolu 50ml</h3>
               <p className="text-xs text-slate-400 mt-1">Buenos Aires, Argentina (IP Geolocation)</p>
               <div className="mt-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                     <span className="inline-flex px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase">REPLAY SUSPECT</span>
                  </div>
                  <p className="text-[10px] text-amber-200/70">Este link fue escaneado múltiples veces. No suma puntos.</p>
               </div>
            </div>
         </div>

         {/* Tap 3 (Tampered) */}
         <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
            {/* Icon */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0a0a0c] bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
               <span className="text-xs">❌</span>
            </div>

            {/* Card */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-red-500/20 bg-slate-900/60 backdrop-blur-sm shadow-xl group-hover:border-red-500/40 transition-colors">
               <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Demo Bodega</span>
                  <span className="text-[10px] font-mono text-slate-400">12 Feb, 2026</span>
               </div>
               <h3 className="text-sm font-bold text-white">Gran Reserva Malbec 2022</h3>
               <p className="text-xs text-slate-400 mt-1">Santiago, Chile (IP Geolocation)</p>
               <div className="mt-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                     <span className="inline-flex px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold uppercase">TAMPERED (ABIERT0)</span>
                  </div>
                  <p className="text-[10px] text-red-200/70">El sello de seguridad fue roto antes de este escaneo.</p>
               </div>
            </div>
         </div>

      </div>
    </PortalShell>
  );
}
