import { asArray, fetchConsumerPath } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Tap = { at?: string; city?: string; country?: string; result?: string; product_name?: string; bid?: string; };

export default async function TapsTimelinePage() {
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
             const result = String(tap.result || "VALID").toUpperCase();
             const isReplay = result.includes("REPLAY") || result.includes("BLOCK");
             const isTamper = result.includes("TAMPER") || result.includes("BROKEN") || result.includes("REVOKE");

             let icon = "✓";
             let colorClass = "emerald";
             let label = "AUTÉNTICO";
             let desc = "Producto verificado de forma segura.";

             if (isReplay) {
                icon = "⚠️";
                colorClass = "amber";
                label = "REPLAY SUSPECT";
                desc = "Este link fue escaneado múltiples veces. No suma puntos de Loyalty.";
             } else if (isTamper) {
                icon = "❌";
                colorClass = "red";
                label = "TAMPERED";
                desc = "Alerta de seguridad: el sello físico parece comprometido o revocado.";
             }

             return (
               <div key={`tap-${idx}`} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${idx === 0 ? "is-active" : ""}`}>
                 <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0a0a0c] bg-${colorClass}-500/20 text-${colorClass}-400 shadow-[0_0_15px_rgba(var(--color-${colorClass}-500),0.3)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10`}>
                    <span className="text-xs">{icon}</span>
                 </div>

                 <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-${colorClass}-500/20 bg-slate-900/60 backdrop-blur-sm shadow-xl group-hover:border-${colorClass}-500/40 transition-colors`}>
                    <div className="flex items-center justify-between mb-1">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{tap.bid || "NEXID Network"}</span>
                       <span className="text-[10px] font-mono text-slate-400">{tap.at ? new Date(tap.at).toLocaleString() : "Reciente"}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{tap.product_name || "Producto Conectado"}</h3>
                    <p className="text-xs text-slate-400 mt-1">{tap.city || "Ciudad Desconocida"}, {tap.country || "País Desconocido"}</p>
                    <div className="mt-3 flex flex-col gap-2">
                       <div className="flex gap-2">
                          <span className={`inline-flex px-2 py-0.5 rounded bg-${colorClass}-500/10 text-${colorClass}-400 border border-${colorClass}-500/20 text-[10px] font-bold uppercase`}>{label}</span>
                          {!isReplay && !isTamper && <span className="inline-flex px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold">+10 Pts</span>}
                       </div>
                       { (isReplay || isTamper) && <p className={`text-[10px] text-${colorClass}-200/70`}>{desc}</p> }
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
