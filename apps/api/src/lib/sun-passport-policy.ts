export type PassportAction =
  | "claim"
  | "save"
  | "join"
  | "warranty"
  | "rewards"
  | "tokenization"
  | "provenance";

export type PassportVerdict =
  | "valid"
  | "valid_opened"
  | "replay_suspect"
  | "tampered"
  | "revoked"
  | "not_active"
  | "not_registered"
  | "invalid";

export type PassportConditionState =
  | "sealed"
  | "opened_verified"
  | "tamper_review"
  | "replay_blocked"
  | "revoked"
  | "setup_required"
  | "inactive"
  | "unregistered"
  | "invalid"
  | "unknown";

export type PassportVertical =
  | "wine"
  | "spirits"
  | "cosmetics"
  | "pharma"
  | "luxury"
  | "art"
  | "events"
  | "agro"
  | "documents"
  | "generic";

type ClaimMode =
  | "purchase_or_custody_proof"
  | "retailer_or_seller_attested"
  | "issuer_transfer_required"
  | "inside_pack_secret"
  | "admin_review"
  | "not_public";

type MarketplaceMode =
  | "club_and_reorder"
  | "care_and_warranty"
  | "regulated_consultation"
  | "secondary_market_ready"
  | "issuer_private"
  | "ticket_activation"
  | "lot_traceability"
  | "proof_only";

type VerticalPolicy = {
  label: string;
  sealedActions: PassportAction[];
  openedActions: PassportAction[];
  tokenizationWhenSealed: "fresh_valid_tap" | "manual_review" | "issuer_transfer" | "lot_anchor" | "off";
  tokenizationWhenOpened: "verified_opened_tap" | "manual_review" | "issuer_transfer" | "lot_anchor" | "off";
  claimMode: ClaimMode;
  marketplaceMode: MarketplaceMode;
  requires: string[];
  sealedCopy: string;
  openedCopy: string;
};

const ALL_COMMERCIAL_ACTIONS: PassportAction[] = ["claim", "save", "join", "warranty", "rewards", "tokenization"];
const PROVENANCE_ONLY: PassportAction[] = ["provenance"];

const BASE_ACTIONS: Record<"consumer" | "regulated" | "issuer" | "event" | "lot", PassportAction[]> = {
  consumer: ["claim", "save", "join", "warranty", "rewards", "tokenization", "provenance"],
  regulated: ["save", "warranty", "provenance"],
  issuer: ["save", "provenance"],
  event: ["claim", "save", "join", "rewards", "provenance"],
  lot: ["save", "join", "warranty", "rewards", "tokenization", "provenance"],
};

