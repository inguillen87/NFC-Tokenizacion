"use client";

import { useEffect, useRef, useState } from "react";

type TapState = "valid" | "opened" | "blocked";
type RightsPolicy = {
  conditionState?: string | null;
  claimMode?: string | null;
  tokenizationPolicy?: string | null;
  marketplaceMode?: string | null;
  requirements?: string[];
  consumerCopy?: string | null;
  recommendedNextStep?: string | null;
};
type Props = { bid: string; uid?: string; eventId?: string; freshToken?: string; canExecute?: boolean; tapState?: TapState; rightsPolicy?: RightsPolicy };
type ActionState = "idle" | "loading" | "success" | "error";
type ActionKey = "claimOwnership" | "registerWarranty" | "provenance" | "tokenization" | "report";
type CallResponse = {
  ok?: boolean;
  reason?: string;
  anchor?: { ok?: boolean; status?: string; tx_hash?: string | null; token_id?: string | null; reason?: string | null; next_attempt_at?: string | null } | null;
  tokenization_request?: { status?: string | null; tx_hash?: string | null; token_id?: string | null; next_attempt_at?: string | null; last_error?: string | null } | null;
  mint_ok?: boolean;
  tokenization_status?: string | null;
  tokenization_error?: string | null;
  tx_hash?: string | null;
  token_id?: string | null;
  next_attempt_at?: string | null;
  explainer?: string | null;
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
const SECURITY_GATED_ACTIONS = new Set<ActionKey>(["claimOwnership", "registerWarranty", "tokenization"]);

function normalizeUnknownError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "No se pudo completar la acción por un problema de conexión. Reintentá en unos segundos.";
}

function labelPolicy(value?: string | null) {
  const raw = String(value || "").replace(/_/g, " ").trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "No configurado";
}

