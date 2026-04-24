import { PortalShell } from "../_components/portal-shell";

export default function ConsumerExperiencesPage() {
  return (
    <PortalShell
      title="Mis Experiencias"
      subtitle="Tus reservas, visitas a bodegas y accesos VIP obtenidos a través de la red."
    >
      <div className="space-y-8">

         <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Próximos Eventos</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

               {/* Active Booking Card */}
               <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-5 relative overflow-hidden group backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                  <div className="flex justify-between items-start mb-4">
                     <span className="inline-block px-2 py-1 rounded bg-cyan-500/20 text-[10px] font-bold text-cyan-300 uppercase tracking-widest">RESERVADO</span>
                     <span className="text-2xl opacity-50">🍷</span>
                  </div>
                  <h3 className="text-lg font-bold text-white leading-tight">Degustación Premium 2x1</h3>
                  <p className="text-xs text-slate-300 mt-1">Demo Bodega · Mendoza, AR</p>

                  <div className="mt-4 pt-4 border-t border-cyan-500/20 space-y-2">
                     <div className="flex justify-between">
                        <span className="text-xs text-slate-400">Fecha</span>
                        <span className="text-xs font-bold text-white">15 Marzo, 2026</span>
                     </div>
                     <div className="flex justify-between">
                        <span className="text-xs text-slate-400">Hora</span>
                        <span className="text-xs font-bold text-white">11:00 AM</span>
                     </div>
                     <div className="flex justify-between">
                        <span className="text-xs text-slate-400">Código</span>
                        <span className="text-xs font-mono font-bold text-cyan-400">NXB-8492</span>
                     </div>
                  </div>
               </div>

            </div>
         </section>

         <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Historial de Asistencias</h2>
            <div className="rounded-xl border border-white/5 bg-slate-900/40 p-8 text-center text-slate-500">
               <p className="text-sm">Todavía no tenés asistencias registradas.</p>
               <p className="text-xs mt-1">Hacé check-in en tus experiencias para sumar puntos y desbloquear insignias especiales.</p>
            </div>
         </section>

      </div>
    </PortalShell>
  );
}
