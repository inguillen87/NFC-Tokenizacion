export default function ExperiencesPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Experiencias y Eventos</h1>
          <p className="mt-1 text-sm text-slate-400">Gestioná visitas, catas, masterclasses y la capacidad de reservas para tus miembros.</p>
        </div>
        <button suppressHydrationWarning className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors">
          + Nueva Experiencia
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
         {/* Experience Card 1 */}
         <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden flex flex-col">
            <div className="h-40 bg-slate-800 relative p-5 flex flex-col justify-between">
               <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 rounded bg-black/50 backdrop-blur text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">VISITA A BODEGA</span>
                  <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 font-bold">14</span>
               </div>
               <div>
                  <h3 className="text-xl font-bold text-white">Tour & Degustación Premium</h3>
                  <p className="text-xs text-indigo-300 font-medium">Sábados · 11:00 AM</p>
               </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
               <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Capacidad</span>
                  <span className="font-bold text-white">14 / 20 Reservados</span>
               </div>
               <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-indigo-500 w-[70%] rounded-full"></div>
               </div>

               <p className="text-xs text-slate-400 mb-4 line-clamp-2">Recorrido por los viñedos y cata guiada de 4 copas línea Reserva en nuestra cava subterránea.</p>

               <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Check-ins: 0</span>
                  <button suppressHydrationWarning className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">Ver Reservas →</button>
               </div>
            </div>
         </div>

         {/* Experience Card 2 */}
         <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden flex flex-col opacity-75">
            <div className="h-40 bg-slate-800 relative p-5 flex flex-col justify-between">
               <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 rounded bg-black/50 backdrop-blur text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">EVENTO EXCLUSIVO</span>
                  <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 font-bold">50</span>
               </div>
               <div>
                  <h3 className="text-xl font-bold text-white">Sunset Session Vendimia</h3>
                  <p className="text-xs text-emerald-300 font-medium">15 Marzo · 18:00 PM</p>
               </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
               <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Capacidad</span>
                  <span className="font-bold text-white">50 / 50 Reservados</span>
               </div>
               <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-emerald-500 w-full rounded-full"></div>
               </div>

               <p className="text-xs text-slate-400 mb-4 line-clamp-2">Evento de cierre de cosecha con DJs en vivo, food trucks y barra premium. Solo nivel Coleccionista.</p>

               <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">SOLD OUT</span>
                  <button suppressHydrationWarning className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">Ver Reservas →</button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
