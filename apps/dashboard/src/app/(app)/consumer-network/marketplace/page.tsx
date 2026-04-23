export default function TenantMarketplacePage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Marketplace & Network</h1>
          <p className="mt-1 text-sm text-slate-400">Tus productos visibles en el NexID Consumer Network y configuración de compra cruzada.</p>
        </div>
        <button className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors">
          + Publicar Producto
        </button>
      </header>

      <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-6 flex items-start gap-4 backdrop-blur-md">
         <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <span className="text-xl">🌐</span>
         </div>
         <div>
            <h3 className="text-sm font-bold text-white">Estado de la Red: Activo</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">Has optado por participar en la red NexID. Tus productos marcados como públicos son visibles para consumidores verificados de otras marcas, expandiendo tu alcance comercial. No se comparten datos de tus clientes con terceros.</p>
         </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
         <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-white/10 bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400">
               <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Tipo / Vertical</th>
                  <th className="px-4 py-3 font-medium">Checkout</th>
                  <th className="px-4 py-3 font-medium">Visibilidad</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
               <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center border border-white/10">🍷</div>
                        <div>
                           <p className="font-bold text-white">Lote Experimental Malbec</p>
                           <p className="text-[10px] text-slate-500">$45,000 ARS</p>
                        </div>
                     </div>
                  </td>
                  <td className="px-4 py-3 text-xs">Vino Premium</td>
                  <td className="px-4 py-3">
                     <span className="inline-flex px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">Request to Buy</span>
                  </td>
                  <td className="px-4 py-3">
                     <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">Público (Network)</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                     <button className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">Editar</button>
                  </td>
               </tr>
               <tr className="hover:bg-white/5 transition-colors opacity-70">
                  <td className="px-4 py-3">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center border border-white/10">📦</div>
                        <div>
                           <p className="font-bold text-white">Caja Degustación Terroir</p>
                           <p className="text-[10px] text-slate-500">$120,000 ARS</p>
                        </div>
                     </div>
                  </td>
                  <td className="px-4 py-3 text-xs">Caja / Combo</td>
                  <td className="px-4 py-3">
                     <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">External URL</span>
                  </td>
                  <td className="px-4 py-3">
                     <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold">Oculto</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                     <button className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">Editar</button>
                  </td>
               </tr>
            </tbody>
         </table>
      </div>
    </div>
  );
}
