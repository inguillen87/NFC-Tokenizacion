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
  | "sun_profile_mismatch"
  | "tampered"
  | "revoked"
  | "not_active"
  | "not_registered"
  | "invalid";

export type PassportConditionState =
  | "sealed"
  | "authenticated_no_tamper"
  | "opened_verified"
  | "tamper_review"
  | "sun_profile_mismatch"
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
    requires: ["tap físico reciente", "prueba de compra o custodia", "tenant activo", "control anti-replay correcto"],
    sealedCopy: "Mensaje SUN del chip validado y sello registrado como intacto. El tap identifica la etiqueta digital; no certifica por sí solo el contenido, el origen físico ni la propiedad de la botella. Club, custodia y certificado dependen de la política de la bodega y de la evidencia requerida.",
    openedCopy: "Mensaje SUN del chip validado y apertura del sello registrada. El tap no certifica por sí solo el contenido, el origen físico ni la propiedad de la botella. Club, puntos y custodia dependen de la política de la bodega y de la evidencia requerida.",
  },
  spirits: {
    label: "Spirits / botella seriada",
    sealedActions: BASE_ACTIONS.consumer,
    openedActions: BASE_ACTIONS.consumer,
    tokenizationWhenSealed: "fresh_valid_tap",
    tokenizationWhenOpened: "verified_opened_tap",
    claimMode: "purchase_or_custody_proof",
    marketplaceMode: "club_and_reorder",
    requires: ["tap físico reciente", "prueba de compra o custodia", "estado del sello registrado"],
    sealedCopy: "Mensaje SUN del chip validado y sello registrado como cerrado. La evidencia corresponde a la etiqueta digital y no prueba por sí sola el contenido, el origen físico ni la propiedad de la botella. Garantía y experiencias dependen de la política del emisor.",
    openedCopy: "Mensaje SUN del chip validado y apertura del sello registrada. La evidencia no confirma por sí sola el contenido ni una cadena de custodia completa. Club, consumo y custodia se registran según la política del emisor.",
  },
  cosmetics: {
    label: "Cosmética / belleza",
    sealedActions: ["claim", "save", "join", "warranty", "rewards", "provenance"],
    openedActions: ["claim", "save", "join", "warranty", "rewards", "provenance"],
    tokenizationWhenSealed: "manual_review",
    tokenizationWhenOpened: "manual_review",
    claimMode: "purchase_or_custody_proof",
    marketplaceMode: "care_and_warranty",
    requires: ["tap físico reciente", "lote activo", "prueba de compra para garantía premium"],
    sealedCopy: "Mensaje SUN del chip validado y etiqueta asociada a un lote activo. El tap no verifica por sí solo la fórmula, el contenido ni el origen físico del cosmético. Garantía, cuidado y promociones dependen de la política de la marca.",
    openedCopy: "Mensaje SUN del chip validado y apertura registrada para esta etiqueta. El tap no verifica por sí solo la fórmula ni el contenido del envase. Garantía y soporte dependen de la política de la marca y de la prueba de compra cuando corresponda.",
  },
  pharma: {
    label: "Pharma / regulado",
    sealedActions: BASE_ACTIONS.regulated,
    openedActions: ["warranty", "provenance"],
    tokenizationWhenSealed: "manual_review",
    tokenizationWhenOpened: "off",
    claimMode: "retailer_or_seller_attested",
    marketplaceMode: "regulated_consultation",
    requires: ["constancia de dispensa o del vendedor", "política regulatoria del tenant", "sin replay"],
    sealedCopy: "Mensaje SUN del chip validado y empaque registrado como cerrado. El tap identifica la etiqueta digital; no valida por sí solo la composición, el estado sanitario ni la cadena de custodia completa del medicamento. Consultá el prospecto y los registros del emisor.",
    openedCopy: "Mensaje SUN del chip validado y apertura del empaque registrada. La consulta conserva la identidad digital y los eventos disponibles, pero no valida por sí sola la composición, el estado sanitario ni la cadena de custodia completa.",
  },
  luxury: {
    label: "Lujo / coleccionables",
    sealedActions: BASE_ACTIONS.consumer,
    openedActions: BASE_ACTIONS.consumer,
    tokenizationWhenSealed: "fresh_valid_tap",
    tokenizationWhenOpened: "verified_opened_tap",
    claimMode: "issuer_transfer_required",
    marketplaceMode: "secondary_market_ready",
    requires: ["tap físico reciente", "prueba de compra o transferencia del emisor", "revisión ante inconsistencias"],
    sealedCopy: "Mensaje SUN del chip validado y etiqueta vinculada a un registro digital. El tap no demuestra por sí solo la originalidad física ni la propiedad del artículo. Certificado y transferencia requieren validación del emisor y la evidencia definida.",
    openedCopy: "Mensaje SUN del chip validado y cambio de estado del sello registrado. La originalidad física y la propiedad no se desprenden únicamente del tap; cualquier registro o transferencia requiere comprobante y validación del emisor.",
  },
  art: {
    label: "Arte / certificado",
    sealedActions: ["claim", "save", "warranty", "tokenization", "provenance"],
    openedActions: ["claim", "save", "warranty", "tokenization", "provenance"],
    tokenizationWhenSealed: "issuer_transfer",
    tokenizationWhenOpened: "issuer_transfer",
    claimMode: "issuer_transfer_required",
    marketplaceMode: "secondary_market_ready",
    requires: ["transferencia del emisor", "procedencia documentada", "revisión si cambia la condición física"],
    sealedCopy: "Mensaje SUN del chip validado y etiqueta vinculada a un registro digital de la obra o certificado. El tap no acredita por sí solo autoría, autenticidad física, procedencia ni propiedad; esas afirmaciones requieren documentación y validación del emisor.",
    openedCopy: "Mensaje SUN del chip validado y modificación de estado registrada. El historial digital disponible se conserva, pero el tap no confirma por sí solo autoría, autenticidad física, procedencia ni propiedad de la obra.",
  },
  events: {
    label: "Eventos / credenciales",
    sealedActions: BASE_ACTIONS.event,
    openedActions: BASE_ACTIONS.event,
    tokenizationWhenSealed: "off",
    tokenizationWhenOpened: "off",
    claimMode: "inside_pack_secret",
    marketplaceMode: "ticket_activation",
    requires: ["tap físico reciente", "reglas del servidor", "sin replay"],
    sealedCopy: "Mensaje SUN de la credencial validado. El acceso, el check-in y los beneficios dependen de las reglas del servidor; el tap no acredita por sí solo la identidad de la persona portadora.",
    openedCopy: "Mensaje SUN validado y uso o revalidación registrados. El historial disponible corresponde a la credencial digital; el acceso y los beneficios siguen sujetos a las reglas del servidor.",
  },
  agro: {
    label: "Agro / lote con trazabilidad",
    sealedActions: BASE_ACTIONS.lot,
    openedActions: BASE_ACTIONS.lot,
    tokenizationWhenSealed: "lot_anchor",
    tokenizationWhenOpened: "lot_anchor",
    claimMode: "retailer_or_seller_attested",
    marketplaceMode: "lot_traceability",
    requires: ["lote activo", "operador o distribuidor autorizado", "tap reciente para acciones comerciales"],
    sealedCopy: "Mensaje SUN del chip validado y etiqueta asociada a un lote activo. El tap no prueba por sí solo el contenido, el origen físico ni una cadena logística completa; esos datos dependen de registros del emisor y de operadores autorizados.",
    openedCopy: "Mensaje SUN del chip validado y apertura o intervención del empaque registrada. El evento se incorpora al historial disponible; contenido, origen, custodia y cadena logística requieren evidencia adicional de operadores autorizados.",
  },
  documents: {
    label: "Documentos / presencia",
    sealedActions: ["save", "tokenization", "provenance"],
    openedActions: ["save", "tokenization", "provenance"],
    tokenizationWhenSealed: "issuer_transfer",
    tokenizationWhenOpened: "issuer_transfer",
    claimMode: "issuer_transfer_required",
    marketplaceMode: "issuer_private",
    requires: ["emisor autorizado", "identidad del titular", "política de privacidad"],
    sealedCopy: "Mensaje SUN del chip validado y etiqueta vinculada a un registro documental. El tap no acredita por sí solo la validez jurídica, la identidad del titular ni la propiedad; la consulta y cualquier transferencia dependen del emisor autorizado.",
    openedCopy: "Consulta de la etiqueta registrada con su mensaje SUN validado. La privacidad y los datos disponibles se rigen por el emisor; titularidad, validez jurídica y transferencia requieren el flujo autorizado.",
  },
  generic: {
    label: "Producto físico con identidad digital",
    sealedActions: BASE_ACTIONS.consumer,
    openedActions: BASE_ACTIONS.consumer,
    tokenizationWhenSealed: "fresh_valid_tap",
    tokenizationWhenOpened: "verified_opened_tap",
    claimMode: "purchase_or_custody_proof",
    marketplaceMode: "proof_only",
    requires: ["tap físico reciente", "tenant activo", "control anti-replay correcto"],
    sealedCopy: "Mensaje SUN del chip validado y sello registrado como intacto cuando el tag lo informa. El tap identifica la etiqueta digital; no certifica por sí solo el contenido, el origen físico ni la propiedad del producto. Las acciones dependen de la política del tenant.",
    openedCopy: "Mensaje SUN del chip validado y apertura del sello registrada. El tap no certifica por sí solo el contenido, el origen físico ni la propiedad del producto; las acciones dependen de la política del tenant y de la evidencia requerida.",
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

export function mapVerdictAndRisk(input: { statusCode: string; productState: string | null; reason: string }) {
  const code = String(input.statusCode || "").toUpperCase();
  const state = String(input.productState || "").toUpperCase();
  const reason = String(input.reason || "").toUpperCase();
  if (
    code === "SUN_BATCH_DUPLICATE_CONFIG"
    || state === "SUN_BATCH_DUPLICATE_CONFIG"
  ) {
    return { verdict: "invalid" as const, riskLevel: "critical" as const };
  }
  if (
    code === "SUN_PROFILE_MISMATCH"
    || reason.includes("UID LENGTH INVALID")
    || reason.includes("CMAC MISMATCH")
    || reason.includes("PICC_DATA BAD LENGTH")
    || reason.includes("INVALID_SUN_PAYLOAD")
    || reason.includes("SUN_CRYPTO_FAILED")
    || reason.includes("CRYPTO_DECODE_FAILED")
  ) {
    return { verdict: "sun_profile_mismatch" as const, riskLevel: "medium" as const };
  }
  if (code === "REVOKED" || reason.includes("REVOKED")) return { verdict: "revoked" as const, riskLevel: "critical" as const };
  if (code === "REPLAY_SUSPECT" || state === "REPLAY_SUSPECT" || reason.includes("REPLAY") || reason.includes("COPIED URL")) {
    return { verdict: "replay_suspect" as const, riskLevel: "high" as const };
  }
  if (code === "TAMPER_RISK" || state === "TAMPER_RISK" || reason.includes("TAMPER_RISK") || reason.includes("INVALID_TAMPER")) {
    return { verdict: "tampered" as const, riskLevel: "high" as const };
  }
  if (
    code === "VALID_OPENED"
    || code === "VALID_OPENED_PREVIOUSLY"
    || code === "OPENED"
    || code === "OPENED_PREVIOUSLY"
    || code === "MANUAL_OPENED"
    || state === "VALID_OPENED"
    || state === "VALID_OPENED_PREVIOUSLY"
    || state === "VALID_MANUAL_OPENED"
    || reason.includes("OPENED")
  ) {
    return { verdict: "valid_opened" as const, riskLevel: "low" as const };
  }
  if (code === "VALID" || code === "VALID_AUTHENTIC" || code === "VALID_CLOSED" || code === "VALID_UNKNOWN_TAMPER" || code === "AUTH_OK" || state === "VALID_AUTHENTIC" || state === "VALID_CLOSED" || state === "VALID_UNKNOWN_TAMPER") {
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
}): PassportConditionState {
  const verdict = String(input.verdict || "").toLowerCase();
  const code = String(input.statusCode || "").toUpperCase();
  const state = String(input.productState || "").toUpperCase();
  const reason = String(input.reason || "").toUpperCase();
  if (
    code === "SUN_BATCH_DUPLICATE_CONFIG"
    || state === "SUN_BATCH_DUPLICATE_CONFIG"
  ) {
    return "sun_profile_mismatch";
  }
  if (
    code === "SUN_PROFILE_MISMATCH"
    || verdict === "sun_profile_mismatch"
    || reason.includes("UID LENGTH INVALID")
    || reason.includes("CMAC MISMATCH")
    || reason.includes("PICC_DATA BAD LENGTH")
    || reason.includes("INVALID_SUN_PAYLOAD")
    || reason.includes("SUN_CRYPTO_FAILED")
    || reason.includes("CRYPTO_DECODE_FAILED")
  ) {
    return "sun_profile_mismatch";
  }
  if (code === "TENANT_SETUP_REQUIRED") return "setup_required";
  if (verdict === "replay_suspect" || code === "REPLAY_SUSPECT" || reason.includes("REPLAY") || reason.includes("COPIED URL")) return "replay_blocked";
  if (verdict === "revoked" || code === "REVOKED") return "revoked";
  if (verdict === "tampered" || code === "TAMPER_RISK" || state === "TAMPER_RISK") return "tamper_review";
  if (verdict === "valid_opened" || state.includes("OPENED") || ["VALID_OPENED", "VALID_OPENED_PREVIOUSLY", "OPENED", "OPENED_PREVIOUSLY", "MANUAL_OPENED"].includes(code)) return "opened_verified";
  if (state === "VALID_UNKNOWN_TAMPER") return "unknown";
  if (state === "VALID_AUTHENTIC" || code === "VALID_AUTHENTIC") return "authenticated_no_tamper";
  if (verdict === "valid" || state === "VALID_CLOSED" || ["VALID", "VALID_CLOSED", "AUTH_OK"].includes(code)) return "sealed";
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
    if (conditionState === "sun_profile_mismatch") return "blocked_sun_profile_mismatch";
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
}) {
  const vertical = normalizePassportVertical(input.vertical);
  const policy = VERTICAL_POLICIES[vertical];
  const conditionState = resolveConditionState(input);
  const claimMode = normalizeClaimMode(policy, input.claimPolicy);
  const hardBlocked = ["replay_blocked", "sun_profile_mismatch", "tamper_review", "revoked", "setup_required", "inactive", "unregistered", "invalid"].includes(conditionState);
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
      : conditionState === "sun_profile_mismatch"
        ? "No pudimos validar esta lectura"
      : conditionState === "tamper_review"
        ? "Tap en revisión"
        : conditionState === "setup_required"
          ? "Onboarding pendiente"
          : "Acción protegida"
    : isOpened
      ? "Mensaje SUN válido · apertura registrada"
      : conditionState === "authenticated_no_tamper"
        ? "Autenticidad criptográfica confirmada · sin sello electrónico"
      : isSealed
        ? "Mensaje SUN válido · sello registrado"
        : "Evidencia digital disponible";

  const statusSummary = hardBlocked
    ? conditionState === "sun_profile_mismatch"
      ? "El lote fue detectado, pero esta lectura no coincide con el perfil de seguridad cargado. Las acciones comerciales quedan bloqueadas."
      : "El historial digital disponible sigue visible, pero las acciones comerciales quedan bloqueadas hasta resolver la política de seguridad."
    : isOpened
      ? policy.openedCopy
      : conditionState === "authenticated_no_tamper"
        ? "Autenticidad criptográfica confirmada. Este producto no usa sello electrónico de apertura."
      : conditionState === "unknown"
        ? "Mensaje SUN del chip validado. Este lote no informa el estado de apertura; el tap no certifica por sí solo el contenido, el origen físico ni la propiedad del producto."
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
  if (conditionState === "sun_profile_mismatch") return "Revisar claves/layout SUN del batch antes de habilitar acciones comerciales.";
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
