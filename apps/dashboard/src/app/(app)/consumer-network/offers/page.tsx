export default function TenantOffersPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ofertas & Drops</h1>
          <p className="mt-1 text-sm text-slate-400">Promociones exclusivas para usuarios de la red NexID y el Marketplace cruzado.</p>
        </div>
        <button className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold rounded-lg transition-colors">
          + Crear Oferta
        </button>
      </header>

      <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
         <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-white/10 bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400">
               <tr>
                  <th className="px-4 py-3 font-medium">Oferta</th>
                  <th className="px-4 py-3 font-medium">Segmento / Visibilidad</th>
                  <th className="px-4 py-3 font-medium">Vigencia</th>
                  <th className="px-4 py-3 font-medium">Conversión</th>
                  <th className="px-4 py-3 font-medium text-right">Estado</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
               <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                     <p className="font-bold text-white">20% Off Primera Compra</p>
                     <p className="text-[10px] text-slate-500">Descuento Externo (URL)</p>
                  </td>
                  <td className="px-4 py-3">
                     <span className="inline-flex px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold">Verified Tappers (Global)</span>
                  </td>
                  <td className="px-4 py-3 text-xs">Hasta 31/12/2026</td>
                  <td className="px-4 py-3">
                     <div className="flex items-center gap-2">
                        <span className="font-bold text-white">8%</span>
                        <span className="text-[10px] text-slate-500">(142 clicks)</span>
                     </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                     <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">Activa</span>
                  </td>
               </tr>
               <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                     <p className="font-bold text-white">Early Access Malbec 2026</p>
                     <p className="text-[10px] text-slate-500">Preventa (Request to Buy)</p>
                  </td>
                  <td className="px-4 py-3">
                     <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">Tenant Members Only</span>
                  </td>
                  <td className="px-4 py-3 text-xs">Agota Stock (50)</td>
                  <td className="px-4 py-3">
                     <div className="flex items-center gap-2">
                        <span className="font-bold text-white">45%</span>
                        <span className="text-[10px] text-slate-500">(18 ventas)</span>
                     </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                     <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">Activa</span>
                  </td>
               </tr>
            </tbody>
         </table>
      </div>
    </div>
  );
}
