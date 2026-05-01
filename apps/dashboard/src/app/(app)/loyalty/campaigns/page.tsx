export default function LoyaltyCampaignsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Growth Campaigns & BotIA</h1>
          <p className="mt-1 text-sm text-slate-400">Generá campañas impulsadas por IA para fidelizar a tu base de consumidores verificados.</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
         {/* Main Campaigns List */}
         <div className="space-y-4">
            <div className="flex items-center justify-between">
               <h2 className="text-lg font-bold text-white">Campañas Activas</h2>
               <button suppressHydrationWarning className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors">
                 + Nueva Campaña
               </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-5 group">
               <div className="flex justify-between items-start">
                  <div>
                     <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider mb-2">RUNNING</span>
                     <h3 className="text-base font-bold text-white">Vendimia Passport (Seasonal)</h3>
                     <p className="text-xs text-slate-400 mt-1 max-w-lg">Invita a usuarios que hayan escaneado en el último mes a completar un Quiz de Terroir a cambio de un Upgrade en su próxima degustación.</p>
                  </div>
                  <div className="text-right">
                     <p className="text-2xl font-bold text-white">18%</p>
                     <p className="text-[10px] text-slate-500">Conversión (Click → Reward)</p>
                  </div>
               </div>
               <div className="mt-4 pt-4 border-t border-white/5 flex gap-4 text-xs text-slate-400">
                  <span>Enviado: 1,200</span>
                  <span>Clicks: 450</span>
                  <span>Recompensas emitidas: 216</span>
               </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-5 group opacity-75">
               <div className="flex justify-between items-start">
                  <div>
                     <span className="inline-flex px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider mb-2">DRAFT</span>
                     <h3 className="text-base font-bold text-white">Turista Brasil (Localizado)</h3>
                     <p className="text-xs text-slate-400 mt-1 max-w-lg">Campaña generada por IA en Portugués. Segmentada a IPs de Brasil para incentivar la compra de cajas de vino con envío bonificado.</p>
                  </div>
                  <div className="text-right">
                     <p className="text-2xl font-bold text-white">-</p>
                     <p className="text-[10px] text-slate-500">Sin iniciar</p>
                  </div>
               </div>
               <div className="mt-4 pt-4 border-t border-white/5">
                  <button suppressHydrationWarning className="text-xs text-cyan-400 hover:text-cyan-300 font-bold">Activar Campaña →</button>
               </div>
            </div>
         </div>

         {/* BotIA Assistant Side Panel */}
         <div className="rounded-xl border border-cyan-500/30 bg-slate-950/80 backdrop-blur shadow-[0_0_30px_rgba(6,182,212,0.1)] flex flex-col h-[500px]">
            <div className="p-4 border-b border-white/10 bg-slate-900/50 flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">🤖</div>
               <div>
                  <h3 className="text-sm font-bold text-white">BotIA Growth Strategist</h3>
                  <p className="text-[10px] text-cyan-300">Asistente de Marketing</p>
               </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 text-sm">
               <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-slate-300 rounded-bl-none ml-2 mr-6">
                  ¡Hola! Analicé los datos de este mes. Tu tasa de retención cayó un 2%. ¿Querés que arme una campaña para reactivar a los usuarios que escanearon hace más de 30 días?
               </div>
            </div>

            <div className="p-3 border-t border-white/10 bg-slate-900/50">
               <div className="flex flex-wrap gap-2 mb-3">
                  <button suppressHydrationWarning className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] text-cyan-300 hover:bg-slate-700 transition">Armar campaña de reactivación</button>
                  <button suppressHydrationWarning className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] text-cyan-300 hover:bg-slate-700 transition">Generar quiz de terroir</button>
               </div>
               <input suppressHydrationWarning type="text" placeholder="Escribile a BotIA..." className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 transition-colors" />
            </div>
         </div>
      </div>
    </div>
  );
}
