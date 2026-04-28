"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_CANONICAL_BATCH_ID, DEMO_TENANT_SLUG, DEMO_WINE_ITEM_ID } from "@product/config";
import { WorldMapRealtime } from "@product/ui";

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
  0: [`Batch ${DEMO_CANONICAL_BATCH_ID} listo para piloto.`, "Tag profile secure cargado.", "Route map inicializado."],
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

const mapPointsByBeat: Record<Beat, Array<{ city: string; country: string; lat: number; lng: number; scans: number; risk: number; status: string; lastSeen: string }>> = {
  0: [
    { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458, scans: 3, risk: 0, status: "BATCH_READY", lastSeen: new Date().toISOString() },
    { city: "Córdoba", country: "Argentina", lat: -31.4201, lng: -64.1888, scans: 1, risk: 0, status: "DEMO_WINDOW", lastSeen: new Date().toISOString() },
  ],
  1: [
    { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458, scans: 8, risk: 0, status: "AUTH_OK", lastSeen: new Date().toISOString() },
    { city: "Miami", country: "USA", lat: 25.7617, lng: -80.1918, scans: 3, risk: 0, status: "EXPORT_SCAN", lastSeen: new Date().toISOString() },
  ],
  2: [
    { city: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333, scans: 2, risk: 2, status: "DUPLICATE_BLOCKED", lastSeen: new Date().toISOString() },
    { city: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332, scans: 2, risk: 1, status: "REPLAY_SIGNAL", lastSeen: new Date().toISOString() },
    { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458, scans: 5, risk: 0, status: "AUTH_OK", lastSeen: new Date().toISOString() },
  ],
  3: [
    { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458, scans: 5, risk: 0, status: "OWNERSHIP_CLAIMED", lastSeen: new Date().toISOString() },
    { city: "Bogotá", country: "Colombia", lat: 4.711, lng: -74.0721, scans: 2, risk: 0, status: "WARRANTY_ENABLED", lastSeen: new Date().toISOString() },
    { city: "Lima", country: "Peru", lat: -12.0464, lng: -77.0428, scans: 1, risk: 0, status: "TOKEN_LEAD", lastSeen: new Date().toISOString() },
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
    () => `/demo-lab/mobile/${DEMO_TENANT_SLUG}/${DEMO_WINE_ITEM_ID}?pack=wine-secure&locale=es-AR&demoMode=${mobileMode}&bid=${DEMO_CANONICAL_BATCH_ID}`,
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
            <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-500/10 p-3 text-xs text-amber-100">
              <p className="font-semibold">TagTamper demo lane</p>
              <p className="mt-1">1) Scan before opening · 2) Break/open loop · 3) Scan after opening · 4) Compare URLs · 5) Configure tamper parser offset/value mapping · 6) Re-open mobile preview and verify OPENED state.</p>
              <p className="mt-1 text-amber-200/90">If tamper cannot be detected: Current batch validates authenticity and replay protection, but does not expose electronic TagTamper status. Ask supplier to include TagTamper status in the SDM payload.</p>
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Mobile preview synced to beat</p>
            <iframe title="demo mobile preview" src={mobileUrl} className="mt-3 h-[620px] w-full rounded-xl border border-white/10 bg-slate-950" />
          </article>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/70 p-3">
          <WorldMapRealtime
            title="Demo Lab geo-ops map"
            subtitle="Mapa global dinámico por beat de narrativa (auth, risk, ownership)."
            points={mapPointsByBeat[beat]}
            initialExpanded={false}
          />
        </div>
      </section>
    </main>
  );
}
