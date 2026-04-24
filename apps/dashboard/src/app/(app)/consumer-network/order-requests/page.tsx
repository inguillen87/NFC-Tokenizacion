export default function OrderRequestsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Order Requests (Marketplace)</h1>
          <p className="mt-1 text-sm text-slate-400">Solicitudes de compra generadas desde la red de consumidores y el marketplace.</p>
        </div>
        <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors">
          Exportar CSV
        </button>
      </header>

      <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
         <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-white/10 bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400">
               <tr>
                  <th className="px-4 py-3 font-medium">Pipeline</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Consumidor</th>
                  <th className="px-4 py-3 font-medium">Mensaje</th>
                  <th className="px-4 py-3 font-medium text-right">Fecha</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
               <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                     <span className="inline-flex px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">Nuevo Lead</span>
                  </td>
                  <td className="px-4 py-3">
                     <p className="font-bold text-white">Lote Experimental Malbec</p>
                     <p className="text-[10px] text-slate-500">Cantidad: 2</p>
                  </td>
                  <td className="px-4 py-3">
                     <p className="text-sm text-slate-300">Carlos Gómez</p>
                     <p className="text-[10px] text-slate-500">carlos.g@example.com</p>
                  </td>
                  <td className="px-4 py-3 text-xs italic text-slate-400">
                     "Me interesa comprar 2 botellas, ¿hacen envíos a Córdoba?"
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-slate-500">
                     Hoy, 10:15
                  </td>
               </tr>
               <tr className="hover:bg-white/5 transition-colors opacity-70">
                  <td className="px-4 py-3">
                     <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">Contactado</span>
                  </td>
                  <td className="px-4 py-3">
                     <p className="font-bold text-white">Caja Degustación Terroir</p>
                     <p className="text-[10px] text-slate-500">Cantidad: 1</p>
                  </td>
                  <td className="px-4 py-3">
                     <p className="text-sm text-slate-300">Lucía Fernández</p>
                     <p className="text-[10px] text-slate-500">lucia.f@example.com</p>
                  </td>
                  <td className="px-4 py-3 text-xs italic text-slate-400">
                     "Quisiera regalarla, ¿se puede agregar una nota?"
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-slate-500">
                     Ayer, 14:30
                  </td>
               </tr>
            </tbody>
         </table>
      </div>
    </div>
  );
}
