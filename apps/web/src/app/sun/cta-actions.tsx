"use client";

import { useState } from "react";

type Props = { bid: string; uid: string };
type LeadIntent = "tokenization_optional";
type ProvenanceResponse = {
  ok?: boolean;
  reason?: string;
  ownership?: Record<string, unknown>;
  ledger?: Record<string, unknown>;
  timeline?: Array<{ stage?: string; status?: string; at?: string | null }>;
  commercial_signals?: Record<string, unknown>;
};

async function call(path: string, method: "POST" | "GET", payload: Record<string, unknown> | null) {
  const url = new URL(path, window.location.origin);
  if (method === "GET" && payload) {
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(payload || {}) : undefined,
  });
  return res.json().catch(() => ({ ok: false, reason: "invalid json" }));
}

export function CtaActions({ bid, uid }: Props) {
  const [status, setStatus] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);
  const [leadIntent, setLeadIntent] = useState<LeadIntent>("tokenization_optional");
  const [provenance, setProvenance] = useState<ProvenanceResponse | null>(null);

  const trigger = async (path: string, method: "POST" | "GET") => {
    setPending(true);
    const data = await call(path, method, { bid, uid });
    setStatus(JSON.stringify(data));
    if (method === "GET" && path.includes("provenance")) setProvenance(data as ProvenanceResponse);
    setPending(false);
  };

  async function saveTokenizationLead() {
    if (!leadEmail.trim()) return;
    setPending(true);
    setLeadSaved(false);
    const leadPayload = {
      name: "SUN visitor",
      email: leadEmail.trim(),
      source: "sun_validation_center",
      vertical: "premium",
      role: "buyer",
      message: `Tokenization optional CTA from SUN page [bid=${bid}] [uid=${uid}] [intent=${leadIntent}]`,
      notes: `commercial_signal=tokenization_optional | bid=${bid} | uid=${uid}`,
    };
    const lead = await call("/api/leads", "POST", leadPayload);
    const tokenization = await call("/api/public-cta/tokenize-request", "POST", {
      bid,
      uid,
      claim_source: "sun_cta_modal",
      ledger_status: "simulated",
      ledger_network: "not_selected",
    });
    setStatus(JSON.stringify({ lead, tokenization }));
    setPending(false);
    setLeadSaved(Boolean((lead as { ok?: boolean }).ok && (tokenization as { ok?: boolean }).ok));
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="grid gap-2 text-xs md:grid-cols-2">
        <button onClick={() => void trigger("/api/public-cta/claim-ownership", "POST")} className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-left text-cyan-100">✅ Activar ownership</button>
        <button onClick={() => void trigger("/api/public-cta/register-warranty", "POST")} className="rounded-xl border border-violet-300/40 bg-violet-500/10 px-3 py-2 text-left text-violet-100">🛡️ Registrar garantía</button>
        <button onClick={() => void trigger("/api/public-cta/provenance", "GET")} className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-left text-amber-100">📜 Ver provenance</button>
        <button
          onClick={() => {
            setLeadIntent("tokenization_optional");
            setShowTokenModal(true);
          }}
          className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-left text-emerald-100"
        >
          ✨ Tokenización opcional
        </button>
      </div>
      {pending ? <p className="text-xs text-cyan-200">Ejecutando acción...</p> : null}
      {provenance?.timeline?.length ? (
        <div className="rounded border border-white/10 bg-slate-950/50 p-2 text-[11px] text-slate-200">
          <p className="mb-1 text-cyan-100">Lifecycle timeline (enterprise)</p>
          <ul className="space-y-1">
            {provenance.timeline.map((item, index) => (
              <li key={`${String(item.stage || "stage")}-${index}`}>
                <span className="text-white">{String(item.stage || "-")}</span> · {String(item.status || "-")}
                {item.at ? ` · ${item.at}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {status ? <pre className="overflow-x-auto rounded border border-white/10 bg-slate-950/70 p-2 text-[11px] text-slate-200">{status}</pre> : null}
      {showTokenModal ? (
        <div className="rounded-xl border border-emerald-300/30 bg-slate-950/90 p-3 text-xs text-slate-200">
          <p className="font-semibold text-emerald-100">Blockchain-ready · tokenización opcional</p>
          <p className="mt-1 text-slate-300">No es un flujo crypto-first. Captura oportunidad comercial + registra TOKENIZATION_REQUESTED.</p>
          <input
            value={leadEmail}
            onChange={(event) => setLeadEmail(event.target.value)}
            placeholder="Email de contacto"
            className="mt-2 w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-white"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => void saveTokenizationLead()} className="rounded border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-emerald-100">Guardar interés</button>
            <button onClick={() => setShowTokenModal(false)} className="rounded border border-white/20 px-3 py-1 text-white">Cerrar</button>
          </div>
          {leadSaved ? <p className="mt-2 text-emerald-300">Interés guardado en pipeline comercial.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