async function call(path: string, method: "POST" | "GET", payload: Record<string, unknown> | null): Promise<CallResponse> {
  const url = new URL(path, window.location.origin);
  if (method === "GET" && payload) {
    Object.entries(payload).forEach(([key, value]) => {
      if (value == null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  const res = await fetch(url.toString(), {
    method,
    credentials: "include",
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

export function CtaActions({ bid, uid = "", eventId = "", freshToken = "", canExecute = true, tapState = "valid", rightsPolicy }: Props) {
  const [status, setStatus] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [actionStates, setActionStates] = useState<Record<ActionKey, ActionState>>({
    claimOwnership: "idle",
    registerWarranty: "idle",
    provenance: "idle",
    tokenization: "idle",
    report: "idle",
  });
  const [actionError, setActionError] = useState<string>("");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);
  const leadIntent = "tokenization_optional";
  const [provenance, setProvenance] = useState<ProvenanceResponse | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState("");
  const [lastTraceId, setLastTraceId] = useState<string>("");
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const tokenModalRef = useRef<HTMLDivElement | null>(null);
  const tokenActionButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.trim());
  const tokenPolicy = String(rightsPolicy?.tokenizationPolicy || "").toLowerCase();
  const claimMode = String(rightsPolicy?.claimMode || "").toLowerCase();
  const policySummary = rightsPolicy?.consumerCopy || "";
  const tokenSubtitle = tokenPolicy === "issuer_transfer"
    ? "Tokenizacion por transferencia del issuer: requiere prueba documental antes del mint."
    : tokenPolicy === "lot_anchor"
      ? "Ancla de lote: tokeniza trazabilidad y lifecycle sin prometer ownership individual."
      : tokenPolicy === "manual_review"
        ? "Solicitud a revision: el tenant aprueba antes de mintear en Polygon."
        : "Request de tokenizacion con UID hasheado, salt privado y proof Polygon.";
  const gatedCopy = tapState === "blocked"
    ? "Ownership, garantia y tokenizacion quedan protegidos hasta tener un tap fisico valido y fresco."
    : policySummary || (tapState === "opened"
      ? "Sello abierto verificado: se habilita ownership, garantia, provenance y tokenizacion como lifecycle event."
      : "Tap fresco verificado: listo para ownership, garantia, provenance y tokenizacion.");
  const tokenModalCopy = tokenPolicy === "issuer_transfer"
    ? "El token se solicita como transferencia del issuer: no se mintea ownership publico sin proof of purchase o autorizacion."
    : tokenPolicy === "lot_anchor"
      ? "El token ancla un lote, origen y lifecycle. No convierte automaticamente cada unidad fisica en propiedad individual."
      : tokenPolicy === "manual_review"
        ? "La solicitud queda en revision comercial antes de mintear. Es ideal para pharma, cosmetica o casos con riesgo regulatorio."
        : tapState === "opened"
    ? "El token ancla la apertura verificada, ownership y provenance sin exponer el UID crudo."
    : "El token ancla ownership, provenance y garantia sin exponer el UID crudo.";
  const actionMeta: Record<string, { title: string; subtitle: string; icon: string; path: string; method: "POST" | "GET"; tone: string }> = {
    claimOwnership: {
      title: "Apropiar ownership",
      subtitle: "Vincula este producto a tu Passport y deja registro de titularidad.",
      icon: "OWN",
      path: "/api/public-cta/claim-ownership",
      method: "POST",
      tone: "border-indigo-300/40 bg-indigo-500/10 text-indigo-100 transition hover:bg-indigo-500/20",
    },
    registerWarranty: {
      title: "Registrar garantia",
      subtitle: "Activa cobertura, postventa y fecha de apertura o compra.",
      icon: "WAR",
      path: "/api/public-cta/register-warranty",
      method: "POST",
      tone: "border-violet-300/40 bg-violet-500/10 text-violet-100 transition hover:bg-violet-500/20",
    },
    provenance: {
      title: "Ver provenance",
      subtitle: "Consulta origen, ruta, eventos del tenant y prueba tecnica.",
      icon: "PRO",
      path: "/api/public-cta/provenance",
      method: "GET",
      tone: "border-amber-300/40 bg-amber-500/10 text-amber-100 transition hover:bg-amber-500/20",
    },
    report: {
      title: "Reportar problema",
      subtitle: "Crea un ticket si el tap, replay o sello parecen inconsistentes.",
      icon: "RPT",
      path: "/api/public-cta/report-problem",
      method: "POST",
      tone: "border-rose-300/40 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/20",
    }
  };
  const successCopy: Record<ActionKey, string> = {
    claimOwnership: "Ownership registrado en tu nexID Passport.",
    registerWarranty: "Garantia registrada para postventa y lifecycle.",
    provenance: "Provenance consultada correctamente.",
    tokenization: "Tokenizacion enviada: el ledger va a anclar o mintear en Polygon Amoy.",
    report: "Ticket creado para revisar el tap.",
  };

  function tokenizationStatus(data: CallResponse) {
    return String(data.tokenization_status || data.anchor?.status || data.tokenization_request?.status || "").toLowerCase();
  }

  function tokenizationTx(data: CallResponse) {
    return data.tx_hash || data.anchor?.tx_hash || data.tokenization_request?.tx_hash || null;
  }

  function tokenizationTokenId(data: CallResponse) {
    return data.token_id || data.anchor?.token_id || data.tokenization_request?.token_id || null;
  }

  function tokenizationError(data: CallResponse) {
    return data.tokenization_error || data.anchor?.reason || data.tokenization_request?.last_error || data.reason || null;
  }

  function tokenizationUiResult(data: CallResponse) {
    const status = tokenizationStatus(data);
    const txHash = tokenizationTx(data);
    const tokenId = tokenizationTokenId(data);
    const hasMint = Boolean(data.mint_ok || status === "anchored" || data.anchor?.ok || txHash || tokenId);

    if (!data._httpOk) {
      return {
        ok: false,
        message: status === "failed"
          ? `Mint fallido: ${tokenizationError(data) || "revisar gas, RPC o minter"}`
          : normalizeReason(data),
      };
    }

    if (status === "failed" || data.ok === false) {
      return {
        ok: false,
        message: `Solicitud guardada, pero el mint fallo: ${tokenizationError(data) || "reintento operativo requerido"}.`,
      };
    }

    if (hasMint) {
      return {
        ok: true,
        message: tokenId
          ? `Token anclado en Polygon Amoy (#${tokenId}${txHash ? ", tx registrada" : ""}).`
          : "Token anclado en Polygon Amoy con UID hasheado.",
      };
    }

    if (status === "pending" || status === "processing") {
      const nextAttempt = data.next_attempt_at || data.anchor?.next_attempt_at || data.tokenization_request?.next_attempt_at;
      return {
        ok: true,
        message: `Solicitud en cola para Polygon Amoy${nextAttempt ? `; proximo intento ${nextAttempt}` : ""}.`,
      };
    }

    return {
      ok: Boolean(data.ok),
      message: successCopy.tokenization,
    };
  }

  function successMessageFor(actionKey: ActionKey, data: CallResponse) {
    if (actionKey !== "tokenization") return successCopy[actionKey];
    return tokenizationUiResult(data).message;
  }

  function renderStateBadge(actionKey: ActionKey) {
    const state = actionStates[actionKey];
    if (!canExecute && SECURITY_GATED_ACTIONS.has(actionKey) && state === "idle") {
      return <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">Requiere tap</span>;
    }
    if (state === "loading") return <span className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">Procesando...</span>;
    if (state === "success") return <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">Hecho</span>;
    if (state === "error") return <span className="rounded-full border border-rose-300/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-100">Error</span>;
    return <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">Disponible</span>;
  }

  function cardStateClass(actionKey: ActionKey) {
    const state = actionStates[actionKey];
    if (state === "loading") return "ring-1 ring-cyan-300/60 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]";
    if (state === "success") return "ring-1 ring-emerald-300/45 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]";
    if (state === "error") return "ring-1 ring-rose-300/45 shadow-[0_0_0_1px_rgba(251,113,133,0.2)]";
    return "ring-0";
  }

  function isActionDisabled(actionKey: ActionKey) {
    return pending || (!canExecute && SECURITY_GATED_ACTIONS.has(actionKey));
  }

  function basePayload(extra?: Record<string, unknown>) {
    const payload: Record<string, unknown> = {
      ...(extra || {}),
      bid,
      uid,
    };
    if (eventId) payload.event_id = eventId;
    if (freshToken) payload.fresh_token = freshToken;
    if (rightsPolicy?.conditionState) payload.condition_state = rightsPolicy.conditionState;
    if (rightsPolicy?.claimMode) payload.claim_mode = rightsPolicy.claimMode;
    if (rightsPolicy?.tokenizationPolicy) payload.tokenization_policy = rightsPolicy.tokenizationPolicy;
    if (rightsPolicy?.marketplaceMode) payload.marketplace_mode = rightsPolicy.marketplaceMode;
    if (Array.isArray(rightsPolicy?.requirements)) payload.requirements = rightsPolicy.requirements.slice(0, 8);
    return payload;
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

  useEffect(() => {
    if (!showTokenModal) return;
    previousFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    emailInputRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowTokenModal(false);
      if (event.key !== "Tab") return;
      const focusable = tokenModalRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      if (!focusable || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
      (previousFocusedElementRef.current || tokenActionButtonRef.current)?.focus();
    };
  }, [showTokenModal]);

  function normalizeReason(data: { reason?: string; _httpStatus?: number }) {
    const reason = String(data.reason || "").toLowerCase();
    if (reason.includes("fresh") || reason.includes("physical") || reason.includes("expired")) {
      return "Para ownership, garantia o tokenizacion necesitamos un tap fisico nuevo. Volve a tocar la etiqueta NFC.";
    }
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
    if (!canExecute && SECURITY_GATED_ACTIONS.has(actionKey)) {
      setActionError("Este tap no habilita ownership, garantia ni tokenizacion. Escanea nuevamente la etiqueta fisica.");
      setActionStates((current) => ({ ...current, [actionKey]: "error" }));
      return;
    }
    setPending(true);
    setActionError("");
    setLastActionMessage("");
    setLastTraceId("");
    setActionStates((current) => ({ ...current, [actionKey]: "loading" }));
    setLastRequest({ path, method, actionKey });
    try {
      const data = await call(path, method, basePayload());
      setStatus(JSON.stringify(data));
      if (data._traceId) setLastTraceId(data._traceId);
      const result = actionKey === "tokenization"
        ? tokenizationUiResult(data)
        : { ok: Boolean(data.ok && data._httpOk), message: data.ok && data._httpOk ? successMessageFor(actionKey, data) : normalizeReason(data) };
      setActionStates((current) => ({ ...current, [actionKey]: result.ok ? "success" : "error" }));
      if (!result.ok) {
        setActionError(result.message);
      } else {
        setLastActionMessage(result.message);
      }
      if (method === "GET" && path.includes("provenance")) setProvenance(data as ProvenanceResponse);
    } catch (error) {
      setActionStates((current) => ({ ...current, [actionKey]: "error" }));
      setActionError(normalizeUnknownError(error));
      setStatus(JSON.stringify({ ok: false, reason: normalizeUnknownError(error) }));
    } finally {
      setPending(false);
    }
  };

  function getButtonLabel(idleLabel: string, actionKey: ActionKey) {
    const state = actionStates[actionKey];
    if (state === "loading") return "Procesando...";
    if (state === "success") return "Hecho";
    if (state === "error") return "Error";
    return idleLabel;
  }

  async function saveTokenizationLead() {
    if (!leadEmail.trim() || !isEmailValid || actionStates.tokenization === "loading") return;
    setPending(true);
    setLeadSaved(false);
    setActionError("");
    setLastActionMessage("");
    setLastTraceId("");
    setActionStates((current) => ({ ...current, tokenization: "loading" }));
    try {
      const leadPayload = {
        name: "SUN visitor",
        email: leadEmail.trim(),
        source: "sun_validation_center",
        vertical: "premium",
        role: "buyer",
        message: `Tokenization optional CTA from SUN page [bid=${bid}] [uid=${uid || "event:" + eventId}] [intent=${leadIntent}] [token_policy=${tokenPolicy || "default"}] [claim_mode=${claimMode || "default"}]`,
        notes: `commercial_signal=tokenization_optional | bid=${bid} | uid=${uid || "event:" + eventId} | event_id=${eventId} | token_policy=${tokenPolicy || "default"} | claim_mode=${claimMode || "default"}`,
      };
      const lead = await call("/api/leads", "POST", leadPayload);
      const tokenization = await call("/api/public-cta/tokenize-request", "POST", basePayload({
        claim_source: "sun_cta_modal",
        ledger_status: "simulated",
        ledger_network: "not_selected",
      }));
      setStatus(JSON.stringify({ lead, tokenization }));
      if ((tokenization as CallResponse)._traceId) setLastTraceId(String((tokenization as CallResponse)._traceId));
      const leadOk = Boolean((lead as CallResponse)._httpOk && (lead as CallResponse).ok !== false);
      const tokenizationResult = tokenizationUiResult(tokenization as CallResponse);
      const ok = Boolean(leadOk && tokenizationResult.ok);
      setLeadSaved(ok);
      setActionStates((current) => ({ ...current, tokenization: ok ? "success" : "error" }));
      if (!ok) {
        const reason = leadOk ? tokenizationResult.message : normalizeReason(lead as CallResponse);
        setActionError(reason);
      } else {
        setLastActionMessage(tokenizationResult.message);
      }
    } catch (error) {
      setActionStates((current) => ({ ...current, tokenization: "error" }));
      setActionError(normalizeUnknownError(error));
      setStatus(JSON.stringify({ ok: false, reason: normalizeUnknownError(error) }));
    } finally {
      setPending(false);
    }
  }

  function retryLastAction() {
    if (!lastRequest || pending) return;
    void trigger(lastRequest.path, lastRequest.method, lastRequest.actionKey);
  }

  return (
    <div className="sun-public-cta mt-4 space-y-2">
      {rightsPolicy ? (
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-2 text-[11px] text-cyan-100">
          Politica: ownership {labelPolicy(rightsPolicy.claimMode)} · token {labelPolicy(rightsPolicy.tokenizationPolicy)} · marketplace {labelPolicy(rightsPolicy.marketplaceMode)}
        </div>
      ) : null}
      <div className="grid gap-2 text-xs md:grid-cols-2">
        {(Object.keys(actionMeta) as Array<Exclude<ActionKey, "tokenization">>).map((key) => {
          const item = actionMeta[key];
          return (
            <button suppressHydrationWarning
              key={key}
              disabled={isActionDisabled(key)}
              onClick={() => void trigger(item.path, item.method, key)}
              className={`sun-public-cta-card rounded-xl border px-3 py-3 text-left transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 ${item.tone} ${cardStateClass(key)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold"><span className="sun-public-cta-code">{item.icon}</span> {key === "report" ? "Reportar problema" : item.title}{actionStates[key] === "loading" ? <span className="ml-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" /> : null}</p>
                {renderStateBadge(key)}
              </div>
              <p className="mt-1 text-[11px] opacity-90">{item.subtitle}</p>
            </button>
          );
        })}
        <button suppressHydrationWarning
          ref={tokenActionButtonRef}
          disabled={isActionDisabled("tokenization")}
          onClick={() => void trigger("/api/public-cta/tokenize-request", "POST", "tokenization")}
          className={`sun-public-cta-card rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-3 text-left text-emerald-100 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 ${cardStateClass("tokenization")}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold"><span className="sun-public-cta-code">TOK</span> Tokenizar en Polygon{actionStates.tokenization === "loading" ? <span className="ml-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-200" /> : null}</p>
            {renderStateBadge("tokenization")}
          </div>
          <p className="mt-1 text-[11px] text-emerald-50/80">{tokenSubtitle}</p>
        </button>
      </div>
      <p className="sun-cta-tip text-[11px] text-slate-300">{gatedCopy}</p>
      {pending ? <p className="text-xs text-cyan-200" aria-live="polite">Ejecutando acción...</p> : null}
      {lastActionMessage ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-2 text-xs text-emerald-100" aria-live="polite">{lastActionMessage}</p> : null}
      {actionError ? <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-xs text-rose-100" aria-live="assertive">{actionError}</p> : null}
      {lastTraceId ? <p className="text-[11px] text-slate-400">trace_id: <span className="font-mono">{lastTraceId}</span></p> : null}
      {actionError && lastRequest ? (
        <button suppressHydrationWarning onClick={retryLastAction} disabled={pending} className="rounded border border-white/20 px-2 py-1 text-[11px] text-white disabled:cursor-not-allowed disabled:opacity-60">
          Reintentar última acción
        </button>
      ) : null}
      {provenance?.timeline?.length ? (
        <details className="rounded border border-cyan-300/15 bg-slate-950/45 p-2 text-[11px] text-slate-200">
          <summary className="cursor-pointer font-semibold text-cyan-100">Lifecycle timeline</summary>
          <ul className="mt-2 space-y-1">
            {provenance.timeline.map((item, index) => (
              <li key={`${String(item.stage || "stage")}-${index}`}>
                <span className="text-white">{String(item.stage || "-")}</span> · {String(item.status || "-")}
                {item.at ? ` · ${item.at}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {status ? (
        <details className="rounded border border-white/10 bg-slate-950/55 p-2 text-[11px] text-slate-300">
          <summary className="cursor-pointer font-semibold text-slate-100">Detalle tecnico</summary>
          <pre className="mt-2 overflow-x-auto text-slate-300">{status}</pre>
        </details>
      ) : null}
      {showTokenModal ? (
        <div ref={tokenModalRef} role="dialog" aria-modal="true" aria-labelledby="sun-token-modal-title" className="rounded-xl border border-emerald-300/30 bg-slate-950/90 p-3 text-xs text-slate-200">
          <p id="sun-token-modal-title" className="font-semibold text-emerald-100">Blockchain-ready · tokenización opcional</p>
          <p className="mt-1 text-slate-300">{tokenModalCopy}</p>
          <ul className="mt-2 list-disc pl-4 text-[11px] text-slate-300">
            <li>Uso enterprise: provenance anclable, warranty ledger y ownership transfer.</li>
            <li>Infra opcional: smart contracts / blockchain solo cuando hay ROI claro.</li>
            <li>Se mantiene el core: autenticidad, trazabilidad y anti-fraude.</li>
          </ul>
          <input suppressHydrationWarning
            ref={emailInputRef}
            value={leadEmail}
            onChange={(event) => setLeadEmail(event.target.value)}
            placeholder="Email de contacto"
            aria-invalid={Boolean(leadEmail.trim()) && !isEmailValid}
            className="mt-2 w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-white"
          />
          {leadEmail.trim() && !isEmailValid ? <p className="mt-1 text-[11px] text-rose-300">Ingresá un email válido para guardar el interés.</p> : null}
          <div className="mt-2 flex gap-2">
            <button suppressHydrationWarning disabled={pending || !leadEmail.trim() || !isEmailValid} onClick={() => void saveTokenizationLead()} className="rounded border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">{getButtonLabel("Guardar interés", "tokenization")}</button>
            <button suppressHydrationWarning onClick={() => setShowTokenModal(false)} className="rounded border border-white/20 px-3 py-1 text-white">Cerrar</button>
          </div>
          {leadSaved ? <p className="mt-2 text-emerald-300">Interés guardado en pipeline comercial.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
