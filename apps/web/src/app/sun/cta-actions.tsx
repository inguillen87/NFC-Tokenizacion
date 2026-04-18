"use client";

import { useState } from "react";

type Props = { bid: string; uid: string };
type LeadIntent = "tokenization_optional";
type ActionState = "idle" | "loading" | "success" | "error";
type ActionKey = "claimOwnership" | "registerWarranty" | "provenance" | "tokenization";
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
  const [actionStates, setActionStates] = useState<Record<ActionKey, ActionState>>({
    claimOwnership: "idle",
    registerWarranty: "idle",
    provenance: "idle",
    tokenization: "idle",
  });
  const [actionError, setActionError] = useState<string>("");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);
  const [leadIntent, setLeadIntent] = useState<LeadIntent>("tokenization_optional");
  const [provenance, setProvenance] = useState<ProvenanceResponse | null>(null);

  function normalizeReason(data: { reason?: string }) {
    const reason = String(data.reason || "").toLowerCase();
    if (reason.includes("share") || reason.includes("token")) {
      return "Acción no disponible en este enlace. Abrí el SUN desde un link firmado o escaneá nuevamente.";
    }
    return data.reason || "No se pudo completar la acción. Reintentá en unos segundos.";
  }

  const trigger = async (path: string, method: "POST" | "GET", actionKey: ActionKey) => {
    setPending(true);
    setActionError("");
    setActionStates((current) => ({ ...current, [actionKey]: "loading" }));
    const data = await call(path, method, { bid, uid });
    setStatus(JSON.stringify(data));
    const ok = Boolean((data as { ok?: boolean }).ok);
    setActionStates((current) => ({ ...current, [actionKey]: ok ? "success" : "error" }));
    if (!ok) {
      setActionError(normalizeReason(data as { reason?: string }));
    }
    if (method === "GET" && path.includes("provenance")) setProvenance(data as ProvenanceResponse);
    setPending(false);
  };

  function getButtonLabel(idleLabel: string, actionKey: ActionKey) {
    const state = actionStates[actionKey];
    if (state === "loading") return "Procesando...";
    if (state === "success") return "Hecho ✓";
    if (state === "error") return "Error";
    return idleLabel;
  }

  async function saveTokenizationLead() {
    if (!leadEmail.trim()) return;
    setPending(true);
    setLeadSaved(false);
    setActionError("");
    setActionStates((current) => ({ ...current, tokenization: "loading" }));
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
    const ok = Boolean((lead as { ok?: boolean }).ok && (tokenization as { ok?: boolean }).ok);
    setLeadSaved(ok);
    setActionStates((current) => ({ ...current, tokenization: ok ? "success" : "error" }));
    if (!ok) {
      const reason = normalizeReason(tokenization as { reason?: string }) || normalizeReason(lead as { reason?: string });
      setActionError(reason);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="grid gap-2 text-xs md:grid-cols-2">
        <button onClick={() => void trigger("/api/public-cta/claim-ownership", "POST", "claimOwnership")} className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-left text-cyan-100">{getButtonLabel("✅ Activar ownership", "claimOwnership")}</button>
        <button onClick={() => void trigger("/api/public-cta/register-warranty", "POST", "registerWarranty")} className="rounded-xl border border-violet-300/40 bg-violet-500/10 px-3 py-2 text-left text-violet-100">{getButtonLabel("🛡️ Registrar garantía", "registerWarranty")}</button>
        <button onClick={() => void trigger("/api/public-cta/provenance", "GET", "provenance")} className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-left text-amber-100">{getButtonLabel("📜 Ver provenance", "provenance")}</button>
        <button
          onClick={() => {
            setLeadIntent("tokenization_optional");
            setActionStates((current) => ({ ...current, tokenization: "idle" }));
            setShowTokenModal(true);
          }}
          className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-left text-emerald-100"
        >
          {getButtonLabel("✨ Tokenización opcional", "tokenization")}
        </button>
      </div>
      {pending ? <p className="text-xs text-cyan-200">Ejecutando acción...</p> : null}
      {actionError ? <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-xs text-rose-100">{actionError}</p> : null}
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
          <ul className="mt-2 list-disc pl-4 text-[11px] text-slate-300">
            <li>Uso enterprise: provenance anclable, warranty ledger y ownership transfer.</li>
            <li>Infra opcional: smart contracts / blockchain solo cuando hay ROI claro.</li>
            <li>Se mantiene el core: autenticidad, trazabilidad y anti-fraude.</li>
          </ul>
          <input
            value={leadEmail}
            onChange={(event) => setLeadEmail(event.target.value)}
            placeholder="Email de contacto"
            className="mt-2 w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-white"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => void saveTokenizationLead()} className="rounded border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-emerald-100">{getButtonLabel("Guardar interés", "tokenization")}</button>
            <button onClick={() => setShowTokenModal(false)} className="rounded border border-white/20 px-3 py-1 text-white">Cerrar</button>
          </div>
          {leadSaved ? <p className="mt-2 text-emerald-300">Interés guardado en pipeline comercial.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
