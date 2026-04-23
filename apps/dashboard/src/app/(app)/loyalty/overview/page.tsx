export default function LoyaltyOverviewPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">Loyalty Studio</h1>
        <p className="mt-1 text-sm text-slate-400">Rendimiento del programa, métricas de engagement y prevención de fraude.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Miembros</p>
          <p className="mt-2 text-3xl font-bold text-white">1,248</p>
          <p className="mt-1 text-xs text-emerald-400">+12% este mes</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Puntos Emitidos</p>
          <p className="mt-2 text-3xl font-bold text-white">45.2k</p>
          <p className="mt-1 text-xs text-slate-500">Valor contable estimado</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Canjes Realizados</p>
          <p className="mt-2 text-3xl font-bold text-white">312</p>
          <p className="mt-1 text-xs text-emerald-400">Tasa de conversión 25%</p>
        </article>
        <article className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-rose-400">Reclamos Sospechosos</p>
          <p className="mt-2 text-3xl font-bold text-rose-100">14</p>
          <p className="mt-1 text-xs text-rose-300">Revisión manual requerida</p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
         <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <h3 className="text-sm font-bold text-white mb-4">Top Beneficios Canjeados</h3>
            <ul className="space-y-4">
               <li className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div>
                     <p className="text-sm font-medium text-white">Upgrade de Degustación 2x1</p>
                     <p className="text-xs text-slate-400">Experiencia · 300 pts</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">145 canjes</span>
               </li>
               <li className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div>
                     <p className="text-sm font-medium text-white">Caja Mix 6 Botellas</p>
                     <p className="text-xs text-slate-400">Producto · 1200 pts</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">82 canjes</span>
               </li>
               <li className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div>
                     <p className="text-sm font-medium text-white">Envío Bonificado LATAM</p>
                     <p className="text-xs text-slate-400">Servicio · 500 pts</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">54 canjes</span>
               </li>
            </ul>
         </div>

         <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <h3 className="text-sm font-bold text-white mb-4">Funnel de Engagement</h3>
            <div className="space-y-6">
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Taps Válidos</span>
                     <span className="font-bold text-white">100% (5,240)</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-cyan-500 w-full"></div>
                  </div>
               </div>
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Enrolamiento (Portal)</span>
                     <span className="font-bold text-white">45% (2,358)</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500 w-[45%]"></div>
                  </div>
               </div>
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Canje de Beneficio</span>
                     <span className="font-bold text-white">12% (628)</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500 w-[12%]"></div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