const VERTICAL_POLICIES: Record<PassportVertical, VerticalPolicy> = {
  wine: {
    label: "Vino / bebidas premium",
    sealedActions: BASE_ACTIONS.consumer,
    openedActions: BASE_ACTIONS.consumer,
    tokenizationWhenSealed: "fresh_valid_tap",
    tokenizationWhenOpened: "verified_opened_tap",
    claimMode: "purchase_or_custody_proof",
    marketplaceMode: "club_and_reorder",
    requires: ["tap fisico fresco", "prueba de compra o custodia", "tenant activo", "anti-replay OK"],
    sealedCopy: "Producto autentico con sello intacto: ideal para ownership, garantia, club, rewards y tokenizacion opcional.",
    openedCopy: "Sello abierto verificado: no es fraude por si solo; queda como evento de lifecycle y puede habilitar ownership post-compra.",
  },
  spirits: {
    label: "Spirits / botella seriada",
    sealedActions: BASE_ACTIONS.consumer,
    openedActions: BASE_ACTIONS.consumer,
    tokenizationWhenSealed: "fresh_valid_tap",
    tokenizationWhenOpened: "verified_opened_tap",
    claimMode: "purchase_or_custody_proof",
    marketplaceMode: "club_and_reorder",
    requires: ["tap fisico fresco", "prueba de compra o custodia", "estado de sello registrado"],
    sealedCopy: "Botella autenticada y cerrada: maxima confianza para propiedad, garantia y experiencias.",
    openedCopy: "Apertura verificada: conserva trazabilidad y puede activar club, garantia o ownership de consumo.",
  },
  cosmetics: {
    label: "Cosmetica / beauty",
    sealedActions: ["claim", "save", "join", "warranty", "rewards", "provenance"],
    openedActions: ["claim", "save", "join", "warranty", "rewards", "provenance"],
    tokenizationWhenSealed: "manual_review",
    tokenizationWhenOpened: "manual_review",
    claimMode: "purchase_or_custody_proof",
    marketplaceMode: "care_and_warranty",
    requires: ["tap fisico fresco", "lote activo", "prueba de compra para garantia premium"],
    sealedCopy: "Producto cosmetico autentico: se habilitan garantia, cuidado postventa, club y promociones.",
    openedCopy: "Apertura valida para postventa: el sello abierto dispara lifecycle, garantia y cuidado, no una alerta automatica.",
  },
  pharma: {
    label: "Pharma / regulado",
    sealedActions: BASE_ACTIONS.regulated,
    openedActions: ["warranty", "provenance"],
    tokenizationWhenSealed: "manual_review",
    tokenizationWhenOpened: "off",
    claimMode: "retailer_or_seller_attested",
    marketplaceMode: "regulated_consultation",
    requires: ["dispensa o retailer attestation", "politica regulatoria del tenant", "sin replay"],
    sealedCopy: "Unidad regulada verificable: trazabilidad y consulta seguras; ownership publico requiere attestation.",
    openedCopy: "Producto regulado abierto: la consulta sigue visible, pero claim/tokenizacion publica quedan protegidos.",
  },
  luxury: {
    label: "Lujo / coleccionable",
    sealedActions: BASE_ACTIONS.consumer,
    openedActions: BASE_ACTIONS.consumer,
    tokenizationWhenSealed: "fresh_valid_tap",
    tokenizationWhenOpened: "verified_opened_tap",
    claimMode: "issuer_transfer_required",
    marketplaceMode: "secondary_market_ready",
    requires: ["tap fisico fresco", "proof of purchase o transferencia del issuer", "revision ante inconsistencias"],
    sealedCopy: "Activo premium autenticado: ownership y tokenizacion deben quedar atados a compra o transferencia del issuer.",
    openedCopy: "Condicion alterada pero autenticidad vigente: se registra lifecycle y puede transferirse si hay prueba de titularidad.",
  },
  art: {
    label: "Arte / certificado",
    sealedActions: ["claim", "save", "warranty", "tokenization", "provenance"],
    openedActions: ["claim", "save", "warranty", "tokenization", "provenance"],
    tokenizationWhenSealed: "issuer_transfer",
    tokenizationWhenOpened: "issuer_transfer",
    claimMode: "issuer_transfer_required",
    marketplaceMode: "secondary_market_ready",
    requires: ["issuer transfer", "provenance documentada", "revision si cambia condicion fisica"],
    sealedCopy: "Obra o certificado autentico: ownership y tokenizacion requieren transferencia del issuer o prueba documental.",
    openedCopy: "Cambio de condicion registrado: no invalida autenticidad, pero exige trazabilidad y posible revision.",
  },
  events: {
    label: "Eventos / credenciales",
    sealedActions: BASE_ACTIONS.event,
    openedActions: BASE_ACTIONS.event,
    tokenizationWhenSealed: "off",
    tokenizationWhenOpened: "off",
    claimMode: "inside_pack_secret",
    marketplaceMode: "ticket_activation",
    requires: ["tap fisico fresco", "reglas server-side", "no replay"],
    sealedCopy: "Credencial valida: prioriza check-in, acceso, rewards y antifraude operativo.",
    openedCopy: "Credencial usada o revalidada: se mantiene la trazabilidad; tokenizacion no es necesaria por defecto.",
  },
  agro: {
    label: "Agro / lote trazable",
    sealedActions: BASE_ACTIONS.lot,
    openedActions: BASE_ACTIONS.lot,
    tokenizationWhenSealed: "lot_anchor",
    tokenizationWhenOpened: "lot_anchor",
    claimMode: "retailer_or_seller_attested",
    marketplaceMode: "lot_traceability",
    requires: ["lote activo", "operador o distribuidor autorizado", "tap fresco para acciones comerciales"],
    sealedCopy: "Lote autentico: origen, cadena logistica, garantia y tokenizacion de lote quedan disponibles.",
    openedCopy: "Packaging abierto o intervenido: se registra como evento logistico; ownership depende de operador autorizado.",
  },
  documents: {
    label: "Docs / presencia",
    sealedActions: ["save", "tokenization", "provenance"],
    openedActions: ["save", "tokenization", "provenance"],
    tokenizationWhenSealed: "issuer_transfer",
    tokenizationWhenOpened: "issuer_transfer",
    claimMode: "issuer_transfer_required",
    marketplaceMode: "issuer_private",
    requires: ["issuer autorizado", "identidad de holder", "politica de privacidad"],
    sealedCopy: "Documento verificable: consulta y holder privado, sin claim publico salvo emisor autorizado.",
    openedCopy: "Documento consultado: se preserva privacidad; ownership/tokenizacion solo por flujo del issuer.",
  },
  generic: {
    label: "Producto fisico verificado",
    sealedActions: BASE_ACTIONS.consumer,
    openedActions: BASE_ACTIONS.consumer,
    tokenizationWhenSealed: "fresh_valid_tap",
    tokenizationWhenOpened: "verified_opened_tap",
    claimMode: "purchase_or_custody_proof",
    marketplaceMode: "proof_only",
    requires: ["tap fisico fresco", "tenant activo", "anti-replay OK"],
    sealedCopy: "Producto autentico: se habilitan passport, provenance y acciones comerciales segun politica del tenant.",
    openedCopy: "Sello abierto verificado: se registra lifecycle y las acciones dependen de compra/custodia.",
  },
};

