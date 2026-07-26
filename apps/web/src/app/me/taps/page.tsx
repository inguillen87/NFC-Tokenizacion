import { AlertTriangle, CheckCircle2, ShieldAlert, MapPin, HelpCircle } from "lucide-react";
import { asArray, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { formatPortalDate, type ConsumerTap } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";

const VALIDATED_NFC_RESULTS = new Set([
  "VALID",
  "TAP_VALID",
  "AUTH_OK",
  "VALID_CLOSED",
  "OPENED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_MANUAL_OPENED",
  "VALID_UNKNOWN_TAMPER",
]);

function isValidatedNfcResult(value?: string | null) {
  return VALIDATED_NFC_RESULTS.has(String(value || "").trim().toUpperCase());
}

function tapState(tap: ConsumerTap) {
  const verdict = String(tap.verdict || "UNKNOWN").toUpperCase();
  const isReplay = verdict.includes("REPLAY") || verdict.includes("BLOCK");
  const isTamper = verdict.includes("TAMPER") || verdict.includes("BROKEN") || verdict.includes("REVOKE");
  
  if (isTamper) return { 
    verdict, 
    Icon: ShieldAlert, 
    title: "Alerta TT / Tamper reportada",
    desc: "El evento reportó un estado TT/tamper o una revocación. Esa señal no demuestra por sí sola el estado físico del sello.",
    card: "border-rose-500/35 bg-rose-950/10 shadow-[0_0_20px_rgba(239,68,68,0.05)]", 
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    dot: "bg-rose-400 shadow-[0_0_12px_#f87171]" 
  };
  
  if (isReplay) return { 
    verdict, 
    Icon: AlertTriangle, 
    title: "Escaneo Replay Bloqueado", 
    desc: "Lectura duplicada o sospechosa. El mensaje no queda validado ni es elegible para claim.",
    card: "border-amber-500/35 bg-amber-950/10 shadow-[0_0_20px_rgba(245,158,11,0.05)]", 
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400 shadow-[0_0_12px_#fbbf24]" 
  };
  
  if (!isValidatedNfcResult(verdict)) return {
    verdict,
    Icon: AlertTriangle,
    title: "Mensaje NFC no validado",
    desc: "El backend no reportó una validación SUN/NFC positiva para este evento.",
    card: "border-slate-500/25 bg-slate-950/35",
    chip: "border-slate-500/30 bg-slate-500/10 text-slate-300",
    dot: "bg-slate-500",
  };

  return { 
    verdict, 
    Icon: CheckCircle2, 
    title: "Mensaje NFC / SUN validado",
    desc: "El backend validó el mensaje dinámico y sus controles configurados. No autentica por sí solo el producto físico, su contenido ni su procedencia.",
    card: "border-emerald-500/35 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.05)]", 
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400 shadow-[0_0_12px_#34d399]" 
  };
}

export default async function TapsTimelinePage() {
  await requireConsumerSession("/me/taps");
  const payload = await fetchConsumerPath("taps");
  const taps = asArray<ConsumerTap>(payload);
  const valid = taps.filter((tap) => isValidatedNfcResult(tap.verdict)).length;
  const blocked = taps.length - valid;

  return (
    <PortalShell
      title="Historial de Escaneos (Taps)"
      subtitle="Registro de eventos NFC/QR: muestra el resultado digital, la referencia real y la ubicación sólo cuando fue reportada. No prueba autenticidad física ni recorrido."
    >
      {/* Top Stats */}
      <section className="grid gap-3 grid-cols-3">
        {[
          ["Lecturas Totales", taps.length, "text-violet-400 border-white/5"],
          ["Mensajes Validados", valid, "text-emerald-400 border-emerald-500/15 bg-emerald-500/5"],
          ["Alertas / Bloqueos", blocked, blocked > 0 ? "text-rose-400 border-rose-500/15 bg-rose-500/5 animate-pulse" : "text-slate-400 border-white/5"],
        ].map(([label, value, customClass]) => (
          <article key={String(label)} className={`rounded-2xl border bg-slate-950/70 p-4 ${customClass}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-black text-white">{value}</p>
          </article>
        ))}
      </section>

      {/* Timeline Layout */}
      <div className="relative mx-auto max-w-4xl pt-4">
        
        {/* Central Vertical Connector Line */}
        {taps.length > 1 && (
          <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-emerald-500/35 via-violet-500/20 to-slate-800/10 hidden md:block" />
        )}

        {!taps.length ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/25 p-8 text-center text-slate-400">
            <HelpCircle className="mx-auto h-8 w-8 text-slate-600" />
            <h3 className="mt-3 text-sm font-black text-white">No hay registros de escaneos</h3>
            <p className="mt-1 text-xs text-slate-500">Tus escaneos de etiquetas seguras nexID con tu celular móvil se detallarán aquí.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {taps.map((tap, idx) => {
              const state = tapState(tap);
              const Icon = state.Icon;
              const eventReference = String(tap.tap_event_id || "").trim();
              const hasReportedLocation = Boolean(String(tap.city || "").trim() || String(tap.country || "").trim());
              const locationLabel = [tap.city, tap.country].filter(Boolean).join(", ");
              const messageValidated = isValidatedNfcResult(tap.verdict);
              const riskFactor = Number(tap.risk_level || 0);

              return (
                <div key={`tap-${tap.tap_event_id || idx}`} className="relative md:grid md:grid-cols-[60px_1fr] md:gap-4 items-start">
                  
                  {/* Timeline Glowing Node Badge (Visible only on md+) */}
                  <div className="hidden md:flex justify-center items-center mt-4">
                    <span className={`h-4.5 w-4.5 rounded-full ring-4 ring-slate-950 ${state.dot}`} />
                  </div>

                  {/* Card Container */}
                  <article className={`rounded-3xl border ${state.card} bg-slate-950/70 p-5 transition hover:border-white/15`}>
                    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                      
                      {/* Left: General info */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${state.chip}`}>
                            {state.verdict}
                          </span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            riskFactor > 60 
                              ? "border-rose-500/35 bg-rose-500/10 text-rose-300" 
                              : riskFactor > 20 
                              ? "border-amber-500/35 bg-amber-500/10 text-amber-300" 
                              : "border-white/10 bg-slate-900 text-slate-300"
                          }`}>
                            Risk Level: {riskFactor}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-black text-white leading-tight">
                          {state.title} <span className="font-mono text-slate-400 text-xs">{eventReference ? `#${eventReference}` : "Referencia no disponible"}</span>
                        </h3>
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">{state.desc}</p>
                        
                        {/* Evidence board: only fields returned by the event API */}
                        <div className="mt-4 rounded-xl border border-white/5 bg-black/60 p-3 font-mono text-[9px] text-slate-400 space-y-1.5 shadow-inner">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 uppercase">Event reference</span>
                            <span className="text-slate-300 select-all">{eventReference || "NO REPORTADA"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 uppercase">Fuente de ubicación</span>
                            <span className="text-slate-300 font-bold">{hasReportedLocation ? "EVENTO REPORTADO" : "NO REPORTADA"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 uppercase">Mensaje NFC / SUN</span>
                            <span className={messageValidated ? "text-emerald-400 font-bold" : "text-amber-300 font-bold"}>
                              {messageValidated ? "VALIDADO" : "NO VALIDADO"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Geolocative tag & Timestamp panel */}
                      <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-xs text-slate-400 flex flex-col justify-between min-h-36">
                        <div>
                          {hasReportedLocation ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-cyan-300" />
                                <strong className="text-white font-black">{locationLabel}</strong>
                              </div>
                              <p className="mt-2 text-[10px] text-slate-500">
                                Ubicación reportada por el evento. No demuestra una ruta física ni custodia.
                              </p>
                            </>
                          ) : (
                            <>
                              <strong className="text-slate-300 font-black">Ubicación no reportada</strong>
                              <p className="mt-2 text-[10px] text-slate-500">No se completa con coordenadas o ciudades de demostración.</p>
                            </>
                          )}
                        </div>
                        
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                          <div>
                            <span className="text-[8px] uppercase tracking-wider text-slate-500 block">Tenant</span>
                            <span className="font-bold text-slate-300 font-mono text-[10px]">{tap.tenant_slug || "n/a"}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] uppercase tracking-wider text-slate-500 block">Fecha/Hora</span>
                            <span className="text-slate-300 text-[10px]">{formatPortalDate(tap.created_at)}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </PortalShell>
  );
}
