export const AGRO_DPP_PROFILE_VERSION = "agro-dpp-v1" as const;
export const OFFLINE_VERIFICATION_PENDING_COPY = "Sin conexión. La información pública está disponible. La autenticidad criptográfica se confirmará al recuperar conexión.";

export const AGRO_EXPERIENCE_EVENT_TYPES = [
  "PRODUCT_VIEWED",
  "TECHNICAL_SHEET_VIEWED",
  "SAFETY_SHEET_VIEWED",
  "PPE_CONTENT_VIEWED",
  "STEWARDSHIP_CONFIRMED",
  "CROPWISE_CTA_CLICKED",
  "ADVISOR_CONTACT_REQUESTED",
  "LOYALTY_OFFER_VIEWED",
  "LOYALTY_JOINED",
  "TRAINING_STARTED",
  "TRAINING_COMPLETED",
  "LEAD_CREATED",
  "PROBLEM_REPORTED",
] as const;

export type AgroExperienceEventType = (typeof AGRO_EXPERIENCE_EVENT_TYPES)[number];

export type AgroDppProfile = {
  schemaVersion: typeof AGRO_DPP_PROFILE_VERSION;
  productName: string | null;
  brand: string | null;
  sku: string | null;
  gtin: string | null;
  crop: string | null;
  seedVariety: string | null;
  productFamily: string | null;
  activeIngredient: string | null;
  formulation: string | null;
  registrationNumber: string | null;
  batchLot: string | null;
  productionDate: string | null;
  expirationDate: string | null;
  distributor: string | null;
  authorizedChannel: string | null;
  technicalSheetUrl: string | null;
  safetySheetUrl: string | null;
  ppe: { summary: string | null; items: string[] };
  stewardship: { summary: string | null; items: string[] };
  cropwiseUrl: string | null;
  support: { label: string | null; url: string | null; email: string | null; phone: string | null };
  trainingUrl: string | null;
  loyaltyUrl: string | null;
  recallStatusUrl: string | null;
};

const BLOCKED_STATES = ["REPLAY_SUSPECT", "SUN_PROFILE_MISMATCH", "NOT_REGISTERED", "NOT_ACTIVE"] as const;
const TRUSTED_NFC_STATES = new Set([
  "VALID",
  "VALID_AUTHENTIC",
  "VALID_CLOSED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_UNKNOWN_TAMPER",
]);
const TRUSTED_VERDICTS = new Set(["VALID", "VALID_OPENED"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, maxLength = 240) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return normalized || null;
}

function list(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, 180)).filter((item): item is string => Boolean(item)).slice(0, 12);
}