function uniqueActions(actions: PassportAction[]) {
  return Array.from(new Set(actions));
}

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function readBoolean(record: Record<string, unknown> | null | undefined, key: string) {
  return Boolean(record && record[key] === true);
}

export function normalizePassportVertical(value: unknown): PassportVertical {
  const raw = normalizeText(value);
  if (!raw) return "generic";
  if (["vino", "bodega", "winery"].includes(raw)) return "wine";
  if (["spirits", "destilados", "whisky", "tequila", "gin"].includes(raw)) return "spirits";
  if (["cosmetica", "beauty", "perfume", "fragrance", "cosmetic"].includes(raw)) return "cosmetics";
  if (["medicamento", "laboratorio", "lab", "healthcare", "medicine"].includes(raw)) return "pharma";
  if (["lujo", "jewelry", "watch", "reloj", "joyeria", "fashion"].includes(raw)) return "luxury";
  if (["arte", "art", "gallery", "certificate"].includes(raw)) return "art";
  if (["event", "eventos", "tickets", "ticket", "credential", "credentials"].includes(raw)) return "events";
  if (["seed", "crop", "campo", "agriculture", "agro"].includes(raw)) return "agro";
  if (["docs", "documents", "documentos", "presence", "identity"].includes(raw)) return "documents";
  return (Object.keys(VERTICAL_POLICIES) as PassportVertical[]).includes(raw as PassportVertical)
    ? raw as PassportVertical
    : "generic";
}

export function mapVerdictAndRisk(input: { statusCode: string; productState: string | null; reason: string; encPlainStatusByte?: string | null }) {
  const code = String(input.statusCode || "").toUpperCase();
  const state = String(input.productState || "").toUpperCase();
  const reason = String(input.reason || "").toUpperCase();
  const statusByte = String(input.encPlainStatusByte || "").toUpperCase();
  if (code === "REVOKED" || reason.includes("REVOKED")) return { verdict: "revoked" as const, riskLevel: "critical" as const };
  if (code === "REPLAY_SUSPECT" || state === "REPLAY_SUSPECT" || reason.includes("REPLAY") || reason.includes("COPIED URL")) {
    return { verdict: "replay_suspect" as const, riskLevel: "high" as const };
  }
  if (code === "TAMPER_RISK" || state === "TAMPER_RISK" || reason.includes("TAMPER_RISK") || reason.includes("INVALID_TAMPER")) {
    return { verdict: "tampered" as const, riskLevel: "high" as const };
  }
  if (
    code === "OPENED"
    || code === "OPENED_PREVIOUSLY"
    || code === "MANUAL_OPENED"
    || state === "VALID_OPENED"
    || state === "VALID_OPENED_PREVIOUSLY"
    || state === "VALID_MANUAL_OPENED"
    || statusByte === "4F"
    || reason.includes("OPENED")
  ) {
    return { verdict: "valid_opened" as const, riskLevel: "low" as const };
  }
  if (code === "VALID" || code === "AUTH_OK" || state === "VALID_CLOSED" || state === "VALID_UNKNOWN_TAMPER" || statusByte === "43") {
    return { verdict: "valid" as const, riskLevel: "none" as const };
  }
  if (code === "TENANT_SETUP_REQUIRED") return { verdict: "not_active" as const, riskLevel: "medium" as const };
  if (code === "NOT_ACTIVE") return { verdict: "not_active" as const, riskLevel: "medium" as const };
  if (code === "NOT_REGISTERED") return { verdict: "not_registered" as const, riskLevel: "medium" as const };
  return { verdict: "invalid" as const, riskLevel: "medium" as const };
}

