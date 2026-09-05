"use client";

import { useState } from "react";
import { buildDemoTapTimeline } from "../lib/consumer-network-demo-timeline";
import {
  formatUtcTimestamp,
  type ConsumerNetworkMember,
  type ConsumerNetworkProduct,
  type ConsumerNetworkTap,
} from "../lib/consumer-network-overview-truth";

export function ConsumerNetworkDemoSummary({ taps, members, products, tenantSlug }: {
  taps: ConsumerNetworkTap[];
  members: ConsumerNetworkMember[];
  products: ConsumerNetworkProduct[];
  tenantSlug: string;
}) {
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const { records, hours, maxCount } = buildDemoTapTimeline(taps, tenantSlug);
  const profiles = members.filter((row) => row.dataProvenance === "declared_demo" && row.tenantSlug === tenantSlug);
  const examples = products.filter((row) => row.dataProvenance === "declared_demo" && row.tenantSlug === tenantSlug);
  const selected = selectedHour === null ? records : records.filter((tap) => new Date(tap.createdAt).getUTCHours() === selectedHour);

  return (
    <section aria-labelledby="demo-crm-title" data-testid="consumer-network-demo-summary" className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-50 via-white to-violet-100 p-5 text-slate-900 dark:from-cyan-950 dark:via-slate-950 dark:to-violet-950 dark:text-slate-100 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-800 dark:text-teal-200">Demostración interactiva · datos ficticios</p>
          <h2 id="demo-crm-title" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Así se explora la actividad de una marca</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Probá el mapa horario y consultá los ejemplos. Este recorrido no recibe los tags físicos de Balmec ni representa clientes o resultados reales.</p>
        </div>
        <a href="#miembros" className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white outline-offset-4 hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500">Explorar perfiles de ejemplo ↓</a>
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Lecturas ilustrativas", records.length, "Eventos de muestra, no taps físicos."],
          ["Perfiles ficticios", profiles.length, "Ejemplos para conocer el CRM."],
          ["Productos de ejemplo", examples.length, "Catálogo del escenario simulado."],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-cyan-600/20 bg-white/70 p-4 dark:bg-slate-900/70">
            <dt className="text-sm font-bold">{label}</dt>
            <dd className="mt-1 text-3xl font-black text-teal-800 dark:text-teal-200">{value}</dd>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{hint}</p>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">¿En qué horarios se concentra la actividad de ejemplo?</h3>
        <button type="button" onClick={() => setSelectedHour(null)} disabled={selectedHour === null} className="rounded-lg border border-teal-600/30 px-3 py-2 text-sm font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500">Ver todas las horas</button>
      </div>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Seleccioná una hora. Un color más intenso indica más lecturas ilustrativas; no indica riesgo ni ubicación geográfica.</p>
      <div aria-label="Horas de la actividad ilustrativa, UTC" className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-12">
        {hours.map(({ hour, count }) => (
          <button key={hour} type="button" aria-pressed={selectedHour === hour} aria-label={`${String(hour).padStart(2, "0")}:00 UTC: ${count} lecturas ilustrativas`} onClick={() => setSelectedHour(hour)}
            className={`min-h-14 rounded-lg border border-teal-600/25 px-1 py-2 text-slate-900 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 dark:text-white ${selectedHour === hour ? "ring-2 ring-teal-600 dark:ring-teal-300" : "hover:ring-1 hover:ring-teal-500"}`}
            style={{ backgroundColor: `rgba(20, 184, 166, ${0.06 + (count / maxCount) * 0.38})` }}>
            <span className="block text-[11px]">{String(hour).padStart(2, "0")}h</span><span className="block text-sm font-black">{count}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-teal-600/20 bg-white/70 p-4 dark:bg-slate-900/70">
        <p role="status" className="text-sm font-bold">{selectedHour === null ? "Todas las horas" : `${String(selectedHour).padStart(2, "0")}:00–${String(selectedHour).padStart(2, "0")}:59 UTC`} · {selected.length} lecturas ilustrativas</p>
        {selected.length ? <ul className="mt-2 grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">{selected.map((tap) => <li key={tap.eventId}>{formatUtcTimestamp(tap.createdAt)} · Ejemplo simulado</li>)}</ul> : <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No hay ejemplos en esta hora. Elegí otra o volvé a ver todas.</p>}
      </div>
    </section>
  );
}