function httpsUrl(value: unknown) {
  const raw = text(value, 2_048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function email(value: unknown) {
  const normalized = text(value, 254)?.toLowerCase() || null;
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function phone(value: unknown) {
  const normalized = text(value, 40);
  return normalized && /^\+?[0-9(). -]{7,40}$/.test(normalized) ? normalized : null;
}

export function normalizeAgroDppProfile(value: unknown): AgroDppProfile | null {
  const source = record(value);
  if (!Object.keys(source).length) return null;
  const ppe = record(source.ppe);
  const stewardship = record(source.stewardship);
  const support = record(source.support);
  const profile: AgroDppProfile = {
    schemaVersion: AGRO_DPP_PROFILE_VERSION,
    productName: text(source.productName, 160),
    brand: text(source.brand, 160),
    sku: text(source.sku, 120),
    gtin: /^\d{14}$/.test(String(source.gtin || "")) ? String(source.gtin) : null,
    crop: text(source.crop, 120),
    seedVariety: text(source.seedVariety, 160),
    productFamily: text(source.productFamily, 160),
    activeIngredient: text(source.activeIngredient, 240),
    formulation: text(source.formulation, 160),
    registrationNumber: text(source.registrationNumber, 160),
    batchLot: text(source.batchLot, 160),
    productionDate: text(source.productionDate, 40),
    expirationDate: text(source.expirationDate, 40),
    distributor: text(source.distributor, 200),
    authorizedChannel: text(source.authorizedChannel, 200),
    technicalSheetUrl: httpsUrl(source.technicalSheetUrl),
    safetySheetUrl: httpsUrl(source.safetySheetUrl),
    ppe: { summary: text(ppe.summary, 600), items: list(ppe.items) },
    stewardship: { summary: text(stewardship.summary, 1_000), items: list(stewardship.items) },
    cropwiseUrl: httpsUrl(source.cropwiseUrl),
    support: {
      label: text(support.label, 160),
      url: httpsUrl(support.url),
      email: email(support.email),
      phone: phone(support.phone),
    },
    trainingUrl: httpsUrl(source.trainingUrl),
    loyaltyUrl: httpsUrl(source.loyaltyUrl),
    recallStatusUrl: httpsUrl(source.recallStatusUrl),
  };
  return profile;
}

export function resolveAgroSensitiveActionGate(input: {
  statusCode?: unknown;
  productState?: unknown;
  verdict?: unknown;
  riskLevel?: unknown;
  isOffline?: boolean;
  isQr?: boolean;
  isFreshTap?: boolean;
  manualPolicyAuthorized?: boolean;
}) {
  const stateSignals = [input.statusCode, input.productState]
    .map((value) => String(value || "").trim().toUpperCase());
  const verdict = String(input.verdict || "").trim().toUpperCase();
  const blockedState = BLOCKED_STATES.find((state) => [...stateSignals, verdict].some((signal) => signal === state || signal.includes(state))) || null;
  if (input.isOffline) return { allowed: false as const, reason: "VERIFICATION_PENDING" };
  if (blockedState) return { allowed: false as const, reason: blockedState };
  if (["HIGH", "CRITICAL"].includes(String(input.riskLevel || "").toUpperCase())) {
    return { allowed: false as const, reason: "RISK_BLOCKED" };
  }
  if (input.isQr) return { allowed: false as const, reason: "NOT_CRYPTOGRAPHICALLY_AUTHENTICATED" };
  if (!input.isFreshTap) return { allowed: false as const, reason: "FRESH_TAP_REQUIRED" };
  const manualState = stateSignals.some((signal) => ["VALID_MANUAL_OPENED", "MANUAL_OPENED"].includes(signal));
  if (manualState && !input.manualPolicyAuthorized) {
    return { allowed: false as const, reason: "MANUAL_POLICY_REQUIRED" };
  }
  const trustedState = stateSignals.some((signal) => TRUSTED_NFC_STATES.has(signal))
    || (manualState && input.manualPolicyAuthorized === true);
  if (!trustedState) return { allowed: false as const, reason: "UNTRUSTED_STATUS" };
  if (!TRUSTED_VERDICTS.has(verdict)) return { allowed: false as const, reason: "UNTRUSTED_VERDICT" };
  return { allowed: true as const, reason: "FRESH_AUTHENTICATED_TAP" };
}

export function resolveAgroTrustCopy(input: {
  isQr?: boolean;
  isOffline?: boolean;
  statusCode?: unknown;
  label?: unknown;
  summary?: unknown;
}) {
  if (input.isOffline) {
    return {
      code: "VERIFICATION_PENDING",
      authenticationLevel: "VERIFICATION_PENDING",
      title: "Verificación pendiente",
      summary: OFFLINE_VERIFICATION_PENDING_COPY,
    };
  }
  if (input.isQr) {
    return {
      code: "GS1_IDENTITY_RESOLVED",
      authenticationLevel: "NOT_CRYPTOGRAPHICALLY_AUTHENTICATED",
      title: "Identidad encontrada",
      summary: "El QR identifica el producto, lote o serie, pero no autentica criptográficamente el objeto físico. Usá NFC para confirmar autenticidad.",
    };
  }
  return {
    code: text(input.statusCode, 80) || "VERIFICATION_PENDING",
    authenticationLevel: "NFC_SUN_BACKEND_VERDICT",
    title: text(input.label, 160) || "Resultado de autenticidad",
    summary: text(input.summary, 600) || "El resultado corresponde a esta lectura y a la política activa del tenant.",
  };
}
