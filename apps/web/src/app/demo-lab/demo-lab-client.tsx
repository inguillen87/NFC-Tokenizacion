"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "ceo" | "operator" | "buyer";
type Beat = 0 | 1 | 2 | 3;
type DemoMode = "consumer_tap" | "consumer_tamper" | "consumer_opened" | "consumer_duplicate";

const beatToMode: Record<Beat, DemoMode> = {
  0: "consumer_tap",
  1: "consumer_tap",
  2: "consumer_duplicate",
  3: "consumer_opened",
};

const beatTitles = [
  "1) Product value",
  "2) Authentic scan",
  "3) Risk event",
  "4) Ownership / warranty / provenance / tokenization",
];

const roleCopy: Record<Role, { title: string; focus: string; cta: string }> = {
  ceo: {
    title: "CEO / Investor",
    focus: "Escalabilidad, revenue mix, mitigación de riesgo y expansión comercial.",
    cta: "Solicitar reunión de rollout enterprise",
  },
  operator: {
    title: "Operator",
    focus: "Batch onboarding, manifest, activación y trazabilidad operativa con evidencia.",
    cta: "Abrir flujo supplier /batches",
  },
  buyer: {
    title: "Buyer / Client",
    focus: "Confianza, autenticidad visible, UX premium y postventa.",
    cta: "Activar ownership y garantía",
  },
};

const feedByBeat: Record<Beat, string[]> = {
  0: ["Batch DEMO-2026-02 listo para piloto.", "Tag profile secure cargado.", "Route map inicializado."],
  1: ["SUN scan validado.", "Autenticidad confirmada para UID.", "Consumer trust score sube."],
  2: ["Replay/tamper signal detectado.", "Riesgo marcado para revisión.", "Equipo de operaciones notificado."],
  3: ["Ownership claim registrado.", "Warranty activada.", "Tokenization optional lead creado."],
};

const kpisByRole: Record<Role, Array<{ label: string; value: string }>> = {
  ceo: [
    { label: "Pipeline", value: "Qualified" },
    { label: "Risk control", value: "Active" },
    { label: "Expansion", value: "LATAM-ready" },
  ],
  operator: [
    { label: "Imported tags", value: "10 / 10" },
    { label: "Active tags", value: "10" },
    { label: "SUN status", value: "VALID" },
  ],
  buyer: [
    { label: "Authenticity", value: "Verified" },
    { label: "Warranty", value: "Available" },
    { label: "Ownership", value: "Claimable" },
  ],
};

export function DemoLabClient() {
  const [role, setRole] = useState<Role>("ceo");
  const [beat, setBeat] = useState<Beat>(0);
  const [running, setRunning] = useState<false | "30" | "90">(false);

  useEffect(() => {
    if (!running) return;
    const perBeatMs = running === "30" ? 7500 : 22500;
    const timer = window.setInterval(() => {
      setBeat((current) => (current >= 3 ? 0 : ((current + 1) as Beat)));
    }, perBeatMs);
    return () => window.clearInterval(timer);
  }, [running]);

  const activeCopy = roleCopy[role];
  const kpis = kpisByRole[role];
  const mobileMode = beatToMode[beat];
  const mobileUrl = useMemo(
    () => `/demo-lab/mobile/demobodega/demo-item-001?pack=wine-secure&locale=es-AR&demoMode=${mobileMode}&bid=DEMO-2026-02`,
    [mobileMode],
  );

  return (
    <main className="container-shell py-8 text-slate-100">
      <section className="rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(14,165,233,.14),transparent_40%),#020617] p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Public Demo Lab</p>
          <div className="flex flex-wrap gap-2">
            <a href="/" className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white">← Volver al landing</a>
            <a href="/login" className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">Login (roles)</a>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["ceo", "operator", "buyer"] as Role[]).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setRole(entry)}
              className={`rounded-full border px-3 py-1 text-xs ${role === entry ? "border-cyan-300/50 bg-cyan-500/15 text-cyan-100" : "border-white/20 bg-white/5 text-slate-300"}`}
            >
              {roleCopy[entry].title}
            </button>
          ))}
          <button type="button" onClick={() => setRunning("30")} className="rounded-full border border-violet-300/40 bg-violet-500/10 px-3 py-1 text-xs text-violet-100">Start cinematic 30s</button>
          <button type="button" onClick={() => setRunning("90")} className="rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">Start cinematic 90s</button>
          <button type="button" onClick={() => setRunning(false)} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white">Stop</button>
        </div>

        <h1 className="mt-4 text-2xl font-semibold">Demo Lab narrative engine</h1>
        <p className="mt-1 text-sm text-slate-300">{activeCopy.focus}</p>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {beatTitles.map((title, index) => (
            <button
              type="button"
              key={title}
              onClick={() => setBeat(index as Beat)}
              className={`rounded-lg border px-3 py-2 text-left text-xs ${beat === index ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-950/60 text-slate-300"}`}
            >
              {title}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Live feed</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              {feedByBeat[beat].map((item) => <li key={item}>• {item}</li>)}
            </ul>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-slate-400">{kpi.label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-violet-300/25 bg-violet-500/10 p-3 text-xs text-violet-100">
              Recommended CTA: {activeCopy.cta}
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Mobile preview synced to beat</p>
            <iframe title="demo mobile preview" src={mobileUrl} className="mt-3 h-[620px] w-full rounded-xl border border-white/10 bg-slate-950" />
          </article>
        </div>
      </section>
    </main>
  );
}
