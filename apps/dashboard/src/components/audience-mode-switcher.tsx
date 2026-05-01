"use client";

import { useAudienceMode } from "./audience-mode";

const AUDIENCE_COPY = {
  ceo: {
    label: "CEO / Investor",
    summary: "Ver negocio, escala, riesgo y monetización.",
    tone: "border-cyan-300/40 bg-cyan-500/10 text-cyan-100",
  },
  operator: {
    label: "Operator / Engineer",
    summary: "Ver operación, activación, eventos e integraciones.",
    tone: "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
  },
  buyer: {
    label: "Buyer / Client",
    summary: "Ver confianza, UX y valor final para el usuario.",
    tone: "border-violet-300/40 bg-violet-500/10 text-violet-100",
  },
} as const;

export function AudienceModeSwitcher() {
  const { mode, setMode } = useAudienceMode();
  const active = AUDIENCE_COPY[mode];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Global audience mode</p>
          <p className="mt-1 text-sm text-white">{active.label}</p>
          <p className="text-xs text-slate-400">{active.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(AUDIENCE_COPY).map(([key, item]) => (
            <button suppressHydrationWarning
              key={key}
              type="button"
              onClick={() => setMode(key as keyof typeof AUDIENCE_COPY)}
              className={`rounded-full border px-3 py-1 ${mode === key ? item.tone : "border-white/15 text-slate-300"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
