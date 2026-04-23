export default function RewardsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Catálogo de Beneficios</h1>
          <p className="mt-1 text-sm text-slate-400">Gestioná los premios, experiencias y descuentos disponibles para tus usuarios.</p>
        </div>
        <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors">
          + Nuevo Beneficio
        </button>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         {/* Reward Card 1 */}
         <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden flex flex-col group">
            <div className="h-32 bg-slate-800 flex items-center justify-center text-4xl relative">
               🎟️
               <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 rounded uppercase tracking-widest">
                  ACTIVO
               </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">EXPERIENCIA</p>
               <h3 className="text-base font-bold text-white leading-tight">Degustación Premium 2x1</h3>
               <p className="text-xs text-slate-400 mt-2 line-clamp-2">Visitá la bodega y disfrutá un upgrade en tu degustación de la línea Reserva.</p>

               <div className="mt-auto pt-4 flex items-center justify-between">
                  <div>
                     <p className="text-sm font-bold text-white">300 pts</p>
                     <p className="text-[10px] text-slate-500">Stock: Ilimitado</p>
                  </div>
                  <button className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">Editar</button>
               </div>
            </div>
         </div>

         {/* Reward Card 2 */}
         <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden flex flex-col group">
            <div className="h-32 bg-slate-800 flex items-center justify-center text-4xl relative">
               📦
               <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-400 rounded uppercase tracking-widest">
                  POCO STOCK
               </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">PRODUCTO FÍSICO</p>
               <h3 className="text-base font-bold text-white leading-tight">Caja Mix 6 Botellas Edición Limitada</h3>
               <p className="text-xs text-slate-400 mt-2 line-clamp-2">Selección especial del enólogo. Envío incluido a nivel nacional.</p>

               <div className="mt-auto pt-4 flex items-center justify-between">
                  <div>
                     <p className="text-sm font-bold text-white">1200 pts</p>
                     <p className="text-[10px] text-amber-400">Stock: 12 unidades</p>
                  </div>
                  <button className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">Editar</button>
               </div>
            </div>
         </div>

         {/* Reward Card 3 */}
         <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden flex flex-col group opacity-60 grayscale-[50%]">
            <div className="h-32 bg-slate-800 flex items-center justify-center text-4xl relative">
               🍷
               <div className="absolute top-2 right-2 px-2 py-0.5 bg-slate-500/20 border border-slate-500/30 text-[10px] font-bold text-slate-400 rounded uppercase tracking-widest">
                  PAUSADO
               </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">PRODUCTO FÍSICO</p>
               <h3 className="text-base font-bold text-white leading-tight">Botella Magnum 1.5L</h3>
               <p className="text-xs text-slate-400 mt-2 line-clamp-2">Formato especial ideal para guarda. Solo para nivel Embajador.</p>

               <div className="mt-auto pt-4 flex items-center justify-between">
                  <div>
                     <p className="text-sm font-bold text-white">2500 pts</p>
                     <p className="text-[10px] text-slate-500">Stock: 0 unidades</p>
                  </div>
                  <button className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">Editar</button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
