"use client";

import { useMemo, useState } from "react";

const revenueMix = [
  { label: "Hardware + encoding", value: 30 },
  { label: "Setup + rollout", value: 20 },
  { label: "SaaS dashboard", value: 24 },
  { label: "API + validation", value: 16 },
  { label: "Support + reseller", value: 10 },
];

const moatScores = [
  { label: "Infra", score: 82 },
  { label: "Data graph", score: 89 },
  { label: "Switching costs", score: 76 },
  { label: "Reseller leverage", score: 68 },
];

const roleViews = [
  { title: "CEO / Investor", copy: "Escalabilidad, revenue mix, expansión y próximos hitos comerciales." },
  { title: "Operator", copy: "Batch onboarding, manifest import, activation, /sun validation y evidencia operativa." },
  { title: "Buyer / Client", copy: "Confianza, autenticidad, UX premium, postventa y garantía." },
];

export function InvestorSnapshotClient() {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"whatsapp" | "mail">("whatsapp");

  const onePagerText = useMemo(() => {
    if (channel === "mail") {
      return `Asunto: nexID — infraestructura enterprise de identidad digital para productos físicos

nexID combina NFC + software + API para autenticación, anti-fraude, tamper y trazabilidad.
Monetiza hardware encodeado, setup/rollout, SaaS, API, soporte y reseller.
La capa blockchain/tokenization es opcional y solo para casos premium con ROI.`;
    }
    return `nexID = anti-fraud + traceability SaaS enterprise.
Entramos por dolor real (fraude, adulteración, QR insuficiente).
Upside opcional: ownership, warranty, provenance y tokenización premium.`;
  }, [channel]);

  return (
    <>
      <section className="mt-6 grid gap-3 md:grid-cols-3">
        {[
          { title: "Enterprise thesis", body: "No NFT hype. Core B2B: autenticidad, trazabilidad y operación multi-tenant." },
          { title: "Optional upside", body: "Ownership/provenance/warranty con blockchain-ready rails opcionales." },
          { title: "Commercial engine", body: "Quote-based pricing + reseller motion + rollout execution." },
        ].map((card) => (
          <article key={card.title} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold text-white">{card.title}</p>
            <p className="mt-2 text-xs text-slate-300">{card.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Revenue mix (model view)</p>
          <div className="mt-3 space-y-2">
            {revenueMix.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-200">
                  <span>{item.label}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="h-2 rounded bg-slate-900/70">
                  <div className="h-2 rounded bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">Moat maturity (internal score)</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {moatScores.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                <p className="text-[11px] text-slate-300">{item.label}</p>
                <p className="text-lg font-semibold text-white">{item.score}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-xl border border-violet-300/20 bg-violet-500/10 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-violet-200">Audience view model</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {roleViews.map((item) => (
            <article key={item.title} className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs text-slate-300">{item.copy}</p>
            </article>
          ))}
        </div>
        <button type="button" onClick={() => setOpen(true)} className="mt-4 rounded-lg border border-violet-300/35 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
          Open one-pager modal
        </button>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-sm font-semibold text-white">One-pager quick export</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setChannel("whatsapp")} className={`rounded px-3 py-1 text-xs ${channel === "whatsapp" ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5 text-slate-300"}`}>WhatsApp</button>
              <button type="button" onClick={() => setChannel("mail")} className={`rounded px-3 py-1 text-xs ${channel === "mail" ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5 text-slate-300"}`}>Mail</button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded border border-white/10 bg-slate-950/70 p-3 text-[11px] text-slate-200 whitespace-pre-wrap">{onePagerText}</pre>
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className="rounded border border-white/20 px-3 py-1 text-xs text-white">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
