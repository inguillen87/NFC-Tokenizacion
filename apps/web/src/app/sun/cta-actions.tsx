"use client";

import { useEffect, useRef, useState } from "react";
import { isSecurePostTapActionAllowed, type SecurePostTapActionKey } from "./post-tap-policy";
import { selectSunTruthCopy, SUN_DEMO_COPY } from "./sun-truth-copy";

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
type Props = { bid: string; uid?: string; eventId?: string; freshToken?: string; canExecute?: boolean; tapState?: TapState; rightsPolicy?: RightsPolicy; allowedActions?: string[]; blockedActions?: string[]; isDemoPreview?: boolean };
type ActionState = "idle" | "loading" | "success" | "error";
type ActionKey = SecurePostTapActionKey;
type CallResponse = {
  ok?: boolean;
  reason?: string;
  error?: string;
  code?: string;
  mode?: string;
  deliveryChannel?: string;
  ttlMinutes?: number;
  next_step?: string;
  status?: string | null;
  request_status?: string | null;
  provenance?: string | { mode?: string | null; status?: string | null } | null;
  warranty?: { status?: string | null } | null;
  ticket?: { id?: string | number | null; status?: string | null } | null;
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
type ReceiptOcrUiState = {
  mode: "live_confirmed" | "demo_mock" | "unavailable";
  confirmed: boolean;
  provider: string | null;
  model: string | null;
  score: number;
  extractionReady: boolean;
  authorizationConfirmed: boolean;
  message: string;
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

function normalizeClaimAuthError(error: unknown) {
  const message = normalizeUnknownError(error);
  if (message.includes("email_contact_required")) return "Este modo envia codigos por email. Usa un email valido o activa SMS/WhatsApp para telefonos.";
  if (message.includes("phone_contact_required")) return "Este modo envia codigos a celular. Usa un telefono con codigo de pais o cambia a email OTP.";
  if (message.includes("resend_api_key_missing") || message.includes("consumer_auth_from_email_missing")) return "Falta configurar el envio de emails OTP. Carga RESEND_API_KEY y CONSUMER_AUTH_FROM_EMAIL en el API.";
  if (message.includes("twilio_credentials_missing") || message.includes("twilio_sender_missing")) return "Falta configurar Twilio SMS/WhatsApp. Carga TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y un sender.";
  if (message.includes("twilio_delivery_failed")) return "Twilio no pudo entregar el codigo. Revisa que el numero este en formato internacional y habilitado para pruebas.";
  if (message.includes("resend_delivery_failed")) return "No se pudo enviar el email OTP. Revisa dominio/from verificado en Resend.";
  if (message.includes("rate_limited")) return "Demasiados intentos. Espera unos minutos y volve a probar.";
  return message;
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

async function getClientMetadata() {
  let lat: number | null = null;
  let lng: number | null = null;
  let acc: number | null = null;

  try {
    if (typeof window !== "undefined" && window.navigator && window.navigator.geolocation) {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        window.navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 0,
        });
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
      acc = position.coords.accuracy;
    }
  } catch (error) {
    console.warn("Geolocation gathering failed or denied", error);
  }

  const fingerprint = {
    language: typeof navigator !== "undefined" ? navigator.language : "",
    platform: typeof navigator !== "undefined" ? (navigator as any).platform || "" : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    screenWidth: typeof window !== "undefined" ? window.screen?.width || 0 : 0,
    screenHeight: typeof window !== "undefined" ? window.screen?.height || 0 : 0,
    touchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0,
  };

  return {
    latitude: lat,
    longitude: lng,
    accuracy: acc,
    screenSize: {
      width: typeof window !== "undefined" ? window.innerWidth || 0 : 0,
      height: typeof window !== "undefined" ? window.innerHeight || 0 : 0,
    },
    deviceFingerprint: fingerprint,
  };
}

export function CtaActions({ bid, uid = "", eventId = "", freshToken = "", canExecute = true, tapState = "valid", rightsPolicy, allowedActions = [], blockedActions = [], isDemoPreview = false }: Props) {
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
  const [claimAuthOpen, setClaimAuthOpen] = useState(false);
  const [claimContact, setClaimContact] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [claimAuthStarted, setClaimAuthStarted] = useState(false);
  const [claimAuthMode, setClaimAuthMode] = useState("");
  const [claimAuthMessage, setClaimAuthMessage] = useState("");
  const [claimAuthError, setClaimAuthError] = useState("");
  const [claimAuthLoading, setClaimAuthLoading] = useState(false);

  // States for user session & receipt uploads
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [consumerData, setConsumerData] = useState<any>(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptFileName, setReceiptFileName] = useState("");
  const [receiptFileData, setReceiptFileData] = useState("");
  const [receiptEstablishment, setReceiptEstablishment] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [receiptTime, setReceiptTime] = useState("");
  const [receiptPrice, setReceiptPrice] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrVerification, setOcrVerification] = useState<ReceiptOcrUiState | null>(null);
  const [securityPin, setSecurityPin] = useState("");
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const tokenModalRef = useRef<HTMLDivElement | null>(null);
  const tokenActionButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.trim());
  const normalizedClaimContact = claimContact.trim();
  const claimContactLooksEmail = normalizedClaimContact.includes("@");
  const claimPhoneDigits = normalizedClaimContact.replace(/\D/g, "");
  const isClaimContactValid = claimContactLooksEmail
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedClaimContact)
    : claimPhoneDigits.length >= 8 && claimPhoneDigits.length <= 15;
  const isClaimCodeValid = claimCode.trim().length >= 4;
  const tokenPolicy = String(rightsPolicy?.tokenizationPolicy || "").toLowerCase();
  const claimMode = String(rightsPolicy?.claimMode || "").toLowerCase();
  const policySummary = rightsPolicy?.consumerCopy || "";
  const policyAllowsAction = (actionKey: ActionKey) => isSecurePostTapActionAllowed(
    actionKey,
    allowedActions,
    blockedActions,
  );
  const canStartClaim = canExecute && policyAllowsAction("claimOwnership");
  const ownerClaimState = !canStartClaim
    ? "Protegido"
    : isAuthenticated
      ? "Canal confirmado"
      : claimAuthStarted
        ? "Código enviado"
        : "Listo para iniciar";
  const ownerClaimTone = canStartClaim ? "text-emerald-100 border-emerald-300/30 bg-emerald-500/10" : "text-amber-100 border-amber-300/30 bg-amber-500/10";
  const ownerClaimSteps = [
    {
      label: selectSunTruthCopy(isDemoPreview, SUN_DEMO_COPY.claimTapLabel, "Evidencia NFC fresca"),
      state: selectSunTruthCopy(isDemoPreview, SUN_DEMO_COPY.claimTapState, canExecute ? "OK" : "Requerido"),
    },
    { label: "Política del lote", state: policyAllowsAction("claimOwnership") ? "Habilitada" : "No habilitada" },
    { label: "Email o celular", state: claimAuthStarted ? "Codigo enviado" : "Pendiente" },
    { label: "Ticket / POS", state: claimMode.includes("purchase") || claimMode.includes("review") ? "Revisable" : "Opcional" },
  ];
  const primaryCtaLabel = !canExecute
    ? "Necesito una nueva lectura NFC"
    : !policyAllowsAction("claimOwnership")
      ? "Registro de comprador no habilitado"
      : claimAuthStarted
        ? "Confirmar codigo"
        : "Iniciar validacion de compra";
  const primaryCtaHelp = !canExecute
    ? "Por seguridad, este link solo muestra la prueba. Para garantia, wallet o tokenizacion, toca la etiqueta otra vez."
    : !policyAllowsAction("claimOwnership")
      ? "La politica de este producto no permite claim publico. Usa solamente las opciones habilitadas abajo."
      : "Confirmamos el canal de contacto y revisamos la prueba de compra antes de activar garantia, wallet, NFT o marketplace.";
  const tokenSubtitle = tokenPolicy === "issuer_transfer"
    ? "Tokenizacion por transferencia del issuer: requiere prueba documental antes del mint."
    : tokenPolicy === "lot_anchor"
      ? "Ancla de lote: solicita registrar evidencia declarada del lifecycle sin prometer origen fisico ni ownership individual."
      : tokenPolicy === "manual_review"
        ? "Solicitud a revision: el tenant aprueba antes de mintear en Polygon."
        : "Solicitud disponible despues de validar comprador: UID hasheado, salt privado y confirmacion Polygon solo si existe receipt real.";
  const realGatedCopy = tapState === "blocked"
    ? "Propiedad, garantia y tokenizacion quedan bloqueadas hasta que el backend valide evidencia NFC reciente; eso no prueba el producto fisico."
    : policySummary || (tapState === "opened"
      ? "El tag reporto TT abierto. Su significado fisico depende de la integracion al packaging; las acciones siguen la politica de la marca."
      : "Mensaje SUN reciente validado por el backend. La ficha queda disponible; compra, propiedad y beneficios requieren validaciones separadas.");
  const gatedCopy = selectSunTruthCopy(isDemoPreview, SUN_DEMO_COPY.gatedActions, realGatedCopy);
  const realTokenModalCopy = tokenPolicy === "issuer_transfer"
    ? "El token se solicita como transferencia del issuer: no se mintea propiedad publica sin prueba de compra o autorizacion."
    : tokenPolicy === "lot_anchor"
      ? "Una transaccion on-chain confirmada puede registrar hashes de eventos declarados del lote; no prueba por si sola origen fisico, recorrido ni ownership individual."
      : tokenPolicy === "manual_review"
        ? "La solicitud queda en revision comercial antes de mintear. Es ideal para pharma, cosmetica o casos con riesgo regulatorio."
        : tapState === "opened"
    ? "Una transaccion confirmada puede registrar el estado TT reportado y claims aprobados de propiedad o provenance; no prueba por si sola una apertura fisica ni el contenido."
    : "Una transaccion confirmada puede registrar claims aprobados de propiedad, provenance o garantia; no prueba por si sola custodia ni contenido fisico.";
  const tokenModalCopy = selectSunTruthCopy(isDemoPreview, SUN_DEMO_COPY.tokenModal, realTokenModalCopy);
  const actionMeta: Record<string, { title: string; subtitle: string; icon: string; path: string; method: "POST" | "GET"; tone: string }> = {
    claimOwnership: {
      title: "Validar comprador",
      subtitle: "Confirma el canal de contacto y revisa la prueba de compra antes de aprobar propiedad o garantia.",
      icon: "BUY",
      path: "/api/public-cta/claim-ownership",
      method: "POST",
      tone: "border-indigo-300/40 bg-indigo-500/10 text-indigo-100 transition hover:bg-indigo-500/20",
    },
    registerWarranty: {
      title: "Solicitar revisión de garantía",
      subtitle: "Registra una solicitud para revisión de cobertura, postventa y fecha declarada de compra.",
      icon: "WAR",
      path: "/api/public-cta/register-warranty",
      method: "POST",
      tone: "border-violet-300/40 bg-violet-500/10 text-violet-100 transition hover:bg-violet-500/20",
    },
    provenance: {
      title: "Ver provenance",
      subtitle: "Consulta origen y ruta declarados, eventos del tenant y evidencia tecnica.",
      icon: "PRO",
      path: "/api/public-cta/provenance",
      method: "GET",
      tone: "border-amber-300/40 bg-amber-500/10 text-amber-100 transition hover:bg-amber-500/20",
    },
    report: {
      title: "Reportar problema",
      subtitle: "Envía un reporte si el tap, replay o estado TT parecen inconsistentes; el equipo confirma luego si abre un ticket.",
      icon: "RPT",
      path: "/api/public-cta/report-problem",
      method: "POST",
      tone: "border-rose-300/40 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/20",
    }
  };
  const successCopy: Record<ActionKey, string> = {
    claimOwnership: "Registro de comprador aprobado y asociado al tenant.",
    registerWarranty: "Solicitud de garantía registrada · pendiente de revisión.",
    provenance: "Provenance consultada correctamente.",
    tokenization: "Solicitud de tokenizacion registrada. No hay NFT confirmado hasta recibir tx, receipt y token ID verificables.",
    report: "Reporte recibido · todavía no es un ticket confirmado.",
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
    if (actionKey === "claimOwnership") {
      const ownershipStatus = String(data.ownership_status || data.ownership?.status || "").toLowerCase();
      return ownershipStatus === "claimed"
        ? successCopy.claimOwnership
        : "Solicitud de comprador registrada. La propiedad y la garantia esperan el estado aprobado del backend.";
    }
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
        ? "Garantía confirmada por el backend para postventa."
        : successCopy.registerWarranty;
    }
    if (actionKey === "report") {
      const hasConfirmedTicket = Boolean(data.ticket?.id) && confirmedStatuses.has(responseStatus);
      return hasConfirmedTicket
        ? "Ticket confirmado por el backend para revisar el tap."
        : successCopy.report;
    }
    if (actionKey !== "tokenization") return successCopy[actionKey];
    return tokenizationUiResult(data).message;
  }

  function renderStateBadge(actionKey: ActionKey) {
    const state = actionStates[actionKey];
    if (!policyAllowsAction(actionKey) && state === "idle") {
      return <span className="rounded-full border border-slate-400/30 bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-200">No habilitada</span>;
    }
    if (!canExecute && SECURITY_GATED_ACTIONS.has(actionKey) && state === "idle") {
      return <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">Requiere tap</span>;
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
    return pending || !policyAllowsAction(actionKey) || (!canExecute && SECURITY_GATED_ACTIONS.has(actionKey));
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

  // Load consumer session on mount to detect authenticated users
  useEffect(() => {
    fetch("/api/consumer/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.authenticated) {
          setIsAuthenticated(true);
          setConsumerData(data.consumer || null);
        }
      })
      .catch(() => {});
  }, []);

  function normalizeReason(data: { reason?: string; error?: string; _httpStatus?: number }) {
    if (data.error) return data.error;
    const reason = String(data.reason || "").toLowerCase();
    if (reason.includes("consumer_auth_required")) {
      return "Para iniciar la validacion de compra o solicitar un NFT necesitamos confirmar un email o celular. El producto queda visible, pero no se asocia a nadie solo por confirmar ese canal.";
    }
    if (reason.includes("ownership_claim_required")) {
      return "Primero completa la validacion de compra segun la politica de la marca. Despues se habilita la solicitud NFT y la conexion de wallet.";
    }
    if (reason.includes("fresh") || reason.includes("physical") || reason.includes("expired")) {
      return "Para propiedad, garantia o tokenizacion necesitamos evidencia NFC reciente validada por el backend. Volve a leer la etiqueta NFC.";
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
    if (!policyAllowsAction(actionKey)) {
      setActionError("La politica de este producto no habilita esta accion. Revisa las opciones disponibles para este lote.");
      return;
    }
    if (!canExecute && SECURITY_GATED_ACTIONS.has(actionKey)) {
      setActionError("Este tap no habilita propiedad, garantia ni tokenizacion. Escanea nuevamente la etiqueta fisica.");
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
      let extraPayload: Record<string, unknown> | undefined;
      if (actionKey === "claimOwnership") {
        const meta = await getClientMetadata();
        extraPayload = {
          ...meta,
          receiptDate: receiptDate || null,
          receiptTime: receiptTime || null,
          receiptPrice: receiptPrice ? Number(receiptPrice) : null,
          receiptEstablishment: receiptEstablishment || null,
          receiptFileName: receiptFileName || null,
          receiptFileData: receiptFileData || null,
          pin: securityPin || null,
        };
      }
      const data = await call(path, method, basePayload(extraPayload));
      setStatus(JSON.stringify(data));
      if (data._traceId) setLastTraceId(data._traceId);
      if ((actionKey === "claimOwnership" || actionKey === "tokenization") && requiresConsumerAuth(data)) {
        setClaimAuthOpen(true);
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
        if (actionKey === "claimOwnership") {
          // Ocultar formulario de ticket de compra tras éxito
          setShowReceiptForm(false);
        }
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

  async function startClaimAuth() {
    if (!isClaimContactValid || claimAuthLoading) return;
    setClaimAuthLoading(true);
    setClaimAuthError("");
    setClaimAuthMessage("");
    try {
      const payload = claimContactLooksEmail
        ? { email: normalizedClaimContact }
        : { phone: normalizedClaimContact };
      const data = await call("/api/consumer/auth/start", "POST", payload);
      if (!data._httpOk || data.ok === false) {
        throw new Error(String(data.error || data.reason || "auth_start_failed"));
      }
      setClaimAuthStarted(true);
      setClaimAuthMode(String(data.mode || "otp"));
      const channel = String(data.deliveryChannel || (claimContactLooksEmail ? "email" : "sms"));
      setClaimAuthMessage(channel === "email"
          ? "Codigo enviado por email. Ingresalo para confirmar el canal y continuar con la validacion de compra."
          : channel === "whatsapp"
            ? "Codigo enviado por WhatsApp. Ingresalo para confirmar el canal y continuar con la validacion de compra."
            : "Codigo enviado por SMS. Ingresalo para confirmar el canal y continuar con la validacion de compra.");
    } catch (error) {
      setClaimAuthError(normalizeClaimAuthError(error));
    } finally {
      setClaimAuthLoading(false);
    }
  }

  async function verifyClaimAuthAndRetry() {
    if (!isClaimContactValid || !isClaimCodeValid || claimAuthLoading) return;
    setClaimAuthLoading(true);
    setClaimAuthError("");
    setClaimAuthMessage("");
    try {
      const payload = claimContactLooksEmail
        ? { email: normalizedClaimContact, code: claimCode.trim() }
        : { phone: normalizedClaimContact, code: claimCode.trim() };
      const data = await call("/api/consumer/auth/verify", "POST", payload);
      if (!data._httpOk || data.ok === false) {
        throw new Error(String(data.error || data.reason || "auth_verify_failed"));
      }
      setClaimAuthOpen(false);
      setClaimAuthStarted(false);
      setClaimCode("");
      setClaimAuthMessage("");
      
      setIsAuthenticated(true);
      if (data.consumer) {
        setConsumerData(data.consumer);
      }
      
      setShowReceiptForm(true);
      setLastActionMessage("Canal de contacto confirmado. Subi tu comprobante para continuar con la validacion de compra.");
    } catch (error) {
      setClaimAuthError(normalizeClaimAuthError(error));
    } finally {
      setClaimAuthLoading(false);
    }
  }

  function retryLastAction() {
    if (!lastRequest || pending) return;
    void trigger(lastRequest.path, lastRequest.method, lastRequest.actionKey);
  }

  function handlePrimaryClaimAction() {
    if (!canStartClaim) {
      if (canExecute && !policyAllowsAction("claimOwnership")) {
        setActionError("La politica de este producto no permite un claim publico. Usa una opcion habilitada para el lote.");
        return;
      }
      setActionError("Para activar comprador, garantia o propiedad necesitamos una nueva lectura NFC validada por el backend.");
      return;
    }
    if (claimAuthStarted) {
      void verifyClaimAuthAndRetry();
      return;
    }
    if (!isAuthenticated) {
      setClaimAuthOpen(true);
      return;
    }
    setShowReceiptForm(true);
  }

  return (
    <div className="sun-public-cta mt-4 space-y-2">
      {rightsPolicy ? (
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-2 text-[11px] text-cyan-100">
          Politica: propiedad {labelPolicy(rightsPolicy.claimMode)} · token {labelPolicy(rightsPolicy.tokenizationPolicy)} · marketplace {labelPolicy(rightsPolicy.marketplaceMode)}
        </div>
      ) : null}
      
      <div className={`rounded-2xl border p-4 ${ownerClaimTone} space-y-4`}>
        {showReceiptForm ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Validacion de compra</p>
                <h3 className="text-sm font-black text-white">Comprobante de Compra (Ticket/Factura)</h3>
              </div>
              <button
                suppressHydrationWarning
                type="button"
                onClick={() => setShowReceiptForm(false)}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-200 border border-white/10 rounded px-2 py-0.5"
              >
                Cancelar
              </button>
            </div>
            
            <p className="text-[11px] text-slate-300">
              Para revisar la evidencia de compra antes de habilitar garantia, propiedad o tokenizacion NFT, subi tu ticket y completa los datos.
              <span className="block mt-1 text-[10px] text-cyan-300/90 font-medium">
                La ubicacion GPS y el canal de contacto son señales auxiliares de auditoria. No prueban identidad, compra ni ubicacion fisica del producto por si solos.
              </span>
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* File Uploader */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-300 block">Foto de Comprobante / Ticket</label>
                <div className="relative border border-dashed border-white/20 rounded-xl p-3 flex flex-col items-center justify-center bg-slate-950/40 hover:border-cyan-400/50 transition">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={ocrLoading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setReceiptFileName(file.name);
                        setOcrLoading(true);
                        setOcrVerification(null);
                        const reader = new FileReader();
                        reader.onload = async (evt) => {
                          if (evt.target?.result) {
                            const base64 = evt.target.result as string;
                            setReceiptFileData(base64);

                            try {
                              console.log("[OCR] Digitalizando comprobante con IA...");
                              const response = await fetch("/api/public-cta/receipt-ocr", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  bid,
                                  uid_hex: uid,
                                  event_id: eventId,
                                  receiptFileData: base64,
                                  receiptFileName: file.name,
                                }),
                              });

                              const data = await response.json().catch(() => ({}));
                              if (data.ocr) {
                                const ocr = data.ocr as Record<string, any>;
                                const provenance = ocr.provenance && typeof ocr.provenance === "object"
                                  ? ocr.provenance as Record<string, any>
                                  : {};
                                const mode = ["live_confirmed", "demo_mock", "unavailable"].includes(String(provenance.mode))
                                  ? String(provenance.mode) as ReceiptOcrUiState["mode"]
                                  : "unavailable";
                                const score = Number.isFinite(Number(ocr.compliance_score)) ? Number(ocr.compliance_score) : 0;
                                const extractionReady = Boolean(
                                  response.ok
                                  && data.ok
                                  && mode === "live_confirmed"
                                  && provenance.confirmed === true
                                  && provenance.provider
                                  && provenance.model,
                                );
                                const purchaseAuthorization = data.purchase_authorization && typeof data.purchase_authorization === "object"
                                  ? data.purchase_authorization as Record<string, any>
                                  : {};
                                const authorizationConfirmed = Boolean(
                                  response.ok
                                  && data.ok
                                  && ["approved", "confirmed"].includes(String(purchaseAuthorization.status).toLowerCase())
                                  && ["signed_pos", "tenant_manual_approval"].includes(String(purchaseAuthorization.source).toLowerCase()),
                                );
                                const message = extractionReady
                                  ? `Datos extraídos por ${String(provenance.provider)} con ${String(provenance.model)}. Revisalos: OCR no valida pago, producto ni titularidad.`
                                  : mode === "demo_mock"
                                    ? "Extracción simulada de demo. No valida el comprobante ni habilita propiedad."
                                    : mode === "live_confirmed"
                                      ? String(data.error || "El OCR respondió, pero los datos requieren revisión manual.")
                                      : String(data.error || "No se completó la extracción OCR. Reintentá o solicitá revisión manual.");
                                setOcrVerification({
                                  mode,
                                  confirmed: provenance.confirmed === true,
                                  provider: typeof provenance.provider === "string" ? provenance.provider : null,
                                  model: typeof provenance.model === "string" ? provenance.model : null,
                                  score,
                                  extractionReady,
                                  authorizationConfirmed,
                                  message,
                                });
                                if (extractionReady) {
                                  if (ocr.establishment) setReceiptEstablishment(ocr.establishment);
                                  if (ocr.date) setReceiptDate(ocr.date);
                                  if (ocr.time) setReceiptTime(ocr.time);
                                  if (ocr.price) setReceiptPrice(String(ocr.price));
                                }
                              } else {
                                setOcrVerification({
                                  mode: "unavailable",
                                  confirmed: false,
                                  provider: null,
                                  model: null,
                                  score: 0,
                                  extractionReady: false,
                                  authorizationConfirmed: false,
                                  message: String(data.error || "No se pudo extraer el comprobante. Reintentá o solicitá revisión manual."),
                                });
                              }
                            } catch (err) {
                              console.warn("[OCR] Error de escaneo IA:", err);
                            } finally {
                              setOcrLoading(false);
                            }
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  {ocrLoading ? (
                    <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                      <span className="text-[10px] text-cyan-300 font-medium animate-pulse">Digitalizando con IA...</span>
                    </div>
                  ) : receiptFileData ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2">
                        <img src={receiptFileData} className="w-8 h-8 object-cover rounded border border-white/10" alt="Preview" />
                        <span className="text-[10px] font-mono text-emerald-300 max-w-[120px] truncate">{receiptFileName}</span>
                      </div>
                      {ocrVerification && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                          ocrVerification.extractionReady
                            ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20 shadow-[0_0_8px_rgba(34,211,238,0.12)]"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                        }`}>
                          {ocrVerification.extractionReady
                            ? `Datos extraídos por OCR (score de lectura ${ocrVerification.score}%)`
                            : ocrVerification.mode === "demo_mock"
                              ? "Extracción demo simulada · no habilita propiedad"
                              : "Revisión manual requerida"}
                        </span>
                      )}
                      {ocrVerification ? (
                        <span className="max-w-[240px] text-center text-[9px] leading-4 text-slate-400">{ocrVerification.message}</span>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <span className="text-xs text-slate-400">📁 Seleccionar o tomar foto</span>
                      <span className="text-[9px] text-slate-500">JPG, PNG</span>
                    </>
                  )}
                </div>
              </div>

              {/* Establecimiento */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-300 block">Establecimiento / Vinoteca</label>
                <input
                  type="text"
                  placeholder="Ej: Vinoteca Mendoza, Online Shop"
                  value={receiptEstablishment}
                  onChange={(e) => setReceiptEstablishment(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400/40"
                />
              </div>

              {/* Fecha de Compra */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-300 block">Fecha de Compra</label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/40"
                />
              </div>

              {/* Hora de Compra */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-300 block">Hora de Compra</label>
                <input
                  type="time"
                  value={receiptTime}
                  onChange={(e) => setReceiptTime(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/40"
                />
              </div>

              {/* Precio */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-300 block">Precio Pagado (USD / ARS)</label>
                <input
                  type="number"
                  placeholder="Ej: 45.00"
                  value={receiptPrice}
                  onChange={(e) => setReceiptPrice(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400/40"
                />
              </div>

              {/* WhatsApp como DNI */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-300 block">DNI Digital Vinculado (Contacto)</label>
                <input
                  type="text"
                  disabled
                  value={consumerData?.phone || consumerData?.email || "Canal de contacto confirmado"}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-400 outline-none font-mono"
                />
              </div>
            </div>

            <button
              suppressHydrationWarning
              type="button"
              disabled={pending || !ocrVerification?.authorizationConfirmed || !receiptEstablishment.trim() || !receiptDate || !receiptPrice || !receiptFileData}
              onClick={() => void trigger("/api/public-cta/claim-ownership", "POST", "claimOwnership")}
              className="mt-3 w-full rounded-xl border border-emerald-300/35 bg-emerald-400 px-4 py-3 text-xs font-black text-slate-950 shadow-[0_16px_40px_rgba(16,185,129,0.22)] hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 transition"
            >
              {pending ? "Procesando autorizacion..." : ocrVerification?.authorizationConfirmed ? "Enviar autorización y activar beneficios" : "Esperando aprobación tenant / POS firmado"}
            </button>
            {!ocrVerification?.authorizationConfirmed ? (
              <p className="text-[10px] text-amber-300 text-center">
                * OCR solo extrae campos y un score de lectura. No valida pago, producto ni titularidad: la propiedad sigue bloqueada hasta recibir aprobación manual del tenant o un comprobante POS firmado.
              </p>
            ) : !receiptFileData || !receiptEstablishment.trim() || !receiptDate || !receiptPrice ? (
              <p className="text-[10px] text-amber-300 text-center">
                * Para mayor seguridad, todos los campos y la foto del ticket son obligatorios.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">Tu producto, tu cuenta</p>
                <h3 className="mt-1 text-sm font-black text-white">Alta segura de comprador</h3>
                <p className="mt-1 text-[11px] leading-5 opacity-85">
                  {selectSunTruthCopy(isDemoPreview, SUN_DEMO_COPY.claimIntro, "El tap fisico demuestra acceso al tag en ese instante. El canal de contacto confirmado y el comprobante se evaluan por separado antes de habilitar garantia, beneficios o propiedad segun la politica de la marca.")}
                </p>
              </div>
              <div className="shrink-0 rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-right">
                <span className="block text-[10px] uppercase tracking-[0.12em] opacity-70">Estado</span>
                <strong className="text-xs text-white">{ownerClaimState}</strong>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {ownerClaimSteps.map((step) => (
                <div key={step.label} className="rounded-xl border border-white/10 bg-slate-950/35 p-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">{step.label}</p>
                  <span className="mt-1 block text-[11px] font-bold text-white">
                    {step.label.includes("celular") && isAuthenticated
                      ? "Canal confirmado"
                      : step.label.includes("Ticket") && showReceiptForm
                      ? "En carga"
                      : step.state}
                  </span>
                </div>
              ))}
            </div>
            <button
              suppressHydrationWarning
              type="button"
              disabled={!canStartClaim || pending || claimAuthLoading || (claimAuthStarted && !isClaimCodeValid)}
              onClick={handlePrimaryClaimAction}
              className="sun-primary-claim-button mt-3 w-full rounded-xl border border-emerald-300/35 bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_16px_40px_rgba(16,185,129,0.22)] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending || claimAuthLoading ? "Procesando..." : primaryCtaLabel}
            </button>
            <p className="mt-2 text-[11px] leading-5 opacity-85">{primaryCtaHelp}</p>
          </>
        )}
      </div>

      <details open={!policyAllowsAction("claimOwnership") && policyAllowsAction("registerWarranty")} className="sun-advanced-actions rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-xs">
        <summary className="cursor-pointer text-sm font-black text-slate-100">Opciones avanzadas para marca, garantia y NFT</summary>
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
            <p className="text-sm font-semibold"><span className="sun-public-cta-code">NFT</span> Solicitar NFT / token{actionStates.tokenization === "loading" ? <span className="ml-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-200" /> : null}</p>
            {renderStateBadge("tokenization")}
          </div>
          <p className="mt-1 text-[11px] text-emerald-50/80">{tokenSubtitle}</p>
        </button>
        </div>
      </details>
      <p className="sun-cta-tip text-[11px] text-slate-300">{gatedCopy}</p>
      {pending ? <p className="text-xs text-cyan-200" aria-live="polite">Ejecutando acción...</p> : null}
      {lastActionMessage ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-2 text-xs text-emerald-100" aria-live="polite">{lastActionMessage}</p> : null}
      {actionError ? <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-xs text-rose-100" aria-live="assertive">{actionError}</p> : null}
      
      {claimAuthOpen ? (
        <div className="rounded-2xl border border-cyan-300/25 bg-slate-950/80 p-3 text-xs text-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Validacion de compra</p>
              <h3 className="mt-1 text-sm font-black text-white">Confirma tu WhatsApp o Email</h3>
              <p className="mt-1 text-[11px] leading-5 text-slate-300">
                El codigo solo confirma el canal de contacto. La botella no se asocia a una cuenta ni propiedad sin comprobante aprobado y politica de marca.
              </p>
            </div>
            <button suppressHydrationWarning type="button" onClick={() => setClaimAuthOpen(false)} className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-slate-200">
              Cerrar
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1.1fr_0.9fr_auto]">
            <input
              suppressHydrationWarning
              value={claimContact}
              onChange={(event) => setClaimContact(event.target.value)}
              placeholder="WhatsApp (+54...) o Email"
              className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-300/50"
            />
            <input
              suppressHydrationWarning
              value={claimCode}
              onChange={(event) => setClaimCode(event.target.value)}
              placeholder={claimAuthStarted ? "Codigo recibido" : "Codigo"}
              className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-300/50"
            />
            <button
              suppressHydrationWarning
              type="button"
              disabled={claimAuthLoading || !isClaimContactValid}
              onClick={() => claimAuthStarted ? void verifyClaimAuthAndRetry() : void startClaimAuth()}
              className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-2 font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {claimAuthLoading ? "Validando..." : claimAuthStarted ? "Confirmar" : "Enviar codigo"}
            </button>
          </div>
          {!isClaimContactValid && normalizedClaimContact ? <p className="mt-2 text-[11px] text-amber-200">Usa un email valido o un celular con codigo de pais.</p> : null}
          {claimAuthMode ? <p className="mt-2 text-[11px] text-slate-400">Modo de verificacion: {claimAuthMode}</p> : null}
          {claimAuthMessage ? <p className="mt-2 text-[11px] text-cyan-100">{claimAuthMessage}</p> : null}
          {claimAuthError ? <p className="mt-2 rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-[11px] text-rose-100">{claimAuthError}</p> : null}
          
        </div>
      ) : null}
      {lastTraceId ? <p className="text-[11px] text-slate-400">trace_id: <span className="font-mono">{lastTraceId}</span></p> : null}
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
          <p id="sun-token-modal-title" className="font-semibold text-emerald-100">Blockchain opcional · sujeta a confirmacion</p>
          <p className="mt-1 text-slate-300">{tokenModalCopy}</p>
          <ul className="mt-2 list-disc pl-4 text-[11px] text-slate-300">
            <li>Uso enterprise: registros declarados de provenance o garantia y solicitudes de transferencia sujetas a politica, evidencia y confirmacion on-chain.</li>
            <li>Infra opcional: smart contracts / blockchain solo cuando hay ROI claro.</li>
            <li>Core digital: validacion de mensajes NFC, trazabilidad declarada y señales anti-replay o de riesgo.</li>
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