export function resolveConditionState(input: {
  verdict: PassportVerdict | string;
  statusCode?: string | null;
  productState?: string | null;
  reason?: string | null;
  encPlainStatusByte?: string | null;
}): PassportConditionState {
  const verdict = String(input.verdict || "").toLowerCase();
  const code = String(input.statusCode || "").toUpperCase();
  const state = String(input.productState || "").toUpperCase();
  const reason = String(input.reason || "").toUpperCase();
  const statusByte = String(input.encPlainStatusByte || "").toUpperCase();
  if (code === "TENANT_SETUP_REQUIRED") return "setup_required";
  if (verdict === "replay_suspect" || code === "REPLAY_SUSPECT" || reason.includes("REPLAY") || reason.includes("COPIED URL")) return "replay_blocked";
  if (verdict === "revoked" || code === "REVOKED") return "revoked";
  if (verdict === "tampered" || code === "TAMPER_RISK" || state === "TAMPER_RISK") return "tamper_review";
  if (verdict === "valid_opened" || statusByte === "4F" || state.includes("OPENED") || ["OPENED", "OPENED_PREVIOUSLY", "MANUAL_OPENED"].includes(code)) return "opened_verified";
  if (verdict === "valid" || statusByte === "43" || state === "VALID_CLOSED" || ["VALID", "AUTH_OK"].includes(code)) return "sealed";
  if (verdict === "not_active" || code === "NOT_ACTIVE") return "inactive";
  if (verdict === "not_registered" || code === "NOT_REGISTERED") return "unregistered";
  if (verdict === "invalid" || code === "INVALID") return "invalid";
  return "unknown";
}

function blockedFromAllowed(allowed: PassportAction[]) {
  const allowedSet = new Set(allowed);
  return ALL_COMMERCIAL_ACTIONS.filter((action) => !allowedSet.has(action));
}

function applyTenantTokenizationMode(
  allowed: PassportAction[],
  policy: VerticalPolicy,
  mode: string | null | undefined,
  conditionState: PassportConditionState,
) {
  const rawMode = normalizeText(mode || "");
  const isOpened = conditionState === "opened_verified";
  const preset = isOpened ? policy.tokenizationWhenOpened : policy.tokenizationWhenSealed;
  if ((rawMode && ["manual", "off", "disabled", "none"].includes(rawMode)) || preset === "off") {
    return allowed.filter((action) => action !== "tokenization");
  }
  if (rawMode === "valid_only" && isOpened) return allowed.filter((action) => action !== "tokenization");
  return allowed;
}

function normalizeClaimMode(policy: VerticalPolicy, claimPolicy?: string | null): ClaimMode {
  const raw = normalizeText(claimPolicy);
  if (raw === "retailer_attested" || raw === "seller_attested") return "retailer_or_seller_attested";
  if (raw === "inside_pack_secret" || raw === "inside_code") return "inside_pack_secret";
  if (raw === "admin_approved" || raw === "manual_review") return "admin_review";
  if (raw === "issuer_transfer_required" || raw === "issuer_transfer") return "issuer_transfer_required";
  if (raw === "not_public" || raw === "private") return "not_public";
  return policy.claimMode;
}

function resolveTokenizationPolicy(policy: VerticalPolicy, conditionState: PassportConditionState, allowed: PassportAction[]) {
  if (!allowed.includes("tokenization")) {
    if (conditionState === "replay_blocked") return "blocked_replay";
    if (conditionState === "tamper_review") return "blocked_tamper_review";
    if (conditionState === "setup_required") return "blocked_tenant_setup";
    if (conditionState === "opened_verified") return "blocked_opened_policy";
    return "blocked_policy";
  }
  return conditionState === "opened_verified" ? policy.tokenizationWhenOpened : policy.tokenizationWhenSealed;
}

