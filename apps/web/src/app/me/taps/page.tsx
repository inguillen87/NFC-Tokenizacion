import { asArray, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Tap = { tap_event_id?: number; created_at?: string; city?: string; country?: string; verdict?: string; tenant_slug?: string; risk_level?: string };

export default async function TapsTimelinePage() {
  await requireConsumerSession("/me/taps");
  const payload = await fetchConsumerPath("taps");
  const taps = asArray<Tap>(payload);

  return (
    <PortalShell
      title="Historial de Taps"
      subtitle="La trazabilidad de todas tus interacciones físicas con productos de la red."
    >
      <div className="relative max-w-3xl mx-auto space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
         {!taps.length ? (
           <div className="relative p-5 text-sm text-center text-slate-400 bg-slate-900/60 rounded-xl border border-white/10 backdrop-blur-sm z-10">
              Aún no tienes historial de interacciones. Tus próximos taps autenticados aparecerán aquí.
           </div>
         ) : (
           taps.map((tap, idx) => {
             const verdict = String(tap.verdict || "VALID").toUpperCase();
             const isReplay = verdict.includes("REPLAY") || verdict.includes("BLOCK");
             const isTamper = verdict.includes("TAMPER") || verdict.includes("BROKEN") || verdict.includes("REVOKE");
             const icon = isTamper ? "❌" : isReplay ? "⚠️" : "✓";
             const palette = isTamper
               ? { bubble: "bg-red-500/20 text-red-400", card: "border-red-500/20", chip: "bg-red-500/10 text-red-300 border-red-500/20" }
               : isReplay
                 ? { bubble: "bg-amber-500/20 text-amber-300", card: "border-amber-500/20", chip: "bg-amber-500/10 text-amber-200 border-amber-500/20" }
                 : { bubble: "bg-emerald-500/20 text-emerald-300", card: "border-emerald-500/20", chip: "bg-emerald-500/10 text-emerald-200 border-emerald-500/20" };
             const desc = isTamper
               ? "Alerta de seguridad: sello comprometido/revocado."
               : isReplay
                 ? "Replay detectado: no claimable."
                 : "Tap válido y claimable.";

             return (
               <div key={`tap-${idx}`} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${idx === 0 ? "is-active" : ""}`}>
                 <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0a0a0c] ${palette.bubble} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10`}>
                    <span className="text-xs">{icon}</span>
                 </div>

                 <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border ${palette.card} bg-slate-900/60 backdrop-blur-sm shadow-xl transition-colors`}>
                    <div className="flex items-center justify-between mb-1">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{tap.tenant_slug || "NEXID Network"}</span>
                       <span className="text-[10px] font-mono text-slate-400">{tap.created_at ? new Date(tap.created_at).toLocaleString() : "Reciente"}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">Tap #{tap.tap_event_id || "n/a"}</h3>
                    <p className="text-xs text-slate-400 mt-1">{tap.city || "Ciudad Desconocida"}, {tap.country || "País Desconocido"}</p>
                    <div className="mt-3 flex flex-col gap-2">
                       <div className="flex gap-2">
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${palette.chip}`}>{verdict}</span>
                          <span className="inline-flex px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-bold">risk {String(tap.risk_level || "n/a")}</span>
                       </div>
                       <p className="text-[10px] text-slate-300">{desc}</p>
                    </div>
                 </div>
               </div>
             );
           })
         )}
      </div>
    </PortalShell>
  );
}
