"use client";

import { useEffect, useState } from "react";

type Props = { bid: string; uid: string };
type LeadIntent = "tokenization_optional";
type ActionState = "idle" | "loading" | "success" | "error";
type ActionKey = "claimOwnership" | "registerWarranty" | "provenance" | "tokenization";
type CallResponse = {
  ok?: boolean;
  reason?: string;
  _httpStatus?: number;
  _httpOk?: boolean;
  _traceId?: string | null;
};
type LastRequest = { path: string; method: "POST" | "GET"; actionKey: ActionKey };
type ProvenanceResponse = {
  ok?: boolean;
  reason?: string;
  ownership?: Record<string, unknown>;
  ledger?: Record<string, unknown>;
  timeline?: Array<{ stage?: string; status?: string; at?: string | null }>;
  commercial_signals?: Record<string, unknown>;
};

async function call(path: string, method: "POST" | "GET", payload: Record<string, unknown> | null): Promise<CallResponse> {
  const url = new URL(path, window.location.origin);
  if (method === "GET" && payload) {
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(payload || {}) : undefined,
  });
  const parsed = await res.json().catch(() => ({ ok: false, reason: "invalid json" }));
  return {
    ...(parsed as Record<string, unknown>),
    _httpStatus: res.status,
    _httpOk: res.ok,
    _traceId: res.headers.get("x-nexid-trace-id"),
  };
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
  const [lastActionMessage, setLastActionMessage] = useState("");
  const [lastTraceId, setLastTraceId] = useState<string>("");
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);
  const actionMeta: Record<Exclude<ActionKey, "tokenization">, { title: string; subtitle: string; icon: string; path: string; method: "POST" | "GET"; tone: string }> = {
    claimOwnership: {
      title: "Activar ownership",
      subtitle: "Asociá el activo digital al comprador actual.",
      icon: "✅",
      path: "/api/public-cta/claim-ownership",
      method: "POST",
      tone: "border-cyan-300/40 bg-cyan-500/10 text-cyan-100",
    },
    registerWarranty: {
      title: "Registrar garantía",
      subtitle: "Guardá cobertura y fecha de activación de postventa.",
      icon: "🛡️",
      path: "/api/public-cta/register-warranty",
      method: "POST",
      tone: "border-violet-300/40 bg-violet-500/10 text-violet-100",
    },
    provenance: {
      title: "Ver provenance",
      subtitle: "Consultá timeline y señales comerciales del producto.",
      icon: "📜",
      path: "/api/public-cta/provenance",
      method: "GET",
      tone: "border-amber-300/40 bg-amber-500/10 text-amber-100",
    },
  };

  function renderStateBadge(actionKey: ActionKey) {
    const state = actionStates[actionKey];
    if (state === "loading") return <span className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">Procesando...</span>;
    if (state === "success") return <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">Hecho ✓</span>;
    if (state === "error") return <span className="rounded-full border border-rose-300/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-100">Error</span>;
    return <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">Listo</span>;
  }

  useEffect(() => {
    const hasSuccess = Object.values(actionStates).some((item) => item === "success");
    if (!hasSuccess) return;
    const timeout = setTimeout(() => {
      setActionStates((current) => {
        const next = { ...current };
        (Object.keys(next) as ActionKey[]).forEach((key) => {
          if (next[key] === "success") next[key] = "idle";
        });
        return next;
      });
    }, 5000);
    return () => clearTimeout(timeout);
  }, [actionStates]);

  function normalizeReason(data: { reason?: string; _httpStatus?: number }) {
    const reason = String(data.reason || "").toLowerCase();
    if (reason.includes("share") || reason.includes("token")) {
      return "Acción no disponible en este enlace. Abrí el SUN desde un link firmado o escaneá nuevamente.";
    }
    if ((data._httpStatus || 0) >= 500) {
      return "El servicio está con demora temporal. Probá reintentar en unos segundos.";
    }
    return data.reason || "No se pudo completar la acción. Reintentá en unos segundos.";
  }

  const trigger = async (path: string, method: "POST" | "GET", actionKey: ActionKey) => {
    if (actionStates[actionKey] === "loading") return;
    setPending(true);
    setActionError("");
    setLastActionMessage("");
    setLastTraceId("");
    setActionStates((current) => ({ ...current, [actionKey]: "loading" }));
    setLastRequest({ path, method, actionKey });
    const data = await call(path, method, { bid, uid });
    setStatus(JSON.stringify(data));
    if (data._traceId) setLastTraceId(data._traceId);
    const ok = Boolean(data.ok && data._httpOk);
    setActionStates((current) => ({ ...current, [actionKey]: ok ? "success" : "error" }));
    if (!ok) {
      setActionError(normalizeReason(data));
    } else {
      setLastActionMessage("Acción completada correctamente.");
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
    if (!leadEmail.trim() || actionStates.tokenization === "loading") return;
    setPending(true);
    setLeadSaved(false);
    setActionError("");
    setLastActionMessage("");
    setLastTraceId("");
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
    if ((tokenization as CallResponse)._traceId) setLastTraceId(String((tokenization as CallResponse)._traceId));
    setPending(false);
    const ok = Boolean((lead as CallResponse).ok && (lead as CallResponse)._httpOk && (tokenization as CallResponse).ok && (tokenization as CallResponse)._httpOk);
    setLeadSaved(ok);
    setActionStates((current) => ({ ...current, tokenization: ok ? "success" : "error" }));
    if (!ok) {
      const reason = normalizeReason(tokenization as CallResponse) || normalizeReason(lead as CallResponse);
      setActionError(reason);
    } else {
      setLastActionMessage("Interés registrado y tokenización solicitada.");
    }
  }

  function retryLastAction() {
    if (!lastRequest || pending) return;
    void trigger(lastRequest.path, lastRequest.method, lastRequest.actionKey);
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="grid gap-2 text-xs md:grid-cols-2">
        {(Object.keys(actionMeta) as Array<Exclude<ActionKey, "tokenization">>).map((key) => {
          const item = actionMeta[key];
          return (
            <button
              key={key}
              disabled={pending}
              onClick={() => void trigger(item.path, item.method, key)}
              className={`rounded-xl border px-3 py-3 text-left transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 ${item.tone}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{item.icon} {item.title}</p>
                {renderStateBadge(key)}
              </div>
              <p className="mt-1 text-[11px] opacity-90">{item.subtitle}</p>
            </button>
          );
        })}
        <button
          disabled={pending}
          onClick={() => {
            setLeadIntent("tokenization_optional");
            setActionStates((current) => ({ ...current, tokenization: "idle" }));
            setShowTokenModal(true);
          }}
          className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-3 text-left text-emerald-100 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">✨ Tokenización opcional</p>
            {renderStateBadge("tokenization")}
          </div>
          <p className="mt-1 text-[11px] text-emerald-50/80">Lead comercial + request de tokenización en un solo paso.</p>
        </button>
      </div>
      <p className="text-[11px] text-slate-300">Tip: estas acciones pueden tardar unos segundos en sincronizarse con backend.</p>
      {pending ? <p className="text-xs text-cyan-200" aria-live="polite">Ejecutando acción...</p> : null}
      {lastActionMessage ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-2 text-xs text-emerald-100" aria-live="polite">{lastActionMessage}</p> : null}
      {actionError ? <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-xs text-rose-100" aria-live="assertive">{actionError}</p> : null}
      {lastTraceId ? <p className="text-[11px] text-slate-400">trace_id: <span className="font-mono">{lastTraceId}</span></p> : null}
      {actionError && lastRequest ? (
        <button onClick={retryLastAction} disabled={pending} className="rounded border border-white/20 px-2 py-1 text-[11px] text-white disabled:cursor-not-allowed disabled:opacity-60">
          Reintentar última acción
        </button>
      ) : null}
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
            <button disabled={pending || !leadEmail.trim()} onClick={() => void saveTokenizationLead()} className="rounded border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">{getButtonLabel("Guardar interés", "tokenization")}</button>
            <button onClick={() => setShowTokenModal(false)} className="rounded border border-white/20 px-3 py-1 text-white">Cerrar</button>
          </div>
          {leadSaved ? <p className="mt-2 text-emerald-300">Interés guardado en pipeline comercial.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
