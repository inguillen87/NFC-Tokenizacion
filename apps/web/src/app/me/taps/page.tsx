import { asArray, fetchConsumerPath } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Tap = { at?: string; city?: string; country?: string; result?: string; product_name?: string };

export default async function TapsPage() {
  const payload = await fetchConsumerPath("taps");
  const taps = asArray<Tap>(payload);

  return (
    <PortalShell title="Historial de taps" subtitle="Auditoría de autenticidad, replay/tamper detection y actividad reciente.">
      {!taps.length ? (
        <section className="rounded-xl border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-300">Sin eventos todavía. Tus próximos taps aparecerán acá con contexto de riesgo.</section>
      ) : (
        <section className="space-y-3">
          {taps.map((tap, idx) => {
            const risky = /(replay|tamper|risk)/i.test(String(tap.result || ""));
            return (
              <article key={`${tap.at || idx}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white">{tap.product_name || "Producto"}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${risky ? "border-rose-300/30 bg-rose-500/10 text-rose-100" : "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"}`}>{(tap.result || "verified").toString().toUpperCase()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{tap.at || "N/A"} · {tap.city || "-"}, {tap.country || "-"}</p>
              </article>
            );
          })}
        </section>
      )}
    </PortalShell>
  );
}
