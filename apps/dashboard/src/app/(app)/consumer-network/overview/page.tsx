export default function PortalUsuariosOverviewPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">Portal de Usuarios</h1>
        <p className="mt-1 text-sm text-slate-400">Métricas de adquisición, retención y conversión de la base de consumidores registrados.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Usuarios Registrados</p>
          <p className="mt-2 text-3xl font-bold text-white">2,358</p>
          <p className="mt-1 text-xs text-emerald-400">+12% este mes</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Tappers Anónimos</p>
          <p className="mt-2 text-3xl font-bold text-white">8,402</p>
          <p className="mt-1 text-xs text-slate-500">No completaron registro</p>
        </article>
        <article className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-cyan-400">Conversión a Lead</p>
          <p className="mt-2 text-3xl font-bold text-cyan-100">22%</p>
          <p className="mt-1 text-xs text-cyan-300">Tap → Cuenta Creada</p>
        </article>
        <article className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-violet-400">Tappers Recurrentes</p>
          <p className="mt-2 text-3xl font-bold text-violet-100">14%</p>
          <p className="mt-1 text-xs text-violet-300">Han escaneado &gt; 1 producto</p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
         {/* Top Users */}
         <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <h3 className="text-sm font-bold text-white mb-4">Últimos Miembros Activos</h3>
            <ul className="space-y-4">
               <li className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">MC</div>
                     <div>
                        <p className="text-sm font-medium text-white">Martina Costa</p>
                        <p className="text-xs text-slate-400">martina@example.com</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-sm font-bold text-emerald-400">1,200 pts</p>
                     <p className="text-[10px] text-slate-500">Nivel Embajador</p>
                  </div>
               </li>
               <li className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">JP</div>
                     <div>
                        <p className="text-sm font-medium text-white">Juan Pérez</p>
                        <p className="text-xs text-slate-400">juan.perez@example.com</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-sm font-bold text-emerald-400">450 pts</p>
                     <p className="text-[10px] text-slate-500">Nivel Explorador</p>
                  </div>
               </li>
            </ul>
            <button className="w-full mt-4 text-xs font-bold text-cyan-400 hover:text-cyan-300">Ver base completa →</button>
         </div>

         {/* Acquisition Funnel Chart Mock */}
         <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <h3 className="text-sm font-bold text-white mb-4">Adquisición por Producto (Top 3)</h3>
            <div className="space-y-5">
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300 font-medium">Gran Reserva Malbec 2022</span>
                     <span className="text-cyan-400 font-bold">450 altas</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-cyan-500 w-[80%]"></div>
                  </div>
               </div>
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300 font-medium">Línea Joven Cabernet</span>
                     <span className="text-cyan-400 font-bold">210 altas</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-cyan-500 w-[45%]"></div>
                  </div>
               </div>
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300 font-medium">Caja Mixta Terroir</span>
                     <span className="text-cyan-400 font-bold">85 altas</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-cyan-500 w-[15%]"></div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