export function resolveRightsPolicy(input: {
  verdict: PassportVerdict | string;
  vertical?: string | null;
  tokenizationMode?: string | null;
  claimPolicy?: string | null;
  ownershipPolicy?: Record<string, unknown> | null;
  statusCode?: string | null;
  productState?: string | null;
  reason?: string | null;
  encPlainStatusByte?: string | null;
}) {
  const vertical = normalizePassportVertical(input.vertical);
  const policy = VERTICAL_POLICIES[vertical];
  const conditionState = resolveConditionState(input);
  const claimMode = normalizeClaimMode(policy, input.claimPolicy);
  const hardBlocked = ["replay_blocked", "tamper_review", "revoked", "setup_required", "inactive", "unregistered", "invalid"].includes(conditionState);
  let allowedActions = hardBlocked
    ? PROVENANCE_ONLY
    : conditionState === "opened_verified"
      ? policy.openedActions
      : policy.sealedActions;

  allowedActions = applyTenantTokenizationMode(uniqueActions(allowedActions), policy, input.tokenizationMode, conditionState);
  if (readBoolean(input.ownershipPolicy, "requiresIssuerTransfer") && !["issuer_transfer_required", "admin_review"].includes(claimMode)) {
    allowedActions = allowedActions.filter((action) => action !== "claim" || vertical === "art" || vertical === "luxury");
  }
  if (readBoolean(input.ownershipPolicy, "allowsPublicClaim") === false && claimMode === "not_public") {
    allowedActions = allowedActions.filter((action) => !["claim", "rewards", "tokenization"].includes(action));
  }

  allowedActions = uniqueActions(["provenance", ...allowedActions]);
  const blockedActions = blockedFromAllowed(allowedActions);
  const tokenizationPolicy = resolveTokenizationPolicy(policy, conditionState, allowedActions);
  const isOpened = conditionState === "opened_verified";
  const isSealed = conditionState === "sealed";
  const canClaimPublicly = allowedActions.includes("claim") && claimMode !== "not_public";
  const requirements = uniqueStringList([
    ...policy.requires,
    readBoolean(input.ownershipPolicy, "requiresPurchaseProof") ? "purchase proof" : "",
    readBoolean(input.ownershipPolicy, "requiresTenantMembership") ? "membresia o login consumidor" : "",
    readBoolean(input.ownershipPolicy, "requiresRetailerAttestation") ? "retailer attestation" : "",
  ]);

  const statusTitle = hardBlocked
    ? conditionState === "replay_blocked"
      ? "Replay bloqueado"
      : conditionState === "tamper_review"
        ? "Tap en revision"
        : conditionState === "setup_required"
          ? "Onboarding pendiente"
          : "Accion protegida"
    : isOpened
      ? "Autentico con sello abierto"
      : isSealed
        ? "Autentico con sello intacto"
        : "Autenticidad verificable";

  const statusSummary = hardBlocked
    ? "La trazabilidad sigue visible, pero las acciones comerciales quedan bloqueadas hasta resolver la politica de seguridad."
    : isOpened
      ? policy.openedCopy
      : policy.sealedCopy;

  return {
    vertical,
    verticalLabel: policy.label,
    conditionState,
    claimMode,
    marketplaceMode: policy.marketplaceMode,
    tokenizationPolicy,
    allowedActions,
    blockedActions,
    requirements,
    canClaimPublicly,
    canTokenize: allowedActions.includes("tokenization"),
    requiresReview: hardBlocked || claimMode === "admin_review" || tokenizationPolicy === "manual_review" || tokenizationPolicy === "issuer_transfer",
    statusTitle,
    statusSummary,
    consumerCopy: statusSummary,
    enterpriseCopy: buildEnterpriseCopy(policy, claimMode, tokenizationPolicy, requirements),
    recommendedNextStep: buildRecommendedNextStep(conditionState, policy, claimMode, tokenizationPolicy),
  };
}

function buildEnterpriseCopy(policy: VerticalPolicy, claimMode: ClaimMode, tokenizationPolicy: string, requirements: string[]) {
  return `${policy.label}: claim=${claimMode}, token=${tokenizationPolicy}, requisitos=${requirements.slice(0, 4).join(" + ")}.`;
}

function buildRecommendedNextStep(
  conditionState: PassportConditionState,
  policy: VerticalPolicy,
  claimMode: ClaimMode,
  tokenizationPolicy: string,
) {
  if (conditionState === "replay_blocked") return "Escanear fisicamente otra vez: la URL anterior queda solo como evidencia.";
  if (conditionState === "tamper_review") return "Abrir ticket de revision antes de habilitar ownership o tokenizacion.";
  if (conditionState === "setup_required") return "Completar tenant SUN profile, manifiesto y ownership policy.";
  if (claimMode === "retailer_or_seller_attested") return "Pedir attestation del vendedor antes de transferir ownership.";
  if (claimMode === "issuer_transfer_required") return "Validar proof of purchase o transferencia del issuer.";
  if (tokenizationPolicy === "manual_review") return "Guardar lead y tokenizar solo si el tenant aprueba el caso.";
  return policy.marketplaceMode === "club_and_reorder"
    ? "Habilitar passport, club y marketplace despues de login o prueba de compra."
    : "Continuar con el flujo comercial configurado para el rubro.";
}

function uniqueStringList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function resolveActionMatrix(
  verdict: PassportVerdict | string,
  context?: Omit<Parameters<typeof resolveRightsPolicy>[0], "verdict">,
): { allowedActions: PassportAction[]; blockedActions: PassportAction[] } {
  const decision = resolveRightsPolicy({ ...(context || {}), verdict });
  return {
    allowedActions: decision.allowedActions,
    blockedActions: decision.blockedActions,
  };
}
