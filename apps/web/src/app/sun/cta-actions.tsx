"use client";

import { useEffect, useRef, useState } from "react";
import { isSecurePostTapActionAllowed, type SecurePostTapActionKey } from "./post-tap-policy";
import { selectSunTruthCopy, SUN_DEMO_COPY } from "./sun-truth-copy";
import { SunClaimPortal } from "./sun-claim-portal";

type TapState = "valid" | "opened" | "manual_opened" | "blocked";
type RightsPolicy = {
  conditionState?: string | null;
  claimMode?: string | null;
  tokenizationPolicy?: string | null;
  marketplaceMode?: string | null;
  requirements?: string[];
  consumerCopy?: string | null;
  recommendedNextStep?: string | null;
};
type Props = { bid: string; uid?: string; eventId?: string; freshToken?: string; canExecute?: boolean; tapState?: TapState; rightsPolicy?: RightsPolicy; allowedActions?: string[]; blockedActions?: string[]; isDemoPreview?: boolean; claimHref?: string | null; supportAvailable?: boolean };
type ActionState = "idle" | "loading" | "success" | "error";
type ActionKey = Exclude<SecurePostTapActionKey, "claimOwnership" | "report">;
type CallResponse = {
  ok?: boolean;
  authenticated?: boolean;
  reason?: string;
  error?: string;
  code?: string;
  mode?: string;
  deliveryChannel?: string;
  delivery?: { channel?: string; status?: string };
  secondaryDelivery?: { channel?: string; status?: string };
  ttlMinutes?: number;
  next_step?: string;
  status?: string | null;
  request_status?: string | null;
  provenance?: string | { mode?: string | null; status?: string | null } | null;
  warranty?: { status?: string | null } | null;
  ticket?: { id?: string | number | null; status?: string | null; tenant_assigned?: boolean | null } | null;
  consumer?: Record<string, unknown>;
  ownership?: { status?: string | null } | null;
  ownership_status?: string | null;
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
type ProvenanceResponse = {
  ok?: boolean;
  reason?: string;
  ownership?: Record<string, unknown>;
  ledger?: Record<string, unknown>;
  timeline?: Array<{ stage?: string; status?: string; at?: string | null }>;
  commercial_signals?: Record<string, unknown>;
};
const SECURITY_GATED_ACTIONS = new Set<ActionKey>(["registerWarranty", "tokenization"]);

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

export function CtaActions({ bid, uid = "", eventId = "", freshToken = "", canExecute = true, tapState = "valid", rightsPolicy, allowedActions = [], blockedActions = [], isDemoPreview = false, claimHref = null, supportAvailable = false }: Props) {
  const [status, setStatus] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [actionStates, setActionStates] = useState<Record<ActionKey, ActionState>>({
    registerWarranty: "idle",
    provenance: "idle",
    tokenization: "idle",
  });
  const [actionError, setActionError] = useState<string>("");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);
  const leadIntent = "tokenization_optional";
  const [provenance, setProvenance] = useState<ProvenanceResponse | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState("");
  const [lastTraceId, setLastTraceId] = useState<string>("");
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const tokenModalRef = useRef<HTMLDivElement | null>(null);
  const tokenActionButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.trim());
  const tokenPolicy = String(rightsPolicy?.tokenizationPolicy || "").toLowerCase();
  const claimMode = String(rightsPolicy?.claimMode || "").toLowerCase();
  const policySummary = rightsPolicy?.consumerCopy || "";
  const policyAllowsAction = (actionKey: SecurePostTapActionKey) => isSecurePostTapActionAllowed(
    actionKey,
    allowedActions,
    blockedActions,
  );
  const isManualOpenedConsumerFlow = tapState === "manual_opened";
  const isSensorOpenedConsumerFlow = tapState === "opened";
  const isOpenedConsumerFlow = isSensorOpenedConsumerFlow || isManualOpenedConsumerFlow;
  const commercialActionsAllowed = canExecute && !isManualOpenedConsumerFlow && tapState !== "blocked" && !isDemoPreview;
  const canStartClaim = commercialActionsAllowed && policyAllowsAction("claimOwnership");
  const tokenSubtitle = tokenPolicy === "issuer_transfer"
    ? "La transferencia del registro digital requiere documentación y autorización del emisor."
    : tokenPolicy === "lot_anchor"
      ? "Solicitá registrar la información declarada del lote. Esto no confirma su origen físico ni la propiedad individual."
      : tokenPolicy === "manual_review"
        ? "La marca revisa la solicitud antes de emitir el registro digital."
        : "Podés solicitar un registro digital después de validar la compra. Sólo se confirma con una transacción verificable.";
  const realGatedCopy = tapState === "blocked"
    ? "Para solicitar propiedad, garantía o un registro digital necesitás una nueva lectura NFC validada. Esa lectura no prueba el producto físico."
    : policySummary || (isManualOpenedConsumerFlow
      ? "Un operador informó una apertura. La etiqueta digital no la detectó automáticamente; la marca puede revisar el registro y acompañarte con la postventa."
      : isSensorOpenedConsumerFlow
      ? "La etiqueta digital informó una apertura. Si no la reconocés o el envase está dañado, no uses el producto y avisá a la marca."
      : "La lectura digital fue validada. Compra, propiedad y beneficios requieren validaciones separadas.");
  const gatedCopy = selectSunTruthCopy(isDemoPreview, SUN_DEMO_COPY.gatedActions, realGatedCopy);
  const realTokenModalCopy = tokenPolicy === "issuer_transfer"
    ? "La transferencia del registro digital requiere prueba de compra o autorización del emisor; no concede propiedad por sí sola."
    : tokenPolicy === "lot_anchor"
      ? "Una transaccion confirmada puede registrar información declarada del lote; no prueba por si sola origen fisico, recorrido ni propiedad individual."
      : tokenPolicy === "manual_review"
        ? "La marca debe revisar y aprobar la solicitud antes de emitir el registro digital."
        : isOpenedConsumerFlow
    ? "Una transaccion confirmada puede registrar la apertura informada y declaraciones aprobadas de propiedad u origen; no prueba por si sola una apertura fisica ni el contenido."
    : "Una transaccion confirmada puede registrar declaraciones aprobadas de propiedad, origen o garantia; no prueba por si sola custodia ni contenido fisico.";
  const tokenModalCopy = selectSunTruthCopy(isDemoPreview, SUN_DEMO_COPY.tokenModal, realTokenModalCopy);
  const actionMeta: Record<string, { title: string; subtitle: string; icon: string; path: string; method: "POST" | "GET"; tone: string }> = {
    registerWarranty: {
      title: "Solicitar revisión de garantía",
      subtitle: "Registra una solicitud para revisión de cobertura, postventa y fecha declarada de compra.",
      icon: "WAR",
      path: "/api/public-cta/register-warranty",
      method: "POST",
      tone: "border-violet-300/40 bg-violet-500/10 text-violet-100 transition hover:bg-violet-500/20",
    },
    provenance: {
      title: "Consultar origen",
      subtitle: "Consultá el origen y recorrido declarados por la marca y los registros disponibles.",
      icon: "PRO",
      path: "/api/public-cta/provenance",
      method: "GET",
      tone: "border-amber-300/40 bg-amber-500/10 text-amber-100 transition hover:bg-amber-500/20",
    },
  };
  const successCopy: Record<ActionKey, string> = {
    registerWarranty: "Solicitud de garantía registrada · pendiente de revisión.",
    provenance: "Información de origen consultada.",
    tokenization: "Solicitud de registro digital recibida. No hay NFT confirmado hasta contar con una transacción y un identificador verificables.",
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
    const hasSavedRequest = Boolean(data.tokenization_request || data.tokenization_status || data.anchor || data._httpOk || data.ok === true || status);
    const nextAttempt = data.next_attempt_at || data.anchor?.next_attempt_at || data.tokenization_request?.next_attempt_at;

    if (status === "pending_retry" || (status === "failed" && hasSavedRequest)) {
      return {
        ok: true,
        message: data.explainer || `Solicitud protegida guardada. Polygon Amoy queda pendiente de procesamiento o reconciliacion${nextAttempt ? ` a partir de ${nextAttempt}` : ""}; todavia no hay NFT confirmado.`,
      };
    }

    if (!data._httpOk && data.ok !== true) {
      return {
        ok: false,
        message: status === "failed"
          ? `No se pudo guardar la solicitud de tokenizacion: ${tokenizationError(data) || "revisar gas, RPC o minter"}`
          : normalizeReason(data),
      };
    }

    if (status === "failed" || data.ok === false) {
      return {
        ok: hasSavedRequest,
        message: hasSavedRequest
          ? `Solicitud protegida guardada. El anclaje queda pendiente de procesamiento o reconciliacion${nextAttempt ? ` a partir de ${nextAttempt}` : ""}; no se confirma automaticamente desde esta pantalla.`
          : `No se pudo guardar la solicitud de tokenizacion: ${tokenizationError(data) || "procesamiento operativo requerido"}.`,
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
      return {
        ok: true,
        message: `Solicitud en cola para Polygon Amoy${nextAttempt ? `; elegible para revision a partir de ${nextAttempt}` : ""}. Estar en cola no confirma mint ni garantiza ejecucion automatica.`,
      };
    }

    return {
      ok: Boolean(data.ok),
      message: successCopy.tokenization,
    };
  }

  function requiresConsumerAuth(data: CallResponse) {
    const reason = String(data.reason || data.error || "").toLowerCase();
    return reason.includes("consumer_auth_required") || (data._httpStatus === 401 && reason.includes("unauthorized"));
  }

  function successMessageFor(actionKey: ActionKey, data: CallResponse) {
    const provenance = typeof data.provenance === "string"
      ? data.provenance
      : data.provenance?.status || data.provenance?.mode || "";
    const responseStatus = String(
      data.request_status
      || data.status
      || data.warranty?.status
      || data.ticket?.status
      || provenance,
    ).toLowerCase();
    const confirmedStatuses = new Set(["approved", "active", "confirmed", "completed", "ticket_open", "open"]);
    if (actionKey === "registerWarranty") {
      return confirmedStatuses.has(responseStatus)
        ? "Garantía confirmada por el servicio de validación para postventa."
        : successCopy.registerWarranty;
    }
    if (actionKey !== "tokenization") return successCopy[actionKey];
    return tokenizationUiResult(data).message;
  }

  function renderStateBadge(actionKey: ActionKey) {
    const state = actionStates[actionKey];
    if (!policyAllowsAction(actionKey) && state === "idle") {
      return <span className="rounded-full border border-slate-400/30 bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-200">No habilitada</span>;
    }
    if (!commercialActionsAllowed && SECURITY_GATED_ACTIONS.has(actionKey) && state === "idle") {
      return <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">Requiere verificación</span>;
    }
    if (state === "loading") return <span className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">Procesando...</span>;
    if (state === "success") return <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">Recibido</span>;
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
    return pending || !policyAllowsAction(actionKey) || (!commercialActionsAllowed && SECURITY_GATED_ACTIONS.has(actionKey));
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

  function normalizeReason(data: { reason?: string; error?: string; _httpStatus?: number }) {
    const reason = String(data.error || data.reason || "").toLowerCase();
    if (reason.includes("consumer_auth_required")) {
      return "Para continuar, entrá en tu cuenta NexID. Esta solicitud no se completó; no se reintentará automáticamente.";
    }
    if (reason.includes("ownership_claim_required")) {
      return "Primero completa la validacion de compra segun la politica de la marca. Despues se habilita la solicitud NFT y la conexion de wallet.";
    }
    if (reason.includes("fresh") || reason.includes("physical") || reason.includes("expired")) {
      return "Para solicitar propiedad, garantía o un registro digital necesitás una nueva lectura NFC validada. Volvé a leer la etiqueta.";
    }
    if (reason.includes("share") || reason.includes("token")) {
      return "Acción no disponible en este enlace. Abrí el SUN desde un link firmado o escaneá nuevamente.";
    }
    if ((data._httpStatus || 0) >= 500) {
      return "El servicio está con demora temporal. Probá reintentar en unos segundos.";
    }
    return "No se pudo completar la acción. Conservamos los datos; reintentá en unos segundos.";
  }

  const trigger = async (path: string, method: "POST" | "GET", actionKey: ActionKey) => {
    if (actionStates[actionKey] === "loading") return;
    if (!policyAllowsAction(actionKey)) {
      setActionError("La politica de este producto no habilita esta accion. Revisa las opciones disponibles para este lote.");
      return;
    }
    if (!commercialActionsAllowed && SECURITY_GATED_ACTIONS.has(actionKey)) {
      setActionError(isManualOpenedConsumerFlow
        ? "Una apertura declarada necesita revisión antes de habilitar propiedad, garantía o tokenización."
        : "Este tap no habilita propiedad, garantia ni tokenizacion. Escanea nuevamente la etiqueta fisica.");
      setActionStates((current) => ({ ...current, [actionKey]: "error" }));
      return;
    }
    setPending(true);
    setActionError("");
    setLastActionMessage("");
    setLastTraceId("");
    setActionStates((current) => ({ ...current, [actionKey]: "loading" }));
    try {
      const data = await call(path, method, basePayload());
      setStatus(JSON.stringify(data));
      if (data._traceId) setLastTraceId(data._traceId);
      if (actionKey === "tokenization" && requiresConsumerAuth(data)) {
        setActionStates((current) => ({ ...current, [actionKey]: "error" }));
        setActionError(normalizeReason(data));
        return;
      }
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
    if (state === "success") return "Recibido";
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

  return (
    <div className="sun-public-cta mt-4 v3-space-y-2">
      <SunClaimPortal
        href={claimHref}
        eventId={eventId}
        freshToken={freshToken}
        availability={!commercialActionsAllowed ? isManualOpenedConsumerFlow ? "manual_opened" : "fresh_required" : !canStartClaim ? "not_enabled" : pending ? "busy" : "ready"}
        supportAvailable={supportAvailable && !isDemoPreview}
      />

      <details open={!policyAllowsAction("claimOwnership") && policyAllowsAction("registerWarranty")} className="sun-advanced-actions rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-xs">
        <summary className="cursor-pointer text-sm font-black text-slate-100">Opciones avanzadas de garantía y propiedad digital</summary>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
        {(Object.keys(actionMeta) as Array<Exclude<ActionKey, "tokenization">>).map((key) => {
          const item = actionMeta[key];
          return (
            <button suppressHydrationWarning
              id={key === "registerWarranty" ? "warranty-action" : undefined}
              key={key}
              disabled={isActionDisabled(key)}
              onClick={() => void trigger(item.path, item.method, key)}
              className={`sun-public-cta-card rounded-xl border px-3 py-3 text-left transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 ${item.tone} ${cardStateClass(key)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold"><span className="sun-public-cta-code">{item.icon}</span> {item.title}{actionStates[key] === "loading" ? <span className="ml-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" /> : null}</p>
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
            <p className="text-sm font-semibold"><span className="sun-public-cta-code">NFT</span> Solicitar NFT / token{actionStates.tokenization === "loading" ? <span className="ml-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-200" /> : null}</p>
            {renderStateBadge("tokenization")}
          </div>
          <p className="mt-1 text-[11px] text-emerald-50/80">{tokenSubtitle}</p>
        </button>
        </div>
        {rightsPolicy ? (
          <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/45 p-2 text-[10px] leading-4 text-slate-400">
            Configuración técnica: propiedad {labelPolicy(rightsPolicy.claimMode)} · token {labelPolicy(rightsPolicy.tokenizationPolicy)} · marketplace {labelPolicy(rightsPolicy.marketplaceMode)}
          </p>
        ) : null}
      </details>
      <p className="sun-cta-tip text-[11px] text-slate-300">{gatedCopy}</p>
      {pending ? <p className="text-xs text-cyan-200" aria-live="polite">Ejecutando acción...</p> : null}
      {lastActionMessage ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-2 text-xs text-emerald-100" aria-live="polite">{lastActionMessage}</p> : null}
      {actionError ? <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-xs text-rose-100" aria-live="assertive">{actionError}</p> : null}
      
      {lastTraceId ? <p className="text-[11px] text-slate-400">trace_id: <span className="font-mono">{lastTraceId}</span></p> : null}
      {provenance?.timeline?.length ? (
        <details className="rounded border border-cyan-300/15 bg-slate-950/45 p-2 text-[11px] text-slate-200">
          <summary className="cursor-pointer font-semibold text-cyan-100">Historial del registro</summary>
          <ul className="mt-2 v3-space-y-1">
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
          <p id="sun-token-modal-title" className="font-semibold text-emerald-100">Registro digital opcional · sujeto a confirmación</p>
          <p className="mt-1 text-slate-300">{tokenModalCopy}</p>
          <ul className="mt-2 list-disc pl-4 text-[11px] text-slate-300">
            <li>Solicitarlo es opcional y está sujeto a la política de la marca, documentación y confirmación de la transacción.</li>
            <li>La lectura NFC y la consulta del producto siguen disponibles sin este registro.</li>
          </ul>
          <input suppressHydrationWarning
            ref={emailInputRef}
            value={leadEmail}
            onChange={(event) => setLeadEmail(event.target.value)}
            placeholder="Email de contacto"
            aria-label="Email de contacto"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(leadEmail.trim()) && !isEmailValid}
            className="mt-2 w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-white"
          />
          {leadEmail.trim() && !isEmailValid ? <p className="mt-1 text-[11px] text-rose-300">Ingresá un email válido para guardar el interés.</p> : null}
          <div className="mt-2 flex gap-2">
            <button suppressHydrationWarning disabled={pending || !leadEmail.trim() || !isEmailValid} onClick={() => void saveTokenizationLead()} className="rounded border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">{getButtonLabel("Guardar interés", "tokenization")}</button>
            <button suppressHydrationWarning onClick={() => setShowTokenModal(false)} className="rounded border border-white/20 px-3 py-1 text-white">Cerrar</button>
          </div>
          {leadSaved ? <p className="mt-2 text-emerald-300">Solicitud registrada para revisión.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
