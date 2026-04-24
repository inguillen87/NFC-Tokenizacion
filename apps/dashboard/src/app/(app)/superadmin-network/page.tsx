export default function SuperadminConsumerNetworkPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Global Consumer Network</h1>
          <p className="mt-1 text-sm text-slate-400">Visión portfolio de la adopción B2C, métricas agregadas y cruces de marketplace.</p>
        </div>
        <div className="flex items-center gap-3">
           <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors">Exportar Reporte</button>
           <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors">Configurar Settlement</button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total B2C Users</p>
          <p className="mt-2 text-3xl font-bold text-white">84.2k</p>
          <p className="mt-1 text-[10px] text-emerald-400">+5.4k (Últimos 30d)</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Marcas Opt-In</p>
          <p className="mt-2 text-3xl font-bold text-white">42</p>
          <p className="mt-1 text-[10px] text-slate-500">12 pendientes de onboarding</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Tap a Registro</p>
          <p className="mt-2 text-3xl font-bold text-cyan-400">18.5%</p>
          <p className="mt-1 text-[10px] text-slate-500">Promedio Global</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Marketplace Intents</p>
          <p className="mt-2 text-3xl font-bold text-violet-400">1,240</p>
          <p className="mt-1 text-[10px] text-slate-500">Order Requests generadas</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">GMV Proxy</p>
          <p className="mt-2 text-3xl font-bold text-white">$145k</p>
          <p className="mt-1 text-[10px] text-slate-500">Volumen canalizado USD</p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
         {/* Tenant Leaderboard */}
         <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
               <h3 className="text-sm font-bold text-white">Adopción por Tenant</h3>
               <span className="text-xs font-medium text-cyan-400 cursor-pointer hover:text-cyan-300">Ver listado completo</span>
            </div>
            <table className="w-full text-left text-sm text-slate-300">
               <thead className="bg-slate-800/30 text-[10px] uppercase tracking-widest text-slate-500">
                  <tr>
                     <th className="px-5 py-3 font-medium">Marca (Tenant)</th>
                     <th className="px-5 py-3 font-medium text-right">Usuarios Registrados</th>
                     <th className="px-5 py-3 font-medium text-right">Tasa Conversión</th>
                     <th className="px-5 py-3 font-medium text-right">Marketplace Offers</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  <tr className="hover:bg-white/5">
                     <td className="px-5 py-3 font-bold text-white">Demo Bodega (Mendoza)</td>
                     <td className="px-5 py-3 text-right">2,358</td>
                     <td className="px-5 py-3 text-right text-emerald-400">22%</td>
                     <td className="px-5 py-3 text-right">4 Activas</td>
                  </tr>
                  <tr className="hover:bg-white/5">
                     <td className="px-5 py-3 font-bold text-white">Bodega Finca Sur</td>
                     <td className="px-5 py-3 text-right">1,842</td>
                     <td className="px-5 py-3 text-right text-emerald-400">19%</td>
                     <td className="px-5 py-3 text-right">2 Activas</td>
                  </tr>
                  <tr className="hover:bg-white/5">
                     <td className="px-5 py-3 font-bold text-white">Le Parfum (Latam)</td>
                     <td className="px-5 py-3 text-right">1,105</td>
                     <td className="px-5 py-3 text-right text-amber-400">14%</td>
                     <td className="px-5 py-3 text-right text-slate-500">Opt-out</td>
                  </tr>
               </tbody>
            </table>
         </div>

         {/* BotIA Global Insights */}
         <div className="rounded-xl border border-cyan-500/30 bg-slate-950/80 backdrop-blur shadow-[0_0_30px_rgba(6,182,212,0.1)] flex flex-col h-[400px]">
            <div className="p-4 border-b border-white/10 bg-slate-900/50 flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">🤖</div>
               <div>
                  <h3 className="text-sm font-bold text-white">Portfolio Insights</h3>
                  <p className="text-[10px] text-cyan-300">NexID Network AI</p>
               </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 text-sm">
               <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-slate-300 rounded-bl-none ml-2 mr-6">
                  El vertical <b>Perfumes</b> está creciendo un 35% MoM en Brasil, pero la adopción del Marketplace es baja. Sugiero contactar al Reseller regional para incentivar la publicación de Drops cruzados.
               </div>
            </div>

            <div className="p-3 border-t border-white/10 bg-slate-900/50">
               <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded transition">Generar Resumen Ejecutivo</button>
            </div>
         </div>
      </div>
    </div>
  );
}
