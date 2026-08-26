export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json } from '../../lib/http';
import { processSunScan } from '../../lib/sun-service';
import { createDemoShareToken } from '../../lib/demo-share';
import { seedDemoPack } from '../../lib/demo-seed';
import { sql } from '../../lib/db';
import { anchorTokenizationRequest, resolveTokenizationRuntimeMode } from '../../lib/tokenization-engine';
import {
  classifyTokenizationExecutionClass,
  ensureTokenizationCommercialScopeSchema,
  isTokenizationCommercialScopeSchemaError,
  TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED,
} from '../../lib/tokenization-schema';
import { buildLifecycleState, listDemoCta } from '../../lib/demo-cta';
import { insertSunDiagnostic } from '../../lib/sun-diagnostics';
import { mapVerdictAndRisk, resolveActionMatrix, resolveRightsPolicy } from '../../lib/sun-passport-policy';
import { resolveSunTenantProfile } from '../../lib/sun-tenant-profile';
import { ensureSunTenantProfilesSchema } from '../../lib/sun-tenant-profile-schema';
import { ensureCarrierProfileSchema } from '../../lib/commercial-runtime-schema';
import { getRequestMeta } from '../../lib/request-meta';
import { hitSunRateLimit, shouldFailClosedSunRateLimit } from '../../lib/sun-rate-limit-store';
import { createSunFreshHandoffToken, createSunSnapshotAccessToken } from '../../lib/sun-fresh-handoff';
import { createPublicCertificateShareToken } from '../../lib/public-certificate-share';
import { eventShareUid, resolveExplicitSunAutoTokenizationAuthorization } from '../../lib/public-cta-target';
import { recordTapEvent } from '../../lib/tap-event-service';
import { normalizeConsentedApproximateLocation, normalizeCoordinatePair, redactSensitiveQueryValues } from '../../lib/approximate-location';
import { buildSunSensorEvidence } from '../../lib/sun-sensor-evidence';
import { escapeHtmlText, escapeHtmlTreeForMarkup, serializeForInlineScript } from '../../lib/public-html-security';
import { hasConfiguredAgroProfile, normalizeAgroProductProfile } from '../../lib/agro-product-profile';
import { Gs1RegistryError } from '../../lib/gs1-digital-link-registry';
import { resolvePublicGs1PassportBinding } from '../../lib/public-gs1-passport';
import { resolveTagTamperPresentationEvidence } from '../../lib/sun-carrier-trust-state';
import { resolveEventLocalTime } from '@product/core';
import crypto from "node:crypto";

const RATE_LIMIT_MAX_IP = Number(process.env.SUN_RATE_LIMIT_IP_PER_MIN || 120);
const RATE_LIMIT_MAX_BID = Number(process.env.SUN_RATE_LIMIT_BID_PER_MIN || 240);
const RATE_LIMIT_MAX_UID_CTR = Number(process.env.SUN_RATE_LIMIT_UID_CTR_PER_MIN || 30);
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9._-]{1,119}$/;
const HEX_RE = /^[0-9A-F]+$/i;

const SUN_PIPELINE_TIMEOUT_MS = Number(process.env.SUN_PIPELINE_TIMEOUT_MS || 8000);
const DEMO_BODEGA_BID = "DEMO-2026-02";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function sanitizePublicErrorReason(raw: string) {
  const normalized = String(raw || "").toLowerCase();
  if (!normalized) return "sun_processing_error";
  if (normalized.includes("database_url") || normalized.includes("connect") || normalized.includes("neon")) {
    return "sun_processing_temporarily_unavailable";
  }
  if (normalized.includes("polygon") || normalized.includes("rpc") || normalized.includes("tokenization")) {
    return "tokenization_temporarily_unavailable";
  }
  return "sun_processing_error";
}

type SunResult = Awaited<ReturnType<typeof processSunScan>>;

type ProductState =
  | "VALID_AUTHENTIC"
  | "VALID_CLOSED"
  | "VALID_OPENED"
  | "VALID_OPENED_PREVIOUSLY"
  | "VALID_UNKNOWN_TAMPER"
  | "VALID_MANUAL_OPENED"
  | "REPLAY_SUSPECT"
  | "SUN_PROFILE_MISMATCH"
  | "SUN_BATCH_DUPLICATE_CONFIG"
  | "INVALID"
  | "UNKNOWN_BATCH"
  | "NOT_REGISTERED"
  | "NOT_ACTIVE";

type PassportSnapshot = {
  tenant_id: string | null;
  tenant_slug: string | null;
  tenant_name: string | null;
  batch_status: string | null;
  batch_sdm_config: Record<string, unknown> | null;
  carrier_profile_code: string | null;
  carrier_label: string | null;
  carrier_security_level: number | null;
  carrier_capabilities: Record<string, unknown> | null;
  carrier_consumer_copy: string | null;
  carrier_admin_copy: string | null;
  sun_profile_vertical: string | null;
  sun_profile_club_name: string | null;
  sun_profile_product_label: string | null;
  sun_profile_origin_label: string | null;
  sun_profile_origin_address: string | null;
  sun_profile_origin_lat: number | null;
  sun_profile_origin_lng: number | null;
  sun_profile_tokenization_mode: string | null;
  sun_profile_claim_policy: string | null;
  sun_profile_ownership_policy: Record<string, unknown> | null;
  sun_profile_manifest_policy: Record<string, unknown> | null;
  product_name: string | null;
  sku: string | null;
  winery: string | null;
  region: string | null;
  grape_varietal: string | null;
  vintage: string | null;
  harvest_year: number | null;
  barrel_months: number | null;
  temperature_storage: string | null;
  image_url: string | null;
  locale_data: Record<string, unknown> | null;
  tag_status: string | null;
  scan_count: number | null;
  first_verified_at: string | null;
  first_city: string | null;
  first_country: string | null;
  last_verified_at: string | null;
  last_city: string | null;
  last_country: string | null;
  last_result: string | null;
  tokenization_status: string | null;
  tokenization_network: string | null;
  tokenization_tx_hash: string | null;
  tokenization_token_id: string | null;
  tag_claim_pin_required: boolean | null;
  tag_active_for_claim: boolean | null;
  batch_claim_pin_required: boolean | null;
  batch_active_for_claim: boolean | null;
} | null;

type TimelineEvent = {
  eventId?: string | null;
  at: string | null;
  result: string | null;
  city: string | null;
  country: string | null;
  device: string | null;
  lat?: number | null;
  lng?: number | null;
  locationSource?: string | null;
  accuracyM?: number | null;
  sensorTempC?: number | null;
  sensorHumidity?: number | null;
  stage?: string | null;
};

export type SunPublicPassportContract = {
  eventId: string | null;
  tenantId: string | null;
  tenantSlug: string | null;
  batchId: string;
  tagId: string | null;
  uidMasked: string;
  verdict: string;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
  productName: string;
  provenance: {
    origin: string | null;
    firstVerified: { at: string | null; city: string | null; country: string | null };
    lastVerifiedLocation: { at: string | null; city: string | null; country: string | null; result: string | null };
    timelineSummary: TimelineEvent[];
  };
  allowedActions: string[];
  blockedActions: string[];
};

const BID_PASSPORT_PRESETS: Record<string, {
  name: string;
  winery: string;
  region: string;
  varietal: string;
  vintage: string;
  alcohol: string;
  bottle: string;
  serving: string;
  harvestYear: number;
  barrelMonths: number;
  storage: string;
  tenantSlug: string;
  clubName: string;
  wineryLocation: string;
  altitude: string;
  oakType: string;
  wineryCoordinates: { lat: number; lng: number } | null;
}> = {
  "DEMO-2026-02": {
    name: "Gran Reserva Malbec",
    winery: "Bodega Balmec",
    region: "Valle de Uco, Mendoza",
    varietal: "Malbec",
    vintage: "2022",
    alcohol: "14.5%",
    bottle: "750ml",
    serving: "16°C · decantar 20 min",
    harvestYear: 2022,
    barrelMonths: 12,
    storage: "16°C",
    tenantSlug: "demobodega",
    clubName: "Club Terroir",
    wineryLocation: "Finca Altamira, Mendoza, AR",
    altitude: "1,050 msnm",
    oakType: "Roble francés tostado medio",
    wineryCoordinates: { lat: -33.3667, lng: -69.1500 },
  },
  "DEMO-2026-08": {
    name: "Single Vineyard Cabernet Franc",
    winery: "Bodega Balmec",
    region: "Luján de Cuyo, Mendoza",
    varietal: "Cabernet Franc",
    vintage: "2023",
    alcohol: "13.8%",
    bottle: "750ml",
    serving: "15°C · sin decantar",
    harvestYear: 2023,
    barrelMonths: 10,
    storage: "15°C",
    tenantSlug: "demobodega",
    clubName: "Club Terroir",
    wineryLocation: "Perdriel, Luján de Cuyo, AR",
    altitude: "980 msnm",
    oakType: "Roble francés de grano fino",
    wineryCoordinates: { lat: -33.0377, lng: -68.8841 },
  },
};

function wantsHtml(req: Request, url: URL) {
  const force = (url.searchParams.get('view') || '').toLowerCase();
  if (force === 'json') return false;
  if (force === 'html') return true;
  return (req.headers.get('accept') || '').toLowerCase().includes('text/html');
}

function wantsInlineApiHtml(url: URL) {
  const view = (url.searchParams.get('view') || '').toLowerCase();
  return view === "api-html" || view === "legacy-html";
}

function webBaseUrl(sourceUrl?: URL) {
  let configured = process.env.NEXT_PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.WEB_BASE_URL;
  if (configured) {
    configured = configured.replace(/^['"]|['"]$/g, "").trim();
    return configured.replace(/\/$/, "");
  }

  const host = sourceUrl?.hostname || "";
  if (host === "localhost" || host === "127.0.0.1") {
    return `${sourceUrl?.protocol || "http:"}//${host}:3000`;
  }

  return "https://nexid.lat";
}

function dashboardBaseUrl() {
  let configured =
    process.env.NEXT_PUBLIC_DASHBOARD_URL
    || process.env.NEXT_PUBLIC_DASHBOARD_BASE_URL
    || process.env.DASHBOARD_BASE_URL
    || process.env.DASHBOARD_URL
    || process.env.APP_DASHBOARD_URL;
  if (configured) {
    configured = configured.replace(/^['"]|['"]$/g, "").trim();
  }
  return (configured || "https://app.nexid.lat").replace(/\/$/, "");
}

function buildWebSunSnapshotUrl(
  url: URL,
  diagnosticId: number | null,
  traceId: string,
  locale: SunLocale,
  freshToken?: string | null,
  snapshotAccessToken?: string | null,
) {
  if (!traceId) return null;
  if (diagnosticId && !snapshotAccessToken) return null;
  const target = new URL("/sun", webBaseUrl(url));
  if (diagnosticId) {
    target.searchParams.set("snapshot", String(diagnosticId));
    target.searchParams.set("access", snapshotAccessToken || "");
    if (freshToken) target.searchParams.set("fresh", freshToken);
  } else {
    ["v", "bid", "picc_data", "enc", "cmac"].forEach((key) => {
      const value = url.searchParams.get(key);
      if (value) target.searchParams.set(key, value);
    });
    target.searchParams.set("handoff", "query");
  }
  target.searchParams.set("trace", traceId);
  target.searchParams.set("source", "nfc");
  target.searchParams.set("lang", locale);
  const bid = url.searchParams.get("bid");
  if (bid) target.searchParams.set("bid", bid);
  if ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && (target.hostname === "localhost" || target.hostname === "127.0.0.1")) {
    target.searchParams.set("api", url.origin);
  }
  return target;
}

async function safeHitSunRateLimit(scope: string, scopeKey: string, windowSeconds: number, maxHits: number) {
  try {
    return await hitSunRateLimit(scope, scopeKey, windowSeconds, maxHits);
  } catch (error) {
    const reason = error instanceof Error ?error.message : "rate_limit_unavailable";
    console.warn("[sun_rate_limit_unavailable]", JSON.stringify({ scope, reason: sanitizePublicErrorReason(reason) }));
    return { hits: 0, limited: false, retryAfterSeconds: 30, unavailable: true };
  }
}

function shouldRepairDemoBodegaSun(bid: string, result: SunResult) {
  const production = [process.env.VERCEL_ENV, process.env.NODE_ENV]
    .some((value) => String(value || "").trim().toLowerCase() === "production");
  const explicitlyEnabled = String(process.env.NEXID_SUN_DEMO_AUTO_SEED || "").trim().toLowerCase() === "true";
  if (!explicitlyEnabled || production) return false;
  if (bid !== DEMO_BODEGA_BID) return false;
  const reason = String(result.body?.reason || "").toLowerCase();
  return result.status === 404 && reason.includes("unknown batch");
}



type SunLocale = "es-AR" | "pt-BR" | "en";

function detectSunLocale(country: string | null, acceptLanguage: string | null): SunLocale {
  const c = String(country || "").trim().toUpperCase();
  const spanishFirstCountries = new Set(["AR", "UY", "PY", "CL", "PE", "BO", "EC", "CO", "VE", "MX", "ES", "PA", "CR", "GT", "HN", "NI", "SV", "DO", "PR"]);
  if (c === "BR") return "pt-BR";
  if (c === "US") return "en";
  if (spanishFirstCountries.has(c)) return "es-AR";
  const langs = String(acceptLanguage || "").toLowerCase();
  if (langs.includes("pt-br") || langs.includes("pt")) return "pt-BR";
  if (langs.includes("en-us") || langs.includes("en")) return "en";
  return "es-AR";
}

function resolveSunLocale(url: URL, country: string | null, acceptLanguage: string | null): SunLocale {
  const forced = String(url.searchParams.get("lang") || "").toLowerCase();
  if (forced === "es" || forced === "es-ar") return "es-AR";
  if (forced === "pt" || forced === "pt-br") return "pt-BR";
  if (forced === "en") return "en";
  return detectSunLocale(country, acceptLanguage);
}

function getSunCopy(locale: SunLocale) {
  if (locale === "pt-BR") {
    return {
      lang: "pt-BR",
      title: "Passaporte Digital do Produto",
      actionsPanel: "Ações",
      authPanel: "Estado de autenticação",
      identityPanel: "Identidade do produto",
      provenancePanel: "Proveniência",
      timelinePanel: "Resumo de eventos",
      tokenPanel: "Tokenização",
      technicalPanel: "Detalhes técnicos",
      iotPanel: "Sinais IoT e adega",
      tapPanel: "Inteligência do dispositivo",
      firstVerified: "Primeira verificação",
      lastVerified: "Última verificação",
      processing: "Processando...",
      actionOk: "executado com sucesso.",
      actionFail: "falhou",
      ctaClaim: "Ativar titularidade",
      ctaWarranty: "Registrar garantia",
      ctaProvenance: "Ver proveniência",
      ctaTokenize: "Tokenização opcional",
      quality: "Heurística de política",
      authReplay: "Replay detectado: solicite um novo toque físico antes de titularidade/garantia/tokenização.",
      authOk: "Mensagem NFC validada. Titularidade, garantia, proveniência e tokenização continuam sujeitas à política e às evidências exigidas.",
      statusReady: "Pronto para executar CTAs seguras.",
      statusReplay: "Replay ativo: ações comerciais bloqueadas até novo toque.",
      timelineEmpty: "Sem eventos ainda. Faça um novo tap para gerar histórico.",
      achievementTitle: "Conquistas",
      achievementFirst: "Primeira autenticação",
      achievementProv: "Proveniência revisada",
    } as const;
  }
  if (locale === "en") {
    return {
      lang: "en",
      title: "Digital Product Passport",
      actionsPanel: "Actions",
      authPanel: "Authentication status",
      identityPanel: "Product identity",
      provenancePanel: "Provenance",
      timelinePanel: "Event timeline",
      tokenPanel: "Tokenization",
      technicalPanel: "Technical details",
      iotPanel: "IoT & cellar signals",
      tapPanel: "Tap device intelligence",
      firstVerified: "First verified",
      lastVerified: "Last verified",
      processing: "Processing...",
      actionOk: "completed successfully.",
      actionFail: "failed",
      ctaClaim: "Activate ownership",
      ctaWarranty: "Register warranty",
      ctaProvenance: "View provenance",
      ctaTokenize: "Optional tokenization",
      quality: "Policy heuristic",
      authReplay: "Replay detected: request a fresh physical tap before ownership/warranty/tokenization.",
      authOk: "NFC message validated. Ownership, warranty, provenance and tokenization remain subject to policy and required evidence.",
      statusReady: "Ready to execute secure CTAs.",
      statusReplay: "Replay active: commercial actions blocked until a fresh tap.",
      timelineEmpty: "No events yet. Perform a new tap to generate history.",
      achievementTitle: "Achievements",
      achievementFirst: "First authentication",
      achievementProv: "Provenance reviewed",
    } as const;
  }
  return {
    lang: "es",
    title: "Pasaporte Digital del Producto",
    actionsPanel: "Acciones",
    authPanel: "Estado de autenticación",
    identityPanel: "Identidad del producto",
    provenancePanel: "Proveniencia",
    timelinePanel: "Resumen de eventos",
    tokenPanel: "Tokenización",
    technicalPanel: "Detalles técnicos",
    iotPanel: "IoT y bodega",
    tapPanel: "Inteligencia del dispositivo",
    firstVerified: "Primera verificación",
    lastVerified: "Última verificación",
    processing: "Procesando...",
    actionOk: "ejecutado correctamente.",
    actionFail: "falló",
    ctaClaim: "Activar titularidad",
    ctaWarranty: "Registrar garantía",
    ctaProvenance: "Ver proveniencia",
    ctaTokenize: "Tokenización opcional",
    quality: "Heurística de política",
    authReplay: "Replay detectado: pedí un nuevo tap físico antes de titularidad/garantía/tokenización.",
    authOk: "Mensaje NFC validado. Titularidad, garantía, procedencia y tokenización siguen sujetas a política y evidencia requerida.",
    statusReady: "Listo para ejecutar CTAs seguras.",
    statusReplay: "Replay activo: acciones comerciales bloqueadas hasta nuevo tap.",
    timelineEmpty: "Sin eventos todavía. Hacé un nuevo tap para generar historial.",
    achievementTitle: "Logros",
    achievementFirst: "Primera autenticación",
    achievementProv: "Proveniencia revisada",
  } as const;
}

function isSunProfileMismatchReason(reason: string, resultMeta?: Record<string, unknown>) {
  const normalized = String(reason || "").toLowerCase();
  const verificationMethod = String(resultMeta?.verification_method || "").toLowerCase();
  const cryptoErrorReason = String(resultMeta?.crypto_error_reason || "").toLowerCase();
  const combined = `${normalized} ${verificationMethod} ${cryptoErrorReason}`;
  return verificationMethod === "sun_crypto_failed"
    || combined.includes("uid length invalid")
    || combined.includes("cmac mismatch")
    || combined.includes("picc_data bad length")
    || combined.includes("invalid_sun_payload")
    || combined.includes("sun_crypto_failed")
    || combined.includes("crypto_decode_failed")
    || combined.includes("bad length");
}

function buildTroubleshooting(reason: string, bid: string, resultMeta?: Record<string, unknown>) {
  const normalized = reason.toLowerCase();
  if (normalized === 'sun_ok' || normalized.includes('ok')) return [];
  if (normalized.includes('unknown batch')) {
    return [
      `El BID ${bid} no existe en la base conectada a este dominio.`,
      'Revisá si el lote fue creado en otro entorno (demo/local vs producción).',
      'Desde Dashboard: registrar batch → importar manifest → activar tags.',
    ];
  }
  if (normalized.includes('replay')) return ['El payload SUN ya fue usado anteriormente.', 'Pedí un tap real para generar nuevo contador.', 'No reutilizar URLs pegadas para validar autenticidad.'];
  if (isSunProfileMismatchReason(reason, resultMeta)) {
    return [
      `El BID ${bid} existe y resuelve tenant, pero el payload SUN no descifra a ningun UID autorizado del lote.`,
      'Revisar K_META/K_FILE, layout SDM/PICC y longitud UID configurada por el proveedor.',
      'No habilitar ownership/NFT hasta que el UID real matchee el manifiesto o se registre payload SUN autorizado.',
    ];
  }
  if (normalized.includes('cmac') || normalized.includes('invalid')) return ['Posible desalineación de llaves SUN del lote.', 'Verificá K_META/K_FILE del batch.', 'Usá URL generada por tap NFC real.'];
  return ['Revisá onboarding del batch.', 'Confirmá UID importado/activo.', 'Auditar eventos y llaves en dashboard.'];
}

function resolveTrustState(status: string, reason: string, productState?: string | null, resultMeta?: Record<string, unknown>) {
  const normalizedStatus = status.toUpperCase();
  const normalizedReason = reason.toLowerCase();
  const normalizedProductState = String(productState || "").toUpperCase();
  const tagTamperObject = resultMeta?.tag_tamper && typeof resultMeta.tag_tamper === "object"
    ? resultMeta.tag_tamper as Record<string, unknown>
    : {};
  const ttEvidence = resolveTagTamperPresentationEvidence({
    carrierProfileCode: resultMeta?.carrier_profile_code,
    ttRaw: resultMeta?.ttstatus_raw || resultMeta?.tamper_raw_value || tagTamperObject.raw,
  });
  const claimedTtState = normalizedProductState === "VALID_CLOSED" || normalizedStatus === "VALID_CLOSED"
    ? "VALID_CLOSED"
    : normalizedProductState === "VALID_OPENED" || normalizedStatus === "VALID_OPENED" || normalizedStatus === "OPENED"
      ? "VALID_OPENED"
      : normalizedProductState === "VALID_OPENED_PREVIOUSLY" || normalizedStatus === "VALID_OPENED_PREVIOUSLY" || normalizedStatus === "OPENED_PREVIOUSLY"
        ? "VALID_OPENED_PREVIOUSLY"
        : null;
  if (normalizedStatus === "SUN_BATCH_DUPLICATE_CONFIG" || normalizedProductState === "SUN_BATCH_DUPLICATE_CONFIG") {
    return {
      code: "SUN_BATCH_DUPLICATE_CONFIG",
      label: "Configuracion duplicada del lote",
      summary: "Hay mas de un batch con el mismo BID. No validamos la lectura hasta corregir la configuracion del lote.",
      tone: "risk" as const,
    };
  }
  if (
    normalizedStatus === "SUN_PROFILE_MISMATCH"
    || normalizedProductState === "SUN_PROFILE_MISMATCH"
    || (normalizedStatus === "INVALID" && isSunProfileMismatchReason(reason, resultMeta))
  ) {
    return {
      code: "SUN_PROFILE_MISMATCH",
      label: "No pudimos validar esta lectura",
      summary: "El lote fue detectado, pero esta lectura no coincide con el perfil de seguridad cargado. Las acciones comerciales quedan bloqueadas.",
      tone: "risk" as const,
    };
  }
  if (claimedTtState && ttEvidence.state !== claimedTtState) {
    return {
      code: "SUN_PROFILE_MISMATCH",
      label: "No pudimos validar el estado de apertura",
      summary: "La lectura no aporta un perfil TagTamper exacto y un TTStatus completo coherente. Las acciones comerciales quedan bloqueadas.",
      tone: "risk" as const,
    };
  }
  if (normalizedStatus === 'REPLAY_SUSPECT' || normalizedReason.includes('replay') || normalizedReason.includes('copied url')) {
    const isTamperOpened = ttEvidence.state === "VALID_OPENED"
      || ttEvidence.state === "VALID_OPENED_PREVIOUSLY";
    if (isTamperOpened) {
      return {
        code: 'REPLAY_SUSPECT',
        label: 'Lectura repetida (TT reporta apertura)',
        summary: 'El mensaje NFC fue validado, el TT reporta apertura y esta lectura ya fue procesada. Esto no certifica el contenido ni el origen físico.',
        tone: 'warn' as const,
      };
    }
    return { code: 'REPLAY_SUSPECT', label: 'URL reutilizada', summary: 'Este payload ya fue usado. Escaneá físicamente la etiqueta para generar una nueva lectura.', tone: 'warn' as const };
  }
  if (normalizedProductState === "VALID_OPENED" || normalizedStatus === 'VALID_OPENED' || normalizedStatus === 'OPENED') {
    return { code: 'VALID_OPENED', label: 'Producto auténtico · sello abierto', summary: 'Autenticidad confirmada. Sello abierto. El estado proviene del TTStatus completo validado; no certifica por sí solo el contenido ni la custodia.', tone: 'warn' as const };
  }
  if (normalizedProductState === "VALID_OPENED_PREVIOUSLY" || normalizedStatus === "VALID_OPENED_PREVIOUSLY" || normalizedStatus === "OPENED_PREVIOUSLY") {
    return { code: 'VALID_OPENED_PREVIOUSLY', label: 'Producto auténtico · apertura previa', summary: 'Autenticidad confirmada. El sello fue abierto anteriormente. El estado proviene del TTStatus completo validado; no certifica por sí solo el contenido ni la custodia.', tone: 'warn' as const };
  }
  if (normalizedProductState === "VALID_MANUAL_OPENED" || normalizedStatus === "MANUAL_OPENED") {
    return { code: 'MANUAL_OPENED', label: 'Apertura declarada', summary: 'Un operador declaró el estado abierto. No es una medición criptográfica del contenido.', tone: 'warn' as const };
  }
  if (normalizedProductState === "VALID_UNKNOWN_TAMPER" || normalizedStatus === "VALID_UNKNOWN_TAMPER") {
    return { code: 'VALID_UNKNOWN_TAMPER', label: 'Autenticidad criptográfica confirmada', summary: 'Autenticidad criptográfica confirmada. Estado de apertura no disponible.', tone: 'good' as const };
  }
  if (normalizedStatus === 'TAMPER_RISK' || normalizedReason.includes('tamper')) {
    return { code: 'TAMPER_RISK', label: 'Riesgo de manipulación', summary: 'Se detectaron señales de posible manipulación.', tone: 'risk' as const };
  }
  if (normalizedProductState === "VALID_CLOSED" || normalizedStatus === 'VALID_CLOSED') {
    return { code: 'VALID_CLOSED', label: 'Autenticidad confirmada · sello intacto', summary: 'Autenticidad confirmada. Sello intacto. El estado proviene del TTStatus completo validado y de una construcción de empaque aprobada.', tone: 'good' as const };
  }
  if (normalizedProductState === "VALID_AUTHENTIC" || normalizedStatus === 'VALID_AUTHENTIC') {
    return { code: 'VALID_AUTHENTIC', label: 'Autenticidad criptográfica confirmada', summary: 'Autenticidad criptográfica confirmada. Este producto no usa sello electrónico de apertura.', tone: 'good' as const };
  }
  if (normalizedStatus === 'VALID') {
    return { code: 'VALID_AUTHENTIC', label: 'Autenticidad criptográfica confirmada', summary: 'Autenticidad criptográfica confirmada. No hay un estado electrónico de apertura validado para esta lectura.', tone: 'good' as const };
  }
  return { code: normalizedStatus || 'INVALID', label: 'Validación no concluyente', summary: 'No fue posible validar el mensaje NFC con la evidencia disponible.', tone: 'warn' as const };
}

function summarizeUserAgent(ua: string) {
  const normalized = ua.toLowerCase();
  const os = normalized.includes("iphone") || normalized.includes("ipad")
    ?"iOS"
    : normalized.includes("android")
      ?"Android"
      : normalized.includes("windows")
        ?"Windows"
        : normalized.includes("mac os") || normalized.includes("macintosh")
          ?"macOS"
          : "Unknown OS";
  const browser = normalized.includes("edg/")
    ?"Edge"
    : normalized.includes("samsungbrowser")
      ?"Samsung Internet"
      : normalized.includes("chrome/")
        ?"Chrome"
        : normalized.includes("safari/")
          ?"Safari"
          : normalized.includes("firefox/")
            ?"Firefox"
            : "Unknown Browser";
  const device = normalized.includes("mobile") || normalized.includes("iphone") || normalized.includes("android")
    ?"Mobile"
    : normalized.includes("ipad") || normalized.includes("tablet")
      ?"Tablet"
      : "Desktop";
  return { os, browser, device };
}

function roundCoord(value: number | null, decimals = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function safeDecode(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstParam(url: URL, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = String(url.searchParams.get(key) || "").trim();
    if (value) return value;
  }
  return fallback;
}

function tapTimeContext(input: {
  at?: string | null;
  city?: string | null;
  country?: string | null;
  tenantSlug?: string | null;
  timezone?: string | null;
}) {
  const time = resolveEventLocalTime({
    created_at: input.at || new Date().toISOString(),
    city: input.city || null,
    country_code: input.country || null,
    tenant_slug: input.tenantSlug || null,
    meta: input.timezone ? { sun_context: { client: { timezone: input.timezone } } } : {},
  });
  return {
    localTime: time.occurredAtLocal,
    utcTime: time.occurredAtUtc,
    timezone: time.timezone,
    timezoneLabel: time.timezoneLabel,
    timezoneOffset: time.timezoneOffset,
  };
}

function browserFromUserAgent(ua: string) {
  const text = ua.toLowerCase();
  if (text.includes("edg")) return "Edge";
  if (text.includes("crios") || text.includes("chrome")) return "Chrome";
  if (text.includes("fxios") || text.includes("firefox")) return "Firefox";
  if (text.includes("samsungbrowser")) return "Samsung Internet";
  if (text.includes("safari")) return "Safari";
  return "Unknown";
}

function platformFromUserAgent(ua: string) {
  const text = ua.toLowerCase();
  if (text.includes("iphone") || text.includes("ipad")) return "iOS";
  if (text.includes("android")) return "Android";
  if (text.includes("windows")) return "Windows";
  if (text.includes("mac os") || text.includes("macintosh")) return "macOS";
  if (text.includes("linux")) return "Linux";
  return "Unknown";
}

async function resolveQrTenantBatch(input: { tenantSlug: string; requestedBid: string }) {
  const rows = await sql/*sql*/`
    SELECT
      tn.id::text AS tenant_id,
      tn.slug AS tenant_slug,
      tn.name AS tenant_name,
      b.id::text AS batch_id,
      b.bid,
      b.sdm_config
    FROM tenants tn
    INNER JOIN batches b
      ON b.tenant_id = tn.id
      AND b.bid = ${input.requestedBid}
      AND b.status = 'active'
    WHERE tn.slug = ${input.tenantSlug}
      AND tn.status = 'active'
    LIMIT 1
  `;
  return rows[0] as {
    tenant_id?: string | null;
    tenant_slug?: string | null;
    tenant_name?: string | null;
    batch_id?: string | null;
    bid?: string | null;
    sdm_config?: Record<string, unknown> | null;
  } | undefined;
}

async function logQrAttempt(input: {
  bid: string;
  result: "QR_SCAN" | "STATIC_NFC_SCAN";
  reason: string;
  ip: string | null;
  userAgent: string;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  rawQuery: Record<string, unknown>;
  meta: Record<string, unknown>;
}) {
  const persistedRawQuery = redactSensitiveQueryValues(input.rawQuery) || {};
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS sun_scan_attempts (
      id bigserial PRIMARY KEY,
      bid text NOT NULL,
      result text NOT NULL,
      reason text,
      ip inet,
      user_agent text,
      geo_city text,
      geo_country text,
      geo_lat double precision,
      geo_lng double precision,
      source text NOT NULL DEFAULT 'real',
      raw_query jsonb,
      meta jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql/*sql*/`
    INSERT INTO sun_scan_attempts (
      bid, result, reason, ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, source, raw_query, meta
    ) VALUES (
      ${input.bid || "QR-UNKNOWN"},
      ${input.result},
      ${input.reason},
      ${input.ip},
      ${input.userAgent},
      ${input.city},
      ${input.country},
      ${input.lat},
      ${input.lng},
      'real',
      ${JSON.stringify(persistedRawQuery)}::jsonb,
      ${JSON.stringify(input.meta)}::jsonb
    )
  `;
}

async function handleQrScan(input: {
  req: Request;
  url: URL;
  traceId: string;
  ip: string | null;
  userAgent: string;
  geoCity: string | null;
  geoCountry: string | null;
  geoLat: number | null;
  geoLng: number | null;
}) {
  const rawQuery = redactSensitiveQueryValues(Object.fromEntries(input.url.searchParams.entries())) || {};
  const explicitDemo = input.url.searchParams.get("demo") === "1";
  const requestedChannel = String(input.url.searchParams.get("channel") || "").trim().toLowerCase();
  const requestedCarrierProfile = String(input.url.searchParams.get("carrier") || "").trim().toLowerCase();
  const staticNfcScan = requestedChannel === "static_nfc";
  const gs1Scan = !staticNfcScan && requestedCarrierProfile === "gs1_digital_link";
  const carrierProfileCode = staticNfcScan
    ? requestedCarrierProfile
    : gs1Scan
      ? "gs1_digital_link"
      : "qr_basic";
  const carrierLabel = staticNfcScan
    ? `NFC estatico (${carrierProfileCode.toUpperCase()})`
    : gs1Scan
      ? "QR GS1 Digital Link (identidad registrada)"
      : "QR / SDK";
  const scanResult = staticNfcScan ? "STATIC_NFC_SCAN" : "QR_SCAN";
  const publicStatusCode = staticNfcScan
    ? "STATIC_NFC_SCAN"
    : gs1Scan
      ? "GS1_IDENTITY_RESOLVED"
      : "QR_SCAN";
  const scanReason = staticNfcScan
    ? "static_nfc_scan_unverified"
    : gs1Scan
      ? "gs1_identity_resolved_not_cryptographically_authenticated"
      : "qr_scan_unverified";
  let tenantSlug = firstParam(
    input.url,
    ["tenant", "tenantSlug", "tenant_slug"],
    explicitDemo ? "demobodega" : "",
  ).toLowerCase();
  let requestedBid = firstParam(
    input.url,
    ["bid", "batch", "batchId"],
    explicitDemo && tenantSlug === "demobodega" ? DEMO_BODEGA_BID : "",
  );
  const declaredInput = Object.fromEntries(
    [
      ["product", firstParam(input.url, ["product", "productName", "name"])],
      ["brand", firstParam(input.url, ["winery", "brand"])],
      ["origin", firstParam(input.url, ["region", "origin"])],
      ["varietal", firstParam(input.url, ["varietal"])],
      ["vintage", firstParam(input.url, ["vintage"])],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const locationConsent = ["1", "true", "yes"].includes(firstParam(input.url, ["locationConsent", "location_consent"]).toLowerCase());
  const clientLocation = normalizeConsentedApproximateLocation({
    consent: locationConsent,
    precision: firstParam(input.url, ["locationPrecision", "location_precision", "precision"]),
    lat: firstParam(input.url, ["lat", "latitude", "gps_lat"]),
    lng: firstParam(input.url, ["lng", "longitude", "gps_lng"]),
    accuracy: firstParam(input.url, ["accuracy", "gps_accuracy"]),
  });
  const edgeCoordinate = normalizeCoordinatePair(input.geoLat, input.geoLng);
  const hasClientGeo = clientLocation.accepted;
  const hasEdgeGeo = edgeCoordinate !== null;
  const resolvedLat = hasClientGeo ? clientLocation.lat : edgeCoordinate?.lat ?? null;
  const resolvedLng = hasClientGeo ? clientLocation.lng : edgeCoordinate?.lng ?? null;
  const geoPrecision = hasClientGeo ? "browser_rounded" : hasEdgeGeo ? "ip" : "none";
  const locationSource = hasClientGeo ? "browser_gps_approximate_consent" : hasEdgeGeo ? "edge_ip_approx" : "none";
  const deviceMeta = {
    userAgent: input.userAgent,
    platform: platformFromUserAgent(input.userAgent),
    browser: browserFromUserAgent(input.userAgent),
    mobile: /mobile|iphone|android|ipad/i.test(input.userAgent),
    language: input.req.headers.get("accept-language") || null,
    timezone: firstParam(input.url, ["timezone", "tz"]),
  };
  const baseMeta = {
    trace_id: input.traceId,
    channel: gs1Scan ? "gs1_qr" : staticNfcScan ? "static_nfc" : "qr",
    qr: true,
    carrier_profile_code: carrierProfileCode,
    assurance: {
      identity_registered: gs1Scan,
      cryptographic_nfc_authentication: false,
    },
    declared_input: declaredInput,
    geo_evidence: {
      source: locationSource,
      verified: false,
      consent: hasClientGeo,
      precision: hasClientGeo ? "approximate" : hasEdgeGeo ? "ip_approximate" : "none",
      accuracy_m: hasClientGeo ? clientLocation.accuracy : null,
      client_location_reason: clientLocation.reason,
      raw_query_location_redacted: true,
      raw_query_sun_dynamic_redacted: true,
    },
    sun_context: { client: deviceMeta },
  };

  const failQrContext = async (status: 404 | 422, detail: string) => {
    await logQrAttempt({
      bid: requestedBid,
      result: scanResult,
      reason: "qr_context_not_found",
      ip: input.ip,
      userAgent: input.userAgent,
      city: input.geoCity,
      country: input.geoCountry,
      lat: resolvedLat,
      lng: resolvedLng,
      rawQuery,
      meta: { ...baseMeta, context_resolution: detail },
    }).catch(() => null);
    const response = json({ ok: false, reason: "qr_context_not_found" }, status);
    response.headers.set("x-nexid-trace-id", input.traceId);
    response.headers.set("x-request-id", input.traceId);
    return response;
  };

  if (staticNfcScan && !new Set(["ntag213", "ntag215", "ntag216"]).has(carrierProfileCode)) {
    return failQrContext(422, "unsupported_static_nfc_carrier");
  }

  if (!staticNfcScan && requestedCarrierProfile && !new Set(["qr_basic", "gs1_digital_link"]).has(requestedCarrierProfile)) {
    return failQrContext(422, "unsupported_qr_carrier");
  }

  let gs1Registry: Awaited<ReturnType<typeof resolvePublicGs1PassportBinding>> | null = null;
  if (gs1Scan) {
    try {
      gs1Registry = await resolvePublicGs1PassportBinding({
        registryId: input.url.searchParams.get("gs1_registry_id"),
        gtin: input.url.searchParams.get("gtin"),
        lot: input.url.searchParams.get("lot"),
        serial: input.url.searchParams.get("serial"),
        tenantSlug,
        bid: requestedBid,
      });
      // Tenant and batch scope are authoritative registry values, never the
      // redirect query supplied by the browser.
      tenantSlug = gs1Registry.tenantSlug.toLowerCase();
      requestedBid = gs1Registry.bid;
    } catch (error) {
      const status = error instanceof Gs1RegistryError && error.status === 404 ? 404 : 422;
      const detail = error instanceof Gs1RegistryError ? error.code : "gs1_registry_unavailable";
      return failQrContext(status, detail);
    }
  }

  if (!TENANT_SLUG_RE.test(tenantSlug) || !BID_RE.test(requestedBid)) {
    return failQrContext(422, "missing_or_invalid_tenant_or_batch");
  }

  const tenantBatch = await resolveQrTenantBatch({ tenantSlug, requestedBid }).catch(() => undefined);
  if (!tenantBatch?.tenant_id || !tenantBatch.batch_id || !tenantBatch.bid) {
    return failQrContext(404, "active_tenant_batch_not_found");
  }
  if (gs1Registry && (
    String(tenantBatch.tenant_id).toLowerCase() !== gs1Registry.tenantId.toLowerCase()
    || String(tenantBatch.batch_id).toLowerCase() !== gs1Registry.batchId.toLowerCase()
    || String(tenantBatch.bid).toUpperCase() !== gs1Registry.bid.toUpperCase()
  )) {
    return failQrContext(422, "gs1_registry_batch_binding_mismatch");
  }

  const tenantId = tenantBatch.tenant_id;
  const batchId = tenantBatch.batch_id;
  const bid = tenantBatch.bid;
  const tenantName = String(tenantBatch.tenant_name || tenantSlug);
  const sdmConfig = jsonObject(tenantBatch.sdm_config);
  const configuredProduct = jsonObject(sdmConfig.product);
  const configuredProductName = String(gs1Registry?.displayName || configuredProduct.name || sdmConfig.product_name || `Batch ${bid}`);
  const configuredBrand = String(configuredProduct.winery || configuredProduct.brand || sdmConfig.winery || sdmConfig.brand || tenantName);
  const configuredOrigin = String(configuredProduct.region || configuredProduct.origin || sdmConfig.region || sdmConfig.origin || "").trim() || null;
  const configuredVertical = String(configuredProduct.vertical || sdmConfig.vertical || "generic");
  const configuredProductLabel = String(configuredProduct.category || sdmConfig.product_label || "producto");
  const configuredClubName = String(sdmConfig.club_name || "").trim() || null;
  const configuredAgroProfile = normalizeAgroProductProfile({
    batchConfig: sdmConfig,
    registryMetadata: gs1Registry?.metadata,
    identity: {
      gtin: gs1Registry?.gtin || firstParam(input.url, ["gtin"]),
      lot: gs1Registry?.lot || firstParam(input.url, ["lot"]) || bid,
      serial: gs1Registry?.serial || firstParam(input.url, ["serial"]),
    },
  });
  const meta = {
    ...baseMeta,
    configured_context: { tenant: tenantSlug, bid },
    ...(gs1Registry ? {
      gs1_registry: {
        id: gs1Registry.id,
        gtin: gs1Registry.gtin,
        lot: gs1Registry.lot,
        serial: gs1Registry.serial,
        tenant_id: gs1Registry.tenantId,
        batch_id: gs1Registry.batchId,
        entitlement_id: gs1Registry.entitlementId,
      },
    } : {}),
  };

  const eventId = await recordTapEvent({
      tenantId: tenantId,
      tenantSlug,
      batchId: batchId,
      bid,
      uidHex: firstParam(input.url, ["uid", "uidHex", "uid_hex"]) || null,
      source: "real",
      eventType: "PROVENANCE_VIEWED",
      verdict: "not_registered",
      riskLevel: "medium",
      cmacOk: null,
      allowlisted: null,
      tagStatus: null,
      userAgent: input.userAgent,
      city: input.geoCity,
      countryCode: input.geoCountry,
      lat: resolvedLat,
      lng: resolvedLng,
      geoPrecision,
      productName: configuredProductName,
      reason: scanReason,
      meta,
      traceId: input.traceId,
      ip: input.ip,
      geoCity: input.geoCity,
      geoCountry: input.geoCountry,
      deviceLabel: deviceMeta.platform,
      rawQuery,
    })
    ;

  if (!eventId) {
    await logQrAttempt({
      bid,
      result: scanResult,
      reason: "qr_event_insert_failed",
      ip: input.ip,
      userAgent: input.userAgent,
      city: input.geoCity,
      country: input.geoCountry,
      lat: resolvedLat,
      lng: resolvedLng,
      rawQuery,
      meta,
    }).catch(() => null);
  }

  const qrNow = new Date().toISOString();
  const qrTapTime = tapTimeContext({
    at: qrNow,
    city: input.geoCity,
    country: input.geoCountry,
    tenantSlug,
    timezone: deviceMeta.timezone || null,
  });
  const contract = {
    ok: true,
    eventId: eventId ? String(eventId) : null,
    status: {
      code: publicStatusCode,
      label: staticNfcScan
        ? `${carrierLabel} - identificador copiable`
        : gs1Scan
          ? "Identidad GS1 registrada · QR no criptográfico"
          : "QR / SDK engagement",
      tone: "warn",
      summary: staticNfcScan
        ? "Lectura de un NFC estatico vinculado al manifiesto. El UID y la URL pueden copiarse: no hay SUN, CMAC, anti-replay ni prueba de presencia fisica."
        : gs1Scan
          ? "El GTIN, lote y serie coinciden con el registro GS1 activo y muestran el mismo pasaporte del batch. El QR identifica; no autentica criptograficamente el objeto fisico."
          : "Canal de bajo costo para ficha, CRM, analitica, leads y fidelizacion. No reemplaza la autenticacion criptografica NFC ni activa propiedad automaticamente.",
      reason: staticNfcScan ? "static_nfc_scan" : gs1Scan ? "gs1_identity_resolved" : "qr_scan",
      productState: staticNfcScan
        ? "STATIC_NFC_UNVERIFIED"
        : gs1Scan
          ? "GS1_IDENTITY_RESOLVED_NOT_AUTHENTICATED"
          : "QR_UNVERIFIED",
      carrierProfileCode,
      carrierLabel,
    },
    identity: {
      bid,
      uid: null,
      uidMasked: null,
      eventId: eventId ? String(eventId) : null,
      tenantSlug,
      tenantId: tenantId,
      scanCount: 1,
      gs1: gs1Registry ? {
        registryId: gs1Registry.id,
        gtin: gs1Registry.gtin,
        lot: gs1Registry.lot,
        serial: gs1Registry.serial,
      } : null,
    },
    tenant: {
      id: tenantId,
      slug: tenantSlug,
      name: tenantName,
      vertical: configuredVertical,
      productLabel: configuredProductLabel,
      clubName: configuredClubName,
      tokenizationMode: "nfc_only",
    },
    product: {
      name: configuredProductName,
      winery: configuredBrand,
      region: configuredOrigin,
      varietal: configuredProduct.varietal || sdmConfig.varietal || null,
      vintage: configuredProduct.vintage || sdmConfig.vintage || null,
      category: configuredProductLabel,
      vertical: configuredVertical,
      agro: configuredVertical.toLowerCase() === "agro" || hasConfiguredAgroProfile(configuredAgroProfile)
        ? configuredAgroProfile
        : null,
    },
    provenance: {
      origin: configuredOrigin,
      firstVerified: { at: null, city: null, country: null },
      lastVerifiedLocation: { at: qrNow, city: input.geoCity, country: input.geoCountry, result: publicStatusCode },
      timelineSummary: [{
        at: qrNow,
        result: publicStatusCode,
        city: input.geoCity || "Unknown",
        country: input.geoCountry || "--",
        device: `${deviceMeta.platform} - ${deviceMeta.browser}`,
        lat: resolvedLat,
        lng: resolvedLng,
      }],
    },
    tapContext: {
      city: input.geoCity,
      country: input.geoCountry,
      lat: resolvedLat,
      lng: resolvedLng,
      locationSource,
      accuracyM: null,
      ...qrTapTime,
    },
    tag_tamper: { available: false, status: "not_available", raw: null },
    cta: { claimOwnership: false, registerWarranty: false, provenance: true, tokenize: false },
    allowedActions: ["lead", "feedback", "sommelier"],
    blockedActions: ["ownership", "tokenization", "warranty"],
    trustSignals: { antiReplay: false, tamperRisk: false, tamperStatus: "not_available", tamperSupported: false, lastEventResult: publicStatusCode },
    tapSecurity: { replayDetected: false, freshTap: false, tokenizationEligible: false, policy: staticNfcScan ? "static_nfc_unverified" : gs1Scan ? "gs1_identity_registered_not_authenticated" : "qr_unverified", actionability: "content_and_crm_only", requiresFreshTapForCommercialActions: true },
    troubleshooting: [staticNfcScan
      ? "Este carrier NFC es estatico y copiable. Para titularidad, garantia o NFT se requiere un chip NFC criptografico y una lectura SUN valida."
      : "Para titularidad, garantia o NFT, toca fisicamente el chip NFC seguro."],
    technical: {
      carrierProfileCode,
      carrierLabel,
      declaredInput,
      gs1RegistryId: gs1Registry?.id || null,
      gs1IdentityBound: Boolean(gs1Registry),
      cryptographicNfcAuthentication: false,
      raw: undefined,
    },
  };

  const response = json(contract, 200);
  response.headers.set("x-nexid-trace-id", input.traceId);
  response.headers.set("x-request-id", input.traceId);
  if (eventId) response.headers.set("x-nexid-event-id", String(eventId));
  return response;
}

async function getPassportSnapshot(bid: string, uid: string | undefined): Promise<PassportSnapshot> {
  if (!uid) return null;
  await ensureTokenizationCommercialScopeSchema().catch((error) => {
    const reason = error instanceof Error ?error.message : "tokenization_schema_unavailable";
    console.warn("[tokenization_schema_unavailable]", JSON.stringify({ bid, reason: sanitizePublicErrorReason(reason) }));
  });
  await ensureSunTenantProfilesSchema().catch((error) => {
    const reason = error instanceof Error ? error.message : "sun_tenant_profile_schema_unavailable";
    console.warn("[sun_tenant_profile_schema_unavailable]", JSON.stringify({ bid, reason: sanitizePublicErrorReason(reason) }));
  });
  await ensureCarrierProfileSchema().catch((error) => {
    const reason = error instanceof Error ? error.message : "carrier_profile_schema_unavailable";
    console.warn("[carrier_profile_schema_unavailable]", JSON.stringify({ bid, reason: sanitizePublicErrorReason(reason) }));
  });
  const rows = await sql/*sql*/`
    SELECT
      b.tenant_id::text AS tenant_id,
      b.status::text AS batch_status,
      b.sdm_config AS batch_sdm_config,
      b.claim_pin_required AS batch_claim_pin_required,
      b.active_for_claim AS batch_active_for_claim,
      tn.slug AS tenant_slug,
      tn.name AS tenant_name,
      COALESCE(t.carrier_profile_code, b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', '')) AS carrier_profile_code,
      cp.label AS carrier_label,
      cp.security_level AS carrier_security_level,
      cp.capabilities AS carrier_capabilities,
      cp.consumer_copy AS carrier_consumer_copy,
      cp.admin_copy AS carrier_admin_copy,
      tsp.vertical AS sun_profile_vertical,
      tsp.club_name AS sun_profile_club_name,
      tsp.product_label AS sun_profile_product_label,
      tsp.origin_label AS sun_profile_origin_label,
      tsp.origin_address AS sun_profile_origin_address,
      tsp.origin_lat AS sun_profile_origin_lat,
      tsp.origin_lng AS sun_profile_origin_lng,
      tsp.tokenization_mode AS sun_profile_tokenization_mode,
      tsp.claim_policy AS sun_profile_claim_policy,
      tsp.ownership_policy AS sun_profile_ownership_policy,
      tsp.manifest_policy AS sun_profile_manifest_policy,
      tp.product_name,
      tp.sku,
      tp.winery,
      tp.region,
      tp.grape_varietal,
      tp.vintage,
      tp.harvest_year,
      tp.barrel_months,
      tp.temperature_storage,
      tp.image_url,
      tp.locale_data,
      t.status AS tag_status,
      t.claim_pin_required AS tag_claim_pin_required,
      t.active_for_claim AS tag_active_for_claim,
      t.scan_count,
      first_evt.created_at::text AS first_verified_at,
      first_evt.city AS first_city,
      first_evt.country_code AS first_country,
      last_evt.created_at::text AS last_verified_at,
      last_evt.city AS last_city,
      last_evt.country_code AS last_country,
      last_evt.result AS last_result,
      tok.status AS tokenization_status,
      tok.network AS tokenization_network,
      tok.tx_hash AS tokenization_tx_hash,
      tok.token_id AS tokenization_token_id
    FROM tags t
    JOIN batches b ON b.id = t.batch_id
    JOIN tenants tn ON tn.id = b.tenant_id
    LEFT JOIN carrier_profiles cp ON cp.code = COALESCE(t.carrier_profile_code, b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', ''))
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = b.tenant_id
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    LEFT JOIN LATERAL (
      SELECT created_at, city, country_code
      FROM events e
      WHERE e.batch_id = t.batch_id AND UPPER(e.uid_hex) = UPPER(t.uid_hex)
      ORDER BY created_at ASC
      LIMIT 1
    ) first_evt ON TRUE
    LEFT JOIN LATERAL (
      SELECT created_at, city, country_code, result
      FROM events e
      WHERE e.batch_id = t.batch_id AND UPPER(e.uid_hex) = UPPER(t.uid_hex)
      ORDER BY created_at DESC
      LIMIT 1
    ) last_evt ON TRUE
    LEFT JOIN LATERAL (
      SELECT status, network, tx_hash, token_id
      FROM tokenization_requests tr
      WHERE tr.batch_id = t.batch_id AND UPPER(tr.uid_hex) = UPPER(t.uid_hex)
      ORDER BY requested_at DESC
      LIMIT 1
    ) tok ON TRUE
    WHERE b.bid = ${bid} AND UPPER(t.uid_hex) = UPPER(${uid})
    LIMIT 1
  `;
  return (rows[0] || null) as PassportSnapshot;
}

async function getBatchSunContext(bid: string): Promise<PassportSnapshot> {
  await ensureSunTenantProfilesSchema().catch((error) => {
    const reason = error instanceof Error ? error.message : "sun_tenant_profile_schema_unavailable";
    console.warn("[sun_tenant_profile_schema_unavailable]", JSON.stringify({ bid, reason: sanitizePublicErrorReason(reason) }));
  });
  await ensureCarrierProfileSchema().catch((error) => {
    const reason = error instanceof Error ? error.message : "carrier_profile_schema_unavailable";
    console.warn("[carrier_profile_schema_unavailable]", JSON.stringify({ bid, reason: sanitizePublicErrorReason(reason) }));
  });
  const rows = await sql/*sql*/`
    SELECT
      b.tenant_id::text AS tenant_id,
      b.status::text AS batch_status,
      b.sdm_config AS batch_sdm_config,
      tn.slug AS tenant_slug,
      tn.name AS tenant_name,
      COALESCE(b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', '')) AS carrier_profile_code,
      cp.label AS carrier_label,
      cp.security_level AS carrier_security_level,
      cp.capabilities AS carrier_capabilities,
      cp.consumer_copy AS carrier_consumer_copy,
      cp.admin_copy AS carrier_admin_copy,
      tsp.vertical AS sun_profile_vertical,
      tsp.club_name AS sun_profile_club_name,
      tsp.product_label AS sun_profile_product_label,
      tsp.origin_label AS sun_profile_origin_label,
      tsp.origin_address AS sun_profile_origin_address,
      tsp.origin_lat AS sun_profile_origin_lat,
      tsp.origin_lng AS sun_profile_origin_lng,
      tsp.tokenization_mode AS sun_profile_tokenization_mode,
      tsp.claim_policy AS sun_profile_claim_policy,
      tsp.ownership_policy AS sun_profile_ownership_policy,
      tsp.manifest_policy AS sun_profile_manifest_policy,
      COALESCE(NULLIF(b.sdm_config->>'product_name', ''), NULL::text) AS product_name,
      COALESCE(NULLIF(b.sdm_config->>'sku', ''), NULL::text) AS sku,
      COALESCE(NULLIF(b.sdm_config->>'winery', ''), NULL::text) AS winery,
      COALESCE(NULLIF(b.sdm_config->>'region', ''), NULL::text) AS region,
      COALESCE(NULLIF(b.sdm_config->>'grape_varietal', ''), NULL::text) AS grape_varietal,
      COALESCE(NULLIF(b.sdm_config->>'vintage', ''), NULL::text) AS vintage,
      (NULLIF(b.sdm_config->>'harvest_year', ''))::integer AS harvest_year,
      (NULLIF(b.sdm_config->>'barrel_months', ''))::integer AS barrel_months,
      COALESCE(NULLIF(b.sdm_config->>'temperature_storage', ''), NULL::text) AS temperature_storage,
      COALESCE(NULLIF(b.sdm_config->>'image_url', ''), NULL::text) AS image_url,
      COALESCE((b.sdm_config->'locale_data'), NULL::jsonb) AS locale_data,
      NULL::text AS tag_status,
      NULL::integer AS scan_count,
      NULL::text AS first_verified_at,
      NULL::text AS first_city,
      NULL::text AS first_country,
      NULL::text AS last_verified_at,
      NULL::text AS last_city,
      NULL::text AS last_country,
      NULL::text AS last_result,
      NULL::text AS tokenization_status,
      NULL::text AS tokenization_network,
      NULL::text AS tokenization_tx_hash,
      NULL::text AS tokenization_token_id,
      NULL::boolean AS tag_claim_pin_required,
      NULL::boolean AS tag_active_for_claim,
      b.claim_pin_required AS batch_claim_pin_required,
      b.active_for_claim AS batch_active_for_claim
    FROM batches b
    JOIN tenants tn ON tn.id = b.tenant_id
    LEFT JOIN carrier_profiles cp ON cp.code = COALESCE(b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', ''))
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = b.tenant_id
    WHERE b.bid = ${bid}
    LIMIT 1
  `;
  return (rows[0] || null) as PassportSnapshot;
}

async function getTimelineSummary(bid: string, uid: string | undefined): Promise<TimelineEvent[]> {
  if (!uid) return [];
  const rows = await sql/*sql*/`
    SELECT e.id::text AS event_id, e.created_at::text AS at, e.result, e.city, e.country_code AS country, e.device_label AS device, e.lat, e.lng, e.meta
    FROM events e
    JOIN batches b ON b.id = e.batch_id
    WHERE b.bid = ${bid} AND UPPER(e.uid_hex) = UPPER(${uid})
    ORDER BY e.created_at DESC
    LIMIT 6
  `;
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const meta = (row.meta && typeof row.meta === "object") ?row.meta as Record<string, unknown> : {};
    const sensors = (meta.sensors && typeof meta.sensors === "object") ?meta.sensors as Record<string, unknown> : {};
    const sunContext = (meta.sun_context && typeof meta.sun_context === "object") ? meta.sun_context as Record<string, unknown> : {};
    const sunGeo = (sunContext.geo && typeof sunContext.geo === "object") ? sunContext.geo as Record<string, unknown> : {};
    const geoEvidence = (meta.geo_evidence && typeof meta.geo_evidence === "object") ? meta.geo_evidence as Record<string, unknown> : {};
    const rawAccuracy = sunGeo.accuracy ?? sunGeo.accuracy_m ?? geoEvidence.accuracy_m;
    const accuracy = Number(rawAccuracy);
    return {
      eventId: row.event_id ?String(row.event_id) : null,
      at: row.at ?String(row.at) : null,
      result: row.result ?String(row.result) : null,
      city: row.city ?String(row.city) : null,
      country: row.country ?String(row.country) : null,
      device: row.device ?String(row.device) : null,
      lat: typeof row.lat === "number" ?Number(row.lat) : null,
      lng: typeof row.lng === "number" ?Number(row.lng) : null,
      locationSource: sunGeo.source ? String(sunGeo.source) : geoEvidence.source ? String(geoEvidence.source) : null,
      accuracyM: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : null,
      sensorTempC: typeof sensors.temperatureC === "number" ?Number(sensors.temperatureC) : null,
      sensorHumidity: typeof sensors.humidityPct === "number" ?Number(sensors.humidityPct) : null,
      stage: typeof sensors.stage === "string" ?String(sensors.stage) : null,
    } satisfies TimelineEvent;
  });
}

async function getCtaTimelineSummary(bid: string, uid: string | undefined): Promise<TimelineEvent[]> {
  if (!uid) return [];
  const actions = await listDemoCta(bid, uid);
  if (!actions.length) return [];
  const lifecycle = buildLifecycleState(bid, uid, actions);
  return lifecycle.timeline
    .filter((item) => item.status === "recorded" && item.at)
    .map((item) => ({
      at: item.at || null,
      result: `CTA_${String(item.stage || "").toUpperCase()}`,
      city: null,
      country: null,
      device: "public_cta",
      lat: null,
      lng: null,
      sensorTempC: null,
      sensorHumidity: null,
      stage: item.stage || null,
    }));
}

function buildPublicContract(params: {
  bid: string;
  uid: string | null;
  ctr: number | null;
  result: SunResult['body'];
  passport: PassportSnapshot;
  timeline: TimelineEvent[];
  tap: { userAgent: string; city: string | null; country: string | null; lat: number | null; lng: number | null };
}) {
  const status = params.result.result || (params.result.ok ?'VALID' : 'INVALID');
  const reason = params.result.reason || 'sin_observaciones';
  const resultMeta = params.result as Record<string, unknown>;
  const trust = resolveTrustState(status, reason, params.result.product_state || null, resultMeta);
  const effectiveProductState = trust.code === "SUN_PROFILE_MISMATCH"
    ? "SUN_PROFILE_MISMATCH"
    : params.result.product_state || null;
  const verdictRisk = mapVerdictAndRisk({ statusCode: trust.code, productState: effectiveProductState, reason });
  const tenantResolution = resolveSunTenantProfile({ bid: params.bid, passport: params.passport, result: params.result as Record<string, unknown> });
  const setupDashboardBase = dashboardBaseUrl();
  const setupEventId = (params.result as { event_id?: string | number | null }).event_id ? String((params.result as { event_id?: string | number | null }).event_id) : null;
  const setupUa = summarizeUserAgent(params.tap.userAgent);
  const troubleshooting = buildTroubleshooting(reason, params.bid, resultMeta);
  const resultCarrierProfileCode = String(resultMeta.carrier_profile_code || "").trim().toLowerCase();
  const carrierProfileCode = params.passport?.carrier_profile_code
    || (resultCarrierProfileCode === "ntag424_dna" || resultCarrierProfileCode === "ntag424_dna_tt"
      ? resultCarrierProfileCode
      : null);
  const inferredCryptoCarrier = carrierProfileCode === "ntag424_dna"
    || carrierProfileCode === "ntag424_dna_tt";
  const carrierLabel = params.passport?.carrier_label
    || (carrierProfileCode === "ntag424_dna_tt" ?"NTAG 424 DNA TagTamper TT" : null)
    || (carrierProfileCode === "ntag424_dna" ?"NTAG 424 DNA" : null)
    || (carrierProfileCode === "ntag216" ?"NTAG216" : null)
    || (carrierProfileCode === "ntag215" ?"NTAG215" : null)
    || (carrierProfileCode === "ntag213" ?"NTAG213" : null)
    || (carrierProfileCode === "gs1_digital_link" ?"QR GS1 Digital Link" : null)
    || (carrierProfileCode === "qr_basic" ?"QR comun" : null)
    || (inferredCryptoCarrier ?"NTAG 424 DNA" : "Carrier sin configurar");
  const carrierSecurityLevel = params.passport?.carrier_security_level || null;
  const rawCarrierConsumerCopy = params.passport?.carrier_consumer_copy as unknown;
  const carrierConsumerCopy = typeof rawCarrierConsumerCopy === "string"
    ?rawCarrierConsumerCopy
    : rawCarrierConsumerCopy && typeof rawCarrierConsumerCopy === "object"
      ?String(
          (rawCarrierConsumerCopy as { body?: unknown }).body
          || (rawCarrierConsumerCopy as { headline?: unknown }).headline
          || (rawCarrierConsumerCopy as { disclaimer?: unknown }).disclaimer
          || (rawCarrierConsumerCopy as { summary?: unknown }).summary
          || (rawCarrierConsumerCopy as { title?: unknown }).title
          || "",
        )
      : null;
  const carrierCapabilities = (params.passport?.carrier_capabilities || {}) as Record<string, unknown>;
  const readCarrierCapability = (camelKey: string, snakeKey: string, fallback: boolean) => {
    const value = carrierCapabilities[camelKey] ?? carrierCapabilities[snakeKey];
    return typeof value === "boolean" ?value : fallback;
  };
  const carrierSupportsOwnership = readCarrierCapability("supportsOwnership", "supports_ownership", inferredCryptoCarrier);
  const carrierSupportsTokenization = readCarrierCapability("supportsTokenization", "supports_tokenization", inferredCryptoCarrier);
  const carrierSupportsLoyalty = readCarrierCapability("supportsLoyalty", "supports_loyalty", true);
  const carrierSupportsMarketplace = readCarrierCapability("supportsMarketplace", "supports_marketplace", true);
  const publicAgroProfile = normalizeAgroProductProfile({
    batchConfig: params.passport?.batch_sdm_config,
    tagLocaleData: params.passport?.locale_data,
  });
  const hasPublicAgroProfile = hasConfiguredAgroProfile(publicAgroProfile);
  if (!tenantResolution.ok) {
    const tenantSlug = tenantResolution.tenantSlug || "tenant-setup-required";
    const setupQuery = new URLSearchParams({ tenant: tenantSlug, fromTap: "1", action: "setup-required" });
    if (setupEventId) setupQuery.set("eventId", setupEventId);
    const setupProductName = params.passport?.product_name || params.passport?.sku || `Batch ${params.bid}`;
    const setupHasValidTagEvidence = ["VALID", "VALID_AUTHENTIC", "VALID_CLOSED", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY", "MANUAL_OPENED", "VALID_UNKNOWN_TAMPER"].includes(trust.code);
    const setupIsReplay = trust.code === "REPLAY_SUSPECT" || verdictRisk.verdict === "replay_suspect";
    const setupRiskLevel = setupIsReplay || verdictRisk.verdict === "tampered"
      ?"high"
      : setupHasValidTagEvidence
        ?"medium"
        : verdictRisk.riskLevel;
    const setupTapTime = tapTimeContext({
      at: params.passport?.last_verified_at || params.timeline[0]?.at || new Date().toISOString(),
      city: params.passport?.last_city || params.timeline[0]?.city || params.tap.city,
      country: params.passport?.last_country || params.timeline[0]?.country || params.tap.country,
      tenantSlug,
    });
    return {
      ok: false,
      status: {
        code: "TENANT_SETUP_REQUIRED",
        label: "Configuracion del tenant pendiente",
        tone: "warn",
        summary: "El tap fue procesado, pero el tenant no tiene perfil SUN/manifiesto/ownership completo para publicar CTAs de consumidor.",
        reason: tenantResolution.message,
        authStatus: params.result.auth_status || status,
        productState: effectiveProductState,
        tamperSupported: Boolean(params.result.tamper_supported),
        tamperStatus: params.result.tamper_status || "UNKNOWN",
        tamperSource: params.result.tamper_source || "unavailable",
        tamperReason: params.result.tamper_reason || null,
        encPlainStatusByte: params.result.enc_plain_status_byte || null,
        carrierProfileCode,
        carrierLabel,
        carrierSecurityLevel,
        carrierConsumerCopy,
      },
      identity: {
        bid: params.bid,
        uid: null,
        uidMasked: maskIdentityValue(params.uid || ""),
        readCounter: params.ctr,
        eventId: setupEventId,
        tagStatus: params.passport?.tag_status || null,
        scanCount: params.passport?.scan_count || 0,
        tenantSlug,
        tenantId: tenantResolution.tenantId,
        carrierProfileCode,
        carrierLabel,
        carrierSecurityLevel,
      },
      tenant: {
        id: tenantResolution.tenantId,
        slug: tenantSlug,
        name: tenantResolution.tenantName || "Tenant sin onboarding completo",
        vertical: null,
        productLabel: null,
        clubName: null,
        tokenizationMode: "manual",
        setupRequired: true,
        missing: tenantResolution.missing,
      },
      condition: {
        state: "setup_required",
        label: "Onboarding pendiente",
        summary: "La prueba SUN fue procesada, pero faltan datos del tenant/manifiesto para habilitar acciones comerciales.",
        claimMode: "not_public",
        tokenizationPolicy: "blocked_tenant_setup",
        marketplaceMode: "proof_only",
        recommendedNextStep: "Completar perfil SUN, manifiesto y politica de ownership del tenant.",
        requirements: ["tenant activo", "perfil SUN completo", "manifiesto importado"],
        carrierProfileCode,
        carrierLabel,
        carrierSecurityLevel,
      },
      rightsPolicy: {
        vertical: "generic",
        verticalLabel: "Tenant sin perfil SUN",
        conditionState: "setup_required",
        claimMode: "not_public",
        marketplaceMode: "proof_only",
        tokenizationPolicy: "blocked_tenant_setup",
        requirements: ["tenant activo", "perfil SUN completo", "manifiesto importado"],
        canClaimPublicly: false,
        canTokenize: false,
        requiresReview: true,
        statusTitle: "Onboarding pendiente",
        statusSummary: "La trazabilidad queda visible, pero ownership, marketplace, rewards y tokenizacion se bloquean hasta configurar el tenant.",
        consumerCopy: "Este producto fue procesado por SUN, pero la marca todavia debe completar su perfil antes de habilitar beneficios.",
        enterpriseCopy: "Completar tenant SUN profile, manifiesto por UID y ownership policy antes de publicar CTAs.",
        recommendedNextStep: "Completar perfil SUN, manifiesto y politica de ownership del tenant.",
      },
      product: {
        name: setupProductName,
        winery: params.passport?.winery || null,
        region: params.passport?.region || null,
        varietal: params.passport?.grape_varietal || null,
        vintage: params.passport?.vintage || null,
        harvestYear: params.passport?.harvest_year || null,
        barrelMonths: params.passport?.barrel_months || null,
        storage: params.passport?.temperature_storage || null,
        alcohol: null,
        bottle: null,
        serving: null,
        category: null,
        vertical: null,
        agro: hasPublicAgroProfile ? publicAgroProfile : null,
      },
      provenance: {
        origin: params.passport?.region || null,
        firstVerified: { at: params.passport?.first_verified_at || null, city: params.passport?.first_city || null, country: params.passport?.first_country || null },
        lastVerifiedLocation: { at: params.passport?.last_verified_at || null, city: params.passport?.last_city || params.tap.city || null, country: params.passport?.last_country || params.tap.country || null, result: params.passport?.last_result || null },
        timelineSummary: params.timeline,
      },
      tokenization: {
        status: "blocked_tenant_setup",
        network: params.passport?.tokenization_network || null,
        txHash: params.passport?.tokenization_tx_hash || null,
        tokenId: params.passport?.tokenization_token_id || null,
      },
      trustSignals: {
        antiReplay: trust.code !== "REPLAY_SUSPECT",
        tamperRisk: trust.code === "TAMPER_RISK",
        tamperStatus: params.result.tamper_status || "UNKNOWN",
        tamperSupported: Boolean(params.result.tamper_supported),
        lastEventResult: params.passport?.last_result || null,
      },
      tapSecurity: {
        replayDetected: trust.code === "REPLAY_SUSPECT" || verdictRisk.verdict === "replay_suspect",
        freshTap: false,
        tokenizationEligible: false,
        policy: "blocked_tenant_setup",
        commercialPolicy: "blocked_tenant_setup",
        conditionState: "setup_required",
        claimMode: "not_public",
        marketplaceMode: "proof_only",
        requirements: ["tenant activo", "perfil SUN completo", "manifiesto importado"],
        reason: tenantResolution.message,
      },
      iot: {
        wineryLocation: null,
        wineryCoordinates: null,
        altitude: null,
        oakType: null,
        originLabel: null,
        originType: null,
        sensorSnapshot: { cellarTemperature: null, humidity: null, lightExposure: null, transitShock: null },
        sensorHistory: [],
      },
      tapContext: {
        os: setupUa.os,
        browser: setupUa.browser,
        deviceType: setupUa.device,
        city: params.tap.city,
        country: params.tap.country,
        lat: roundCoord(params.tap.lat, 2),
        lng: roundCoord(params.tap.lng, 2),
        locationSource: params.tap.lat != null && params.tap.lng != null ? "ip_geo" : "none",
        accuracyM: null,
        ...setupTapTime,
      },
      quality: { score: null, tier: null, basis: "unavailable" },
      cta: {
        claimOwnership: false,
        registerWarranty: false,
        provenance: false,
        tokenize: false,
        clubName: null,
        registerUrl: `${setupDashboardBase}/onboarding?${setupQuery.toString()}`,
        portalUrl: `${setupDashboardBase}/onboarding?${setupQuery.toString()}`,
        marketplaceUrl: `${setupDashboardBase}/onboarding?${setupQuery.toString()}`,
        rewardsUrl: `${setupDashboardBase}/onboarding?${setupQuery.toString()}`,
      },
      troubleshooting: [
        ...troubleshooting,
        "Completar perfil SUN del tenant antes de activar CTAs publicas.",
        `Campos faltantes: ${tenantResolution.missing.join(", ")}`,
        "Importar manifiesto real con product_name/sku por UID antes de habilitar ownership/tokenizacion.",
      ],
      eventId: setupEventId,
      tenantId: tenantResolution.tenantId,
      tenantSlug,
      batchId: params.bid,
      tagId: params.uid ?maskIdentityValue(params.uid) : null,
      uidMasked: maskIdentityValue(params.uid || ""),
      verdict: setupHasValidTagEvidence ?"tenant_setup_required_valid_tag_evidence" : "tenant_setup_required",
      riskLevel: setupRiskLevel,
      tag_tamper: params.result.tag_tamper || null,
      productName: setupProductName,
      allowedActions: [],
      blockedActions: ["claim", "warranty", "provenance", "tokenization", "marketplace", "rewards"],
    };
  }

  const tenantProfile = tenantResolution.profile;
  const fallbackName = tenantProfile.product.name || `NexID Verified Asset · ${params.bid}`;
  const fallbackWinery = tenantProfile.product.winery || tenantProfile.tenantName;
  const fallbackRegion = tenantProfile.product.region || tenantProfile.origin.label;
  const fallbackVarietal = tenantProfile.product.varietal;
  const fallbackVintage = tenantProfile.product.vintage;
  const fallbackHarvestYear = tenantProfile.product.harvestYear;
  const fallbackBarrelMonths = tenantProfile.product.barrelMonths;
  const fallbackStorage = tenantProfile.product.storage || null;
  const fallbackAlcohol = tenantProfile.product.alcohol || null;
  const fallbackBottle = tenantProfile.product.bottle || null;
  const fallbackServing = tenantProfile.product.serving || null;
  const fallbackImageUrl = tenantProfile.product.imageUrl || null;
  const fallbackMedia = tenantProfile.product.media || null;
  const tenantSlug = tenantProfile.tenantSlug;
  const tenantId = tenantProfile.tenantId;
  const webBase = (process.env.NEXT_PUBLIC_WEB_URL || "https://nexid.lat").replace(/^['"]|['"]$/g, "").trim();
  const eventId = (params.result as { event_id?: string | number | null }).event_id ?String((params.result as { event_id?: string | number | null }).event_id) : null;
  const tapQuery = new URLSearchParams({
    tenant: tenantSlug,
    fromTap: "1",
  });
  if (eventId) tapQuery.set("eventId", eventId);
  const wineryLocation = tenantProfile.origin.address || tenantProfile.origin.label || null;
  const hasConfiguredSimulation = [
    tenantProfile.product.simulatedTempC,
    tenantProfile.product.simulatedHumidityPct,
    tenantProfile.product.simulatedLight,
    tenantProfile.product.simulatedShock,
  ].some((value) => value != null && String(value).trim() !== "");
  const sensorEvidence = buildSunSensorEvidence({
    timeline: params.timeline,
    fallbackStorage,
    barrelMonths: params.passport?.barrel_months || fallbackBarrelMonths,
    simulatedTempC: tenantProfile.product.simulatedTempC,
    simulatedHumidityPct: tenantProfile.product.simulatedHumidityPct,
    simulatedLight: tenantProfile.product.simulatedLight,
    simulatedShock: tenantProfile.product.simulatedShock,
    allowSimulation: (params.bid.toUpperCase().startsWith("DEMO-") && tenantSlug === "demobodega") || hasConfiguredSimulation,
  });
  const sensorHistory = sensorEvidence.history;
  const timelineLatest = params.timeline[0] || null;
  const timelineOldest = params.timeline[params.timeline.length - 1] || null;
  const ua = summarizeUserAgent(params.tap.userAgent);
  const currentTapTime = tapTimeContext({
    at: params.passport?.last_verified_at || timelineLatest?.at || new Date().toISOString(),
    city: params.passport?.last_city || timelineLatest?.city || params.tap.city,
    country: params.passport?.last_country || timelineLatest?.country || params.tap.country,
    tenantSlug,
  });
  const isVerifiedOpenedTap = verdictRisk.verdict === "valid_opened"
    || ["VALID_OPENED", "VALID_OPENED_PREVIOUSLY", "OPENED", "OPENED_PREVIOUSLY", "MANUAL_OPENED"].includes(trust.code);
  const hasValidatedTagMessage = verdictRisk.verdict === "valid" || isVerifiedOpenedTap;
  const rightsPolicy = resolveRightsPolicy({
    verdict: verdictRisk.verdict,
    vertical: tenantProfile.vertical,
    tokenizationMode: tenantProfile.tokenizationMode,
    claimPolicy: tenantProfile.claimPolicy,
    ownershipPolicy: tenantProfile.ownershipPolicy,
    statusCode: trust.code,
    productState: effectiveProductState,
    reason,
  });

  const claimPinRequired = params.passport?.tag_claim_pin_required !== null && params.passport?.tag_claim_pin_required !== undefined
    ? Boolean(params.passport?.tag_claim_pin_required)
    : Boolean(params.passport?.batch_claim_pin_required || tenantProfile.ownershipPolicy?.claim_pin_required);

  const activeForClaim = params.passport?.tag_active_for_claim !== null && params.passport?.tag_active_for_claim !== undefined
    ? Boolean(params.passport?.tag_active_for_claim)
    : params.passport?.batch_active_for_claim !== null && params.passport?.batch_active_for_claim !== undefined
    ? Boolean(params.passport?.batch_active_for_claim)
    : true;

  const carrierAllowedActions = new Set(rightsPolicy.allowedActions);
  const carrierBlockedActions = new Set(rightsPolicy.blockedActions);
  const blockCarrierAction = (action: (typeof rightsPolicy.allowedActions)[number]) => {
    carrierAllowedActions.delete(action);
    carrierBlockedActions.add(action);
  };
  if (!carrierSupportsOwnership) blockCarrierAction("claim");
  if (!carrierSupportsTokenization) blockCarrierAction("tokenization");
  if (!carrierSupportsLoyalty) {
    blockCarrierAction("join");
    blockCarrierAction("rewards");
  }
  if (!carrierSupportsMarketplace) {
    blockCarrierAction("save");
    blockCarrierAction("join");
  }
  const carrierRequirements = [
    !carrierSupportsOwnership ? `${carrierLabel}: ownership publico requiere compra/custodia o carrier seguro.` : "",
    !carrierSupportsTokenization ? `${carrierLabel}: tokenizacion automatica requiere NTAG 424 DNA/TT o aprobacion manual.` : "",
  ].filter(Boolean);
  const effectiveRequirements = Array.from(new Set([...rightsPolicy.requirements, ...carrierRequirements]));
  const actionMatrix = {
    allowedActions: Array.from(carrierAllowedActions),
    blockedActions: Array.from(carrierBlockedActions),
  };
  const compatibilityTokenizationPolicy = actionMatrix.allowedActions.includes("tokenization")
    ? isVerifiedOpenedTap
      ? "verified_opened_tap"
      : "fresh_valid_tap"
    : !carrierSupportsTokenization
      ? "blocked_carrier_profile"
      : String(rightsPolicy.tokenizationPolicy || "").startsWith("blocked_")
      ? rightsPolicy.tokenizationPolicy
      : verdictRisk.verdict === "replay_suspect"
        ? "blocked_replay"
        : verdictRisk.verdict === "tampered"
          ? "blocked_tamper"
          : "blocked_policy";
  const tokenizationPolicy = compatibilityTokenizationPolicy;

  return {
    ok: Boolean(params.result.ok),
    status: {
      code: trust.code,
      label: trust.label,
      tone: trust.tone,
      summary: trust.summary,
      reason,
      authStatus: params.result.auth_status || status,
      productState: effectiveProductState,
      tamperSupported: Boolean(params.result.tamper_supported),
      tamperStatus: params.result.tamper_status || "UNKNOWN",
      tamperSource: params.result.tamper_source || "unavailable",
      tamperReason: params.result.tamper_reason || null,
      encPlainStatusByte: params.result.enc_plain_status_byte || null,
      carrierProfileCode,
      carrierLabel,
      carrierSecurityLevel,
      carrierConsumerCopy,
    },
    identity: {
      bid: params.bid,
      uid: null,
      uidMasked: maskIdentityValue(params.uid || ""),
      readCounter: params.ctr,
      eventId,
      tagStatus: params.passport?.tag_status || null,
      scanCount: params.passport?.scan_count || 0,
      tenantSlug,
      tenantId,
      carrierProfileCode,
      carrierLabel,
      carrierSecurityLevel,
    },
    tenant: {
      id: tenantId,
      slug: tenantSlug,
      name: tenantProfile.tenantName,
      vertical: tenantProfile.vertical,
      productLabel: tenantProfile.productLabel,
      clubName: tenantProfile.clubName,
      tokenizationMode: tenantProfile.tokenizationMode,
    },
    condition: {
      state: rightsPolicy.conditionState,
      label: rightsPolicy.statusTitle,
      summary: rightsPolicy.statusSummary,
      claimMode: rightsPolicy.claimMode,
      tokenizationPolicy,
      marketplaceMode: rightsPolicy.marketplaceMode,
      recommendedNextStep: rightsPolicy.recommendedNextStep,
      requirements: effectiveRequirements,
      carrierProfileCode,
      carrierLabel,
      carrierSecurityLevel,
    },
    rightsPolicy: {
      vertical: rightsPolicy.vertical,
      verticalLabel: rightsPolicy.verticalLabel,
      conditionState: rightsPolicy.conditionState,
      claimMode: rightsPolicy.claimMode,
      marketplaceMode: rightsPolicy.marketplaceMode,
      tokenizationPolicy,
      requirements: effectiveRequirements,
      canClaimPublicly: rightsPolicy.canClaimPublicly && actionMatrix.allowedActions.includes("claim") && activeForClaim,
      canTokenize: actionMatrix.allowedActions.includes("tokenization") && activeForClaim,
      requiresReview: rightsPolicy.requiresReview,
      statusTitle: rightsPolicy.statusTitle,
      statusSummary: rightsPolicy.statusSummary,
      consumerCopy: rightsPolicy.consumerCopy,
      enterpriseCopy: rightsPolicy.enterpriseCopy,
      recommendedNextStep: rightsPolicy.recommendedNextStep,
      claimPinRequired,
      activeForClaim,
    },
    product: {
      name: params.passport?.product_name || params.passport?.sku || fallbackName,
      winery: params.passport?.winery || fallbackWinery,
      region: params.passport?.region || fallbackRegion,
      varietal: params.passport?.grape_varietal || fallbackVarietal,
      vintage: params.passport?.vintage || fallbackVintage,
      harvestYear: params.passport?.harvest_year || fallbackHarvestYear,
      barrelMonths: params.passport?.barrel_months || fallbackBarrelMonths,
      storage: params.passport?.temperature_storage || fallbackStorage,
      alcohol: fallbackAlcohol,
      bottle: fallbackBottle,
      serving: fallbackServing,
      notes: tenantProfile.product.notes || null,
      tasting_notes: tenantProfile.product.tasting_notes || null,
      maridaje: tenantProfile.product.maridaje || null,
      oakType: tenantProfile.product.oakType || null,
      imageUrl: params.passport?.image_url || fallbackImageUrl,
      image_url: params.passport?.image_url || fallbackImageUrl,
      media: fallbackMedia,
      category: tenantProfile.productLabel,
      vertical: tenantProfile.vertical,
      agro: tenantProfile.vertical.toLowerCase() === "agro" || hasPublicAgroProfile
        ? publicAgroProfile
        : null,
    },
    provenance: {
      origin: params.passport?.region || params.passport?.winery || wineryLocation || null,
      firstVerified: {
        at: params.passport?.first_verified_at || timelineOldest?.at || null,
        city: params.passport?.first_city || timelineOldest?.city || params.tap.city || null,
        country: params.passport?.first_country || timelineOldest?.country || params.tap.country || null,
      },
      lastVerifiedLocation: {
        at: params.passport?.last_verified_at || timelineLatest?.at || null,
        city: params.passport?.last_city || timelineLatest?.city || params.tap.city || null,
        country: params.passport?.last_country || timelineLatest?.country || params.tap.country || null,
        result: params.passport?.last_result || timelineLatest?.result || null,
      },
      timelineSummary: params.timeline,
    },
    tokenization: {
      status: params.passport?.tokenization_status || 'none',
      network: params.passport?.tokenization_network || null,
      txHash: params.passport?.tokenization_tx_hash || null,
      tokenId: params.passport?.tokenization_token_id || null,
    },
    trustSignals: {
      antiReplay: trust.code !== 'REPLAY_SUSPECT',
      tamperRisk: trust.code === 'TAMPER_RISK',
      tamperStatus: params.result.tamper_status || "UNKNOWN",
      tamperSupported: Boolean(params.result.tamper_supported),
      lastEventResult: params.passport?.last_result || null,
    },
    tapSecurity: {
      replayDetected: trust.code === "REPLAY_SUSPECT" || verdictRisk.verdict === "replay_suspect",
      freshTap: hasValidatedTagMessage && verdictRisk.verdict !== "replay_suspect",
      tokenizationEligible: actionMatrix.allowedActions.includes("tokenization"),
      policy: tokenizationPolicy,
      commercialPolicy: tokenizationPolicy,
      conditionState: rightsPolicy.conditionState,
      claimMode: rightsPolicy.claimMode,
      marketplaceMode: rightsPolicy.marketplaceMode,
      requirements: effectiveRequirements,
      reason,
    },
    iot: {
      wineryLocation,
      wineryCoordinates: tenantProfile.origin.coordinates,
      altitude: tenantProfile.origin.altitude || null,
      oakType: tenantProfile.product.oakType || null,
      originLabel: tenantProfile.origin.label,
      originType: tenantProfile.vertical,
      sensorEvidenceKind: sensorEvidence.kind,
      sensorSnapshot: sensorEvidence.snapshot,
      sensorHistory,
    },
    tapContext: {
      os: ua.os,
      browser: ua.browser,
      deviceType: ua.device,
      city: params.tap.city,
      country: params.tap.country,
      lat: roundCoord(params.tap.lat, 2),
      lng: roundCoord(params.tap.lng, 2),
      locationSource: params.tap.lat != null && params.tap.lng != null ? "ip_geo" : "none",
      accuracyM: null,
      ...currentTapTime,
    },
    quality: { score: null, tier: null, basis: "unavailable" },
    cta: {
      claimOwnership: actionMatrix.allowedActions.includes("claim"),
      registerWarranty: actionMatrix.allowedActions.includes("warranty"),
      provenance: actionMatrix.allowedActions.includes("provenance"),
      tokenize: actionMatrix.allowedActions.includes("tokenization"),
      clubName: tenantProfile.clubName,
      registerUrl: `${webBase}/me?${tapQuery.toString()}&action=register`,
      portalUrl: `${webBase}/me?${tapQuery.toString()}&action=portal`,
      marketplaceUrl: `${webBase}/me/marketplace?${tapQuery.toString()}&action=marketplace`,
      rewardsUrl: `${webBase}/me/rewards?${tapQuery.toString()}&action=rewards`,
    },
    troubleshooting,
    eventId,
    tenantId,
    tenantSlug,
    batchId: params.bid,
    tagId: params.uid ?maskIdentityValue(params.uid) : null,
    uidMasked: maskIdentityValue(params.uid || ""),
    verdict: verdictRisk.verdict,
    riskLevel: verdictRisk.riskLevel,
    tag_tamper: params.result.tag_tamper || null,
    productName: params.passport?.product_name || params.passport?.sku || fallbackName,
    allowedActions: actionMatrix.allowedActions,
    blockedActions: actionMatrix.blockedActions,
  };
}


function maskIdentityValue(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "N/A";
  if (raw.length <= 6) return `${raw.slice(0, 1)}***${raw.slice(-1)}`;
  return `${raw.slice(0, 4)}****${raw.slice(-2)}`;
}

function renderSunHtml(rawContract: ReturnType<typeof buildPublicContract>, shareToken: string | null, locale: SunLocale, currentUrl: URL) {
  // Keep escaping at the final HTML boundary. The raw contract remains
  // available only for script-safe JSON used by API calls.
  const contract = escapeHtmlTreeForMarkup(rawContract);
  const htmlText = escapeHtmlText;
  const copy = getSunCopy(locale);
  const langUrl = (lang: "es-AR" | "pt-BR" | "en") => {
    const next = new URL(currentUrl.toString());
    next.searchParams.set("lang", lang);
    return htmlText(next.pathname + next.search);
  };
  const labels = locale === "pt-BR"
    ?{
      manualOpened: "Estado aberto declarado por operador; não é uma medição criptográfica do conteúdo.",
      opened: "Mensagem NFC validada; o TT informa abertura.",
      openedPreviously: "Mensagem NFC validada; o histórico TT informa abertura anterior.",
      unknownTamper: "Mensagem NFC validada; este lote não fornece estado TT de abertura.",
      commercialState: "Estado comercial",
      risk: "Risco",
      hold: "SUSPENSO",
      review: "REVISÃO",
      reviewPrev: "REVISÃO ABERTO ANTES",
      ok: "OK",
      dashboardSync: "Sincronizado com painel: Analytics · Eventos · Tags",
      events: "Eventos",
      tokenization: "Tokenização",
      device: "Dispositivo",
      wineProfile: "Perfil do vinho",
      traceability: "Rastreabilidade",
      sensorIntelligence: "Inteligência de sensores",
      geoContext: "Contexto geográfico",
      consumerJourney: "Jornada do consumidor",
      mapLocalTitle: "Contexto local · origem declarada e toque informado",
      mapUnavailable: "Mapa indisponível: o toque não possui um par válido de coordenadas WGS84.",
      mapGlobalTitle: "Contexto global · posição informada do toque",
      mapLegend: "Origem declarada ↔ toque informado (referência linear; não é um percurso)",
      routeSummary: "Comparação geográfica",
      routeDistance: "Distância geodésica estimada",
      routeRegion: "Região de leitura",
      actionSubtitle: "Fluxos de consumidor, garantia e rastreabilidade.",
      varietal: "Varietal",
      vintage: "Safra",
      harvest: "Colheita",
      barrel: "Barril",
      alcohol: "Álcool",
      serving: "Serviço",
      bottleFormat: "Garrafa",
      origin: "Origem",
      winery: "Vinícola",
      altitude: "Altitude",
      oak: "Carvalho",
      cellarTemp: "Temp. adega",
      humidity: "Umidade",
      light: "Luz",
      transit: "Trânsito",
      os: "SO",
      browser: "Navegador",
      tapLocation: "Local do toque",
      months: "meses",
      linkMarketplace: "Marketplace",
      linkRewards: "Promoções e benefícios",
      linkRegister: "Criar conta",
      linkPortal: "Ir para meu portal",
      tapHelp: "Se a mensagem NFC for validada, pediremos login/registro. Qualquer vínculo, titularidade ou benefício seguirá a política e as evidências exigidas.",
      demoMode: "Modo demo: fallback sem assinatura habilitado para lotes DEMO-*.",
      statusLabel: "Status",
      networkLabel: "Rede",
      tokenIdLabel: "Token ID",
      txLabel: "Tx",
      actionDone: "Concluído ✓",
      provenanceLoaded: "Proveniência",
      eventsLoaded: "eventos carregados",
      technicalTitle: "Detalhes técnicos",
      heroRoute: "Rota SUN",
      eventLabel: "Evento",
      riskReplay: "replay suspeito",
      riskManual: "abertura manual",
      riskTamper: "violação/aberto",
      riskPrev: "aberto anteriormente",
      riskControlled: "controlado",
      journey1: "1) Validar identidade",
      journey2: "2) Vincular ao tenant",
      journey3: "3) Desbloquear benefícios",
      journey1Desc: "Use seu e-mail/celular para criar sessão segura.",
      journey2Desc: "Conectamos este toque ao produto no seu portal.",
      journey3Desc: "Marketplace, garantia e recompensas ficam ativas.",
      mapStoryTitle: "Contexto geográfico informado",
      mapStorySubtitle: "A posição informada conserva sua fonte e precisão. Quando há origem declarada, a linha é apenas uma referência linear; não prova percurso nem custódia.",
      mapOriginStep: "Origem declarada",
      mapTapStep: "Local do toque informado",
      mapTokenStep: "Token / NFT",
      mapOwnerStep: "Conta e beneficios",
      mapLedgerTitle: "Ledger visual",
      mapInvestorSignal: "Sinal para marca",
      mapConsumerSignal: "Sinal para consumidor",
    }
    : locale === "en"
      ?{
        manualOpened: "Open state declared by an operator; this is not a cryptographic measurement of the contents.",
        opened: "NFC message validated; TT reports an open state.",
        openedPreviously: "NFC message validated; TT history reports a previous opening.",
        unknownTamper: "NFC message validated; this batch does not provide a TT open state.",
        commercialState: "Commercial state",
        risk: "Risk",
        hold: "HOLD",
        review: "REVIEW",
        reviewPrev: "REVIEW PREVIOUSLY OPENED",
        ok: "OK",
        dashboardSync: "Dashboard sync: Analytics · Events · Tags",
        events: "Events",
        tokenization: "Tokenization",
        device: "Device",
        wineProfile: "Wine profile",
        traceability: "Traceability",
        sensorIntelligence: "Sensor intelligence",
        geoContext: "Geo context",
        consumerJourney: "Consumer journey",
        mapLocalTitle: "Local context · declared origin and reported tap",
        mapUnavailable: "Map unavailable: the tap has no valid WGS84 coordinate pair.",
        mapGlobalTitle: "Global context · reported tap position",
        mapLegend: "Declared origin ↔ reported tap (linear reference, not a traveled route)",
        routeSummary: "Geographic comparison",
        routeDistance: "Estimated geodesic distance",
        routeRegion: "Read region",
        actionSubtitle: "Consumer, warranty and traceability workflows.",
        varietal: "Varietal",
        vintage: "Vintage",
        harvest: "Harvest",
        barrel: "Barrel",
        alcohol: "Alcohol",
        serving: "Serving",
        bottleFormat: "Bottle format",
        origin: "Origin",
        winery: "Winery",
        altitude: "Altitude",
        oak: "Oak",
        cellarTemp: "Cellar temp",
        humidity: "Humidity",
        light: "Light",
        transit: "Transit",
        os: "OS",
        browser: "Browser",
        tapLocation: "Tap location",
        months: "months",
        linkMarketplace: "Marketplace",
        linkRewards: "Promos & rewards",
        linkRegister: "Register",
        linkPortal: "Open portal",
        tapHelp: "If the NFC message is validated, we will request sign-in/registration. Any link, ownership or benefit remains subject to policy and required evidence.",
        demoMode: "Demo mode: unsigned fallback enabled for DEMO-* batches.",
        statusLabel: "Status",
        networkLabel: "Network",
        tokenIdLabel: "Token ID",
        txLabel: "Tx",
        actionDone: "Done ✓",
        provenanceLoaded: "Provenance",
        eventsLoaded: "events loaded",
        technicalTitle: "Technical details",
        heroRoute: "SUN route",
        eventLabel: "Event",
        riskReplay: "replay suspect",
        riskManual: "manual opened",
        riskTamper: "tamper/opened",
        riskPrev: "opened previously",
        riskControlled: "controlled",
        journey1: "1) Verify identity",
        journey2: "2) Link to tenant",
        journey3: "3) Unlock benefits",
        journey1Desc: "Use email/phone to create a secure session.",
        journey2Desc: "We connect this tap to your product portal.",
        journey3Desc: "Marketplace, warranty and rewards become active.",
        mapStoryTitle: "Reported geographic context",
        mapStorySubtitle: "The reported position keeps its source and accuracy. When a declared origin is available, the line is only a linear reference; it does not prove travel or custody.",
        mapOriginStep: "Declared origin",
        mapTapStep: "Reported tap location",
        mapTokenStep: "Token / NFT",
        mapOwnerStep: "Account and benefits",
        mapLedgerTitle: "Visual ledger",
        mapInvestorSignal: "Brand signal",
        mapConsumerSignal: "Consumer signal",
      }
      : {
        manualOpened: "Estado abierto declarado por un operador; no es una medición criptográfica del contenido.",
        opened: "Mensaje NFC validado; TT reporta apertura.",
        openedPreviously: "Mensaje NFC validado; el historial TT reporta una apertura anterior.",
        unknownTamper: "Mensaje NFC validado; este lote no aporta estado TT de apertura.",
        commercialState: "Estado comercial",
        risk: "Riesgo",
        hold: "PAUSA",
        review: "REVISIÓN",
        reviewPrev: "REVISIÓN ABIERTO PREVIO",
        ok: "OK",
        dashboardSync: "Sincronizado con dashboard: Analytics · Eventos · Tags",
        events: "Eventos",
        tokenization: "Tokenización",
        device: "Dispositivo",
        wineProfile: "Perfil del vino",
        traceability: "Trazabilidad",
        sensorIntelligence: "Inteligencia de sensores",
        geoContext: "Contexto geo",
        consumerJourney: "Recorrido del consumidor",
        mapLocalTitle: "Contexto local · origen declarado y tap reportado",
        mapUnavailable: "Mapa no disponible: el tap no tiene un par válido de coordenadas WGS84.",
        mapGlobalTitle: "Contexto global · posición reportada del tap",
        mapLegend: "Origen declarado ↔ tap reportado (referencia lineal; no es un recorrido)",
        routeSummary: "Comparación geográfica",
        routeDistance: "Distancia geodésica estimada",
        routeRegion: "Región de lectura",
        actionSubtitle: "Flujos de consumidor, garantía y trazabilidad.",
        varietal: "Varietal",
        vintage: "Cosecha",
        harvest: "Vendimia",
        barrel: "Barrica",
        alcohol: "Alcohol",
        serving: "Servicio",
        bottleFormat: "Botella",
        origin: "Origen",
        winery: "Bodega",
        altitude: "Altitud",
        oak: "Roble",
        cellarTemp: "Temp. cava",
        humidity: "Humedad",
        light: "Luz",
        transit: "Tránsito",
        os: "SO",
        browser: "Navegador",
        tapLocation: "Ubicación tap",
        months: "meses",
        linkMarketplace: "Marketplace",
        linkRewards: "Promos y beneficios",
        linkRegister: "Registrarme",
        linkPortal: "Ir a mi portal",
        tapHelp: "Si el mensaje NFC se valida, pediremos login/registro. Cualquier vínculo, titularidad o beneficio queda sujeto a política y evidencia requerida.",
        demoMode: "Modo demo: fallback sin firma habilitado para lotes DEMO-*.",
        statusLabel: "Estado",
        networkLabel: "Red",
        tokenIdLabel: "Token ID",
        txLabel: "Tx",
        actionDone: "Listo ✓",
        provenanceLoaded: "Trazabilidad",
        eventsLoaded: "eventos cargados",
        technicalTitle: "Detalles técnicos",
        heroRoute: "Ruta SUN",
        eventLabel: "Evento",
        riskReplay: "replay sospechoso",
        riskManual: "apertura manual",
        riskTamper: "apertura/alteración",
        riskPrev: "abierto previamente",
        riskControlled: "controlado",
        journey1: "1) Verificar identidad",
        journey2: "2) Asociar al tenant",
        journey3: "3) Desbloquear beneficios",
        journey1Desc: "Usá email/celular para crear una sesión segura.",
        journey2Desc: "Conectamos este tap a tu producto en el portal.",
        journey3Desc: "Se activan marketplace, garantía y recompensas.",
        mapStoryTitle: "Contexto geográfico reportado",
        mapStorySubtitle: "La ubicación reportada conserva su fuente y precisión. Cuando hay un origen declarado, la línea es sólo una referencia lineal. La línea visual no prueba ruta física ni custodia.",
        mapOriginStep: "Origen declarado",
        mapTapStep: "Ubicación del tap reportada",
        mapTokenStep: "Token / NFT",
        mapOwnerStep: "Cuenta y beneficios",
        mapLedgerTitle: "Ledger visual",
        mapInvestorSignal: "Señal para marca",
        mapConsumerSignal: "Señal para consumidor",
      };
  const tone = contract.status.tone === 'good' ?'#22c55e' : contract.status.tone === 'risk' ?'#ef4444' : '#f59e0b';
  const isRiskBlocked = contract.blockedActions.includes("claim");
  const authRibbonTone = contract.status.tone === "good" ?"#22c55e" : contract.status.tone === "risk" ?"#ef4444" : "#f59e0b";
  const riskLevelLabel = contract.riskLevel === "none"
    ?(copy.lang === "en" ?"low risk" : copy.lang === "pt-BR" ?"risco baixo" : "riesgo bajo")
    : contract.riskLevel === "critical"
      ?(copy.lang === "en" ?"critical risk" : copy.lang === "pt-BR" ?"risco crítico" : "riesgo crítico")
      : contract.riskLevel === "high"
        ?(copy.lang === "en" ?"high risk" : copy.lang === "pt-BR" ?"risco alto" : "riesgo alto")
        : contract.riskLevel === "medium"
          ?(copy.lang === "en" ?"medium risk" : copy.lang === "pt-BR" ?"risco moderado" : "riesgo medio")
          : (copy.lang === "en" ?"controlled risk" : copy.lang === "pt-BR" ?"risco controlado" : "riesgo controlado");
  const riskTone = contract.riskLevel === "none"
    ?"#22c55e"
    : contract.riskLevel === "critical" || contract.riskLevel === "high"
      ?"#ef4444"
      : "#f59e0b";
  const tokenizationStatusLabel = !contract.tokenization.status || contract.tokenization.status === "none"
    ?(copy.lang === "en" ?"not tokenized yet" : copy.lang === "pt-BR" ?"ainda sem tokenização" : "aún sin tokenización")
    : contract.tokenization.status;
  const productState = String(contract.status.productState || "").toUpperCase();
  const statusCode = String(contract.status.code || "").toUpperCase();
  const verdictName = String(contract.verdict || "").toLowerCase();
  const conditionState = String(contract.condition.state || "").toLowerCase();
  const isSunProfileMismatchState =
    statusCode === "SUN_PROFILE_MISMATCH" ||
    verdictName === "sun_profile_mismatch" ||
    conditionState === "sun_profile_mismatch" ||
    conditionState === "blocked_sun_profile_mismatch";
  const isClosedState = productState === "VALID_CLOSED" || statusCode === "VALID_CLOSED";
  const isOpenedState =
    productState === "VALID_MANUAL_OPENED" ||
    productState === "VALID_OPENED" ||
    productState === "VALID_OPENED_PREVIOUSLY" ||
    statusCode === "VALID_OPENED" ||
    statusCode === "VALID_OPENED_PREVIOUSLY" ||
    statusCode === "MANUAL_OPENED" ||
    statusCode === "OPENED" ||
    statusCode === "OPENED_PREVIOUSLY";
  const authPanelMessage = isRiskBlocked || isSunProfileMismatchState
    ?copy.authReplay
    : isClosedState
      ?(copy.lang === "en" ?"NFC message validated; TT reports closed when supported. This does not certify physical contents." : copy.lang === "pt-BR" ?"Mensagem NFC validada; TT informa fechado quando suportado. Isso não certifica o conteúdo físico." : "Mensaje NFC validado; TT reporta cerrado cuando aplica. Esto no certifica el contenido físico.")
      : isOpenedState
        ?(copy.lang === "en" ?"NFC message validated; TT reports open." : copy.lang === "pt-BR" ?"Mensagem NFC validada; TT informa aberto." : "Mensaje NFC validado; TT reporta apertura.")
    : productState === "VALID_MANUAL_OPENED" || statusCode === "MANUAL_OPENED"
      ?labels.manualOpened
      : productState === "VALID_OPENED" || statusCode === "VALID_OPENED" || statusCode === "OPENED"
      ?labels.opened
      : productState === "VALID_OPENED_PREVIOUSLY" || statusCode === "VALID_OPENED_PREVIOUSLY" || statusCode === "OPENED_PREVIOUSLY"
        ?labels.openedPreviously
      : productState === "VALID_UNKNOWN_TAMPER"
        ?labels.unknownTamper
        : copy.authOk;
  const commercialStateLabel = isRiskBlocked
    ?`${labels.commercialState}: ${labels.hold}`
    : productState === "VALID_MANUAL_OPENED" || contract.status.code === "MANUAL_OPENED"
      ?`${labels.commercialState}: DEMO_OPENED`
      : productState === "VALID_OPENED" || contract.status.code === "VALID_OPENED" || contract.status.code === "OPENED"
      ?`${labels.commercialState}: ${labels.review}`
      : productState === "VALID_OPENED_PREVIOUSLY" || contract.status.code === "VALID_OPENED_PREVIOUSLY" || contract.status.code === "OPENED_PREVIOUSLY"
        ?`${labels.commercialState}: ${labels.reviewPrev}`
      : `${labels.commercialState}: ${labels.ok}`;
  const riskStateLabel = isRiskBlocked
    ?`${labels.risk}: ${labels.riskReplay}`
    : productState === "VALID_MANUAL_OPENED" || contract.status.code === "MANUAL_OPENED"
      ?`${labels.risk}: ${labels.riskManual}`
      : productState === "VALID_OPENED" || contract.status.code === "VALID_OPENED" || contract.status.code === "OPENED"
      ?`${labels.risk}: ${labels.riskTamper}`
      : productState === "VALID_OPENED_PREVIOUSLY" || contract.status.code === "VALID_OPENED_PREVIOUSLY" || contract.status.code === "OPENED_PREVIOUSLY"
        ?`${labels.risk}: ${labels.riskPrev}`
      : `${labels.risk}: ${labels.riskControlled}`;
  const timeline = contract.provenance.timelineSummary;
  const timelineHtml = timeline.length
    ? timeline.map((item) => `<li>${item.at || 'N/A'} · <b>${item.result || '-'}</b> · ${item.city || '-'}, ${item.country || '-'}</li>`).join('')
    : `<li>${copy.timelineEmpty}</li>`;
  const finiteCoordinate = (value: unknown, min: number, max: number) => (
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null
  );
  const wineryLat = finiteCoordinate(contract.iot.wineryCoordinates?.lat, -90, 90);
  const wineryLng = finiteCoordinate(contract.iot.wineryCoordinates?.lng, -180, 180);
  const tapLat = finiteCoordinate(contract.tapContext.lat, -90, 90);
  const tapLng = finiteCoordinate(contract.tapContext.lng, -180, 180);
  const declaredOriginAvailable = wineryLat !== null && wineryLng !== null;
  const tapLocationAvailable = tapLat !== null && tapLng !== null;
  const linearReferenceAvailable = declaredOriginAvailable && tapLocationAvailable;
  const safeTapLat = tapLat ?? 0;
  const safeTapLng = tapLng ?? 0;
  const safeWineryLat = wineryLat ?? safeTapLat;
  const safeWineryLng = wineryLng ?? safeTapLng;
  const rawTapLocationSource = String(contract.tapContext.locationSource || "").trim().toLowerCase();
  const rawTapAccuracyM = contract.tapContext.accuracyM;
  const tapAccuracyM = typeof rawTapAccuracyM === "number" && Number.isFinite(rawTapAccuracyM) && rawTapAccuracyM > 0
    ? Math.round(rawTapAccuracyM)
    : null;
  const measuredLocationSources = new Set(["device_gnss_measured", "device_gps_measured", "gnss_measured", "gps_measured", "surveyed"]);
  const browserLocationSources = new Set(["browser", "browser_geo", "browser_geolocation", "browser_geolocation_rounded", "browser_gps_approximate_consent"]);
  const networkLocationSources = new Set(["ip", "ip_geo", "edge", "edge_geo", "edge_ip_approx", "network"]);
  const tapLocationSourceLabel = !tapLocationAvailable
    ? (copy.lang === "en" ? "No coordinates reported" : copy.lang === "pt-BR" ? "Sem coordenadas informadas" : "Sin coordenadas reportadas")
    : measuredLocationSources.has(rawTapLocationSource)
      ? (copy.lang === "en" ? "Measured by a reader or device" : copy.lang === "pt-BR" ? "Medida por leitor ou dispositivo" : "Medida por lector o dispositivo")
      : browserLocationSources.has(rawTapLocationSource)
        ? (copy.lang === "en" ? "Approximate, rounded device location" : copy.lang === "pt-BR" ? "Localização aproximada e arredondada do dispositivo" : "Ubicación aproximada y redondeada del dispositivo")
        : networkLocationSources.has(rawTapLocationSource)
          ? (copy.lang === "en" ? "Approximate network location" : copy.lang === "pt-BR" ? "Localização aproximada por rede" : "Ubicación aproximada por red")
          : (copy.lang === "en" ? "Reported location; source not specified" : copy.lang === "pt-BR" ? "Localização informada; fonte não especificada" : "Ubicación reportada; fuente no especificada");
  const tapLocationAccuracyLabel = tapAccuracyM === null
    ? (copy.lang === "en" ? "Accuracy not reported" : copy.lang === "pt-BR" ? "Precisão não informada" : "Precisión no informada")
    : (copy.lang === "en" ? `Reported accuracy radius: about ${tapAccuracyM} m` : copy.lang === "pt-BR" ? `Raio de precisão informado: cerca de ${tapAccuracyM} m` : `Radio de precisión reportado: aprox. ${tapAccuracyM} m`);
  const tapLocationEvidenceLabel = `${tapLocationSourceLabel} · ${tapLocationAccuracyLabel}`;
  const declaredOriginReferenceNote = copy.lang === "en"
    ? "Declared reference; it is not an observed reading and does not add intensity."
    : copy.lang === "pt-BR"
      ? "Referência declarada; não é uma leitura observada e não soma intensidade."
      : "Referencia declarada; no es una lectura observada ni suma intensidad.";
  const locationEvidenceTitle = copy.lang === "en"
    ? "Location evidence"
    : copy.lang === "pt-BR"
      ? "Evidência de localização"
      : "Evidencia de ubicación";
  const toRad = (v: number) => v * (Math.PI / 180);
  const earthKm = 6371;
  const dLat = toRad(safeTapLat - safeWineryLat);
  const dLng = toRad(safeTapLng - safeWineryLng);
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(safeWineryLat)) * Math.cos(toRad(safeTapLat)) * Math.sin(dLng / 2) ** 2;
  const routeDistanceKm = linearReferenceAvailable
    ? Math.round(earthKm * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)))
    : null;
  const routeDistanceLabel = routeDistanceKm === null ? "N/D" : `${routeDistanceKm} km`;
  const rawRasterTileTemplate = process.env.NEXID_RASTER_TILE_TEMPLATE
    || process.env.NEXT_PUBLIC_NEXID_RASTER_TILE_TEMPLATE
    || "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";
  const rasterTileTemplate = rawRasterTileTemplate.includes("voyager_nolabels")
    ?"https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
    : rawRasterTileTemplate;
  const lightRasterTileTemplate = rasterTileTemplate.includes("/dark_all/")
    ?rasterTileTemplate.replace("/dark_all/", "/light_all/")
    : rasterTileTemplate;
  const pmtilesUrl = process.env.NEXID_PMTILES_URL || process.env.NEXT_PUBLIC_NEXID_PMTILES_URL || "";
  const mapSourceLabel = pmtilesUrl
    ?"PMTiles ready"
    : rasterTileTemplate.startsWith("/") || rasterTileTemplate.includes("nexid.lat")
      ?"Self-hosted tiles"
      : "Free raster fallback";
  const mapAttribution = process.env.NEXID_MAP_ATTRIBUTION || process.env.NEXT_PUBLIC_NEXID_MAP_ATTRIBUTION || "CARTO / OpenStreetMap";
  const newestTraceEvent = timeline[0] || null;
  const tokenProof = contract.tokenization.tokenId
    ?`Token #${contract.tokenization.tokenId}`
    : contract.tokenization.txHash
      ?maskIdentityValue(contract.tokenization.txHash)
      : tokenizationStatusLabel;
  const storyStyle = (kind: string) => {
    if (kind === "origin") return "border-color:rgba(52,211,153,.28);background:rgba(6,78,59,.22)";
    if (kind === "tap") return "border-color:rgba(249,115,22,.3);background:rgba(124,45,18,.22)";
    if (kind === "token") return "border-color:rgba(167,139,250,.32);background:rgba(76,29,149,.2)";
    return "border-color:rgba(45,212,191,.3);background:rgba(19,78,74,.22)";
  };
  const declaredOriginLabel = contract.provenance.origin || contract.iot.wineryLocation || null;
  const traceStoryHtml = [
    ...(declaredOriginLabel ? [{
      cls: "origin",
      label: labels.mapOriginStep,
      value: declaredOriginLabel,
      detail: `${contract.product.name || "Producto"} · ${declaredOriginReferenceNote}`,
    }] : []),
    {
      cls: "tap",
      label: labels.mapTapStep,
      value: `${contract.tapContext.city || newestTraceEvent?.city || "-"}, ${contract.tapContext.country || newestTraceEvent?.country || "-"}`,
      detail: `${tapLocationEvidenceLabel} · ${newestTraceEvent?.at || contract.identity.eventId || "tap actual"}`,
    },
    {
      cls: "token",
      label: labels.mapTokenStep,
      value: tokenProof,
      detail: `${labels.networkLabel}: ${contract.tokenization.network || "sandbox"} · UID ${contract.uidMasked}`,
    },
    {
      cls: "owner",
      label: labels.mapOwnerStep,
      value: contract.cta.clubName || "nexID Club",
      detail: `${labels.linkPortal} · ${labels.linkMarketplace} · ${labels.linkRewards}`,
    },
  ].map((item) => `<div class="story-step story-${item.cls}" style="border:1px solid rgba(148,163,184,.22);border-radius:12px;padding:9px;${storyStyle(item.cls)}"><span style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#93c5fd">${htmlText(item.label)}</span><b style="display:block;margin-top:3px;font-size:13px;color:#f8fafc">${htmlText(item.value)}</b><small style="display:block;margin-top:4px;color:#9fb5d9;font-size:10px;line-height:1.35">${htmlText(item.detail)}</small></div>`).join("");
  const traceLedgerHtml = [
    [labels.routeDistance, routeDistanceLabel],
    [labels.events, String(contract.provenance.timelineSummary.length)],
    [labels.statusLabel, contract.status.label],
    [labels.tokenIdLabel, contract.tokenization.tokenId || tokenizationStatusLabel],
  ].map(([label, value]) => `<div class="ledger-item" style="border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:8px;background:rgba(15,23,42,.36)"><span style="display:block;color:#9fb5d9;font-size:10px;text-transform:uppercase;letter-spacing:.08em">${htmlText(label)}</span><b style="display:block;margin-top:3px;font-size:12px;color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${htmlText(value)}</b></div>`).join("");
  const sunMapPayload = {
    tileTemplate: rasterTileTemplate,
    lightTileTemplate: lightRasterTileTemplate,
    attribution: mapAttribution,
    tap: tapLocationAvailable ? {
      id: "tap",
      lat: safeTapLat,
      lng: safeTapLng,
      tone: "tap",
      label: `${contract.tapContext.city || labels.tapLocation}, ${contract.tapContext.country || "-"}`,
      detail: tapLocationEvidenceLabel,
    } : null,
    // The declared origin is a reference marker only: it never contributes to
    // heat intensity and no line is drawn as if it were a physical route.
    origin: linearReferenceAvailable ? {
      id: "declared-origin",
      lat: safeWineryLat,
      lng: safeWineryLng,
      tone: "origin",
      label: contract.iot.wineryLocation || contract.provenance.origin || labels.origin,
      detail: declaredOriginReferenceNote,
    } : null,
    unavailable: labels.mapUnavailable,
  };
  const responsiveAtlasMap = tapLocationAvailable
    ? `<div id="nexid-sun-map" class="world-evidence-map" role="region" aria-label="${htmlText(tapLocationEvidenceLabel)}" data-nexid-map="maplibre-gl" data-map-source="${htmlText(mapSourceLabel)}" style="position:absolute;inset:0;width:100%;height:100%;min-height:220px"><div class="world-map-loading" role="status" style="position:absolute;inset:0;z-index:2;display:grid;place-items:center;padding:18px;text-align:center;background:rgba(2,6,23,.78);color:#cbd5e1">Cargando mapa geográfico real...</div></div>`
    : `<div style="display:grid;place-items:center;min-height:180px;padding:24px;text-align:center;color:#cbd5e1">${htmlText(labels.mapUnavailable)}</div>`;
  const reportedQualityScore = typeof contract.quality.score === "number" ? contract.quality.score : null;
  const reportedQualityTier = typeof contract.quality.tier === "string" ? contract.quality.tier : null;
  const hasReportedQuality = reportedQualityScore !== null
    && reportedQualityTier !== null
    && contract.quality.basis !== "unavailable";
  const noScoreLabel = copy.lang === "en" ? "no score" : copy.lang === "pt-BR" ? "sem score" : "sin score";
  const qualitySummary = hasReportedQuality
    ? `${copy.quality} ${reportedQualityScore}/100 · ${reportedQualityTier}`
    : `${copy.quality}: N/D · ${noScoreLabel}`;
  let qualityMeterHtml = hasReportedQuality
    ? `<div class="risk-meter"><div class="risk-track"><div class="risk-fill" style="width:${reportedQualityScore}%"></div></div></div>`
    : "";
  const mapOriginLegendHtml = linearReferenceAvailable
    ? `<div class="legend-item"><span class="legend-dot legend-origin"></span><b>${labels.origin}</b><br/>${contract.iot.wineryLocation || contract.provenance.origin || "N/A"}<br/><small>${htmlText(declaredOriginReferenceNote)}</small></div>`
    : "";
  const mapLegendHtml = tapLocationAvailable
    ? `<div class="world-map-legend">${mapOriginLegendHtml}<div class="legend-item"><span class="legend-dot legend-tap"></span><b>${labels.tapLocation}</b><br/>${contract.tapContext.city || "N/A"}, ${contract.tapContext.country || "N/A"}<br/><small>${htmlText(tapLocationEvidenceLabel)}</small></div></div>`
    : "";
  const routeSummaryText = linearReferenceAvailable
    ? `${contract.iot.wineryLocation || contract.provenance.origin || labels.origin} ↔ ${contract.tapContext.city || "-"}, ${contract.tapContext.country || "-"} · ${labels.mapLegend}. ${tapLocationEvidenceLabel}.`
    : tapLocationAvailable
      ? `${contract.tapContext.city || "-"}, ${contract.tapContext.country || "-"} · ${tapLocationEvidenceLabel}.`
      : labels.mapUnavailable;
  const maskedBid = maskIdentityValue(contract.identity.bid);
  const maskedUid = contract.uidMasked;
  const sensorEvidenceLabel = contract.iot.sensorEvidenceKind === "simulated"
    ? copy.lang === "en" ? "SIMULATED - NOT MEASURED" : copy.lang === "pt-BR" ? "SIMULADO - NAO MEDIDO" : "SIMULADO - NO MEDIDO"
    : contract.iot.sensorEvidenceKind === "reported"
      ? copy.lang === "en" ? "REPORTED - NOT INDEPENDENTLY VERIFIED" : copy.lang === "pt-BR" ? "REPORTADO - NAO VERIFICADO INDEPENDENTEMENTE" : "REPORTADO - NO VERIFICADO INDEPENDIENTEMENTE"
      : copy.lang === "en" ? "NO SENSOR TELEMETRY" : copy.lang === "pt-BR" ? "SEM TELEMETRIA DE SENSOR" : "SIN TELEMETRIA DE SENSOR";
  const sensorEvidenceTone = contract.iot.sensorEvidenceKind === "reported" ? "#7dd3fc" : "#fbbf24";
  const sensorEvidenceExplanation = contract.iot.sensorEvidenceKind === "simulated"
    ? copy.lang === "en" ? "Illustrative demo values; no sensor measured them." : copy.lang === "pt-BR" ? "Valores ilustrativos de demo; nenhum sensor os mediu." : "Valores ilustrativos de demo; ningun sensor los midio."
    : contract.iot.sensorEvidenceKind === "reported"
      ? copy.lang === "en" ? "Values reported in event records; not independently verified by NexID." : copy.lang === "pt-BR" ? "Valores informados nos eventos; nao verificados independentemente pela NexID." : "Valores informados en eventos; no verificados independientemente por NexID."
      : copy.lang === "en" ? "No measured or reported sensor values are available." : copy.lang === "pt-BR" ? "Nao ha valores de sensores medidos ou reportados." : "No hay valores de sensores medidos ni reportados.";
  qualityMeterHtml += `<div class="sensor-evidence" style="border:1px solid ${sensorEvidenceTone};background:rgba(2,6,23,.35);border-radius:12px;padding:10px;margin:12px 0 0"><b style="display:block;color:${sensorEvidenceTone};font-size:12px;letter-spacing:.04em">${sensorEvidenceLabel}</b><span style="font-size:11px;color:#cbd5e1">${sensorEvidenceExplanation}</span></div>`;

  return `<!doctype html><html lang="${copy.lang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>NexID Product Passport</title>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/logo-mark.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-icon" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css" />
  <script defer src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>
  <style>body{margin:0;background:radial-gradient(circle at top,#0b1e47 0%,#020617 58%);color:#e2e8f0;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}.wrap{max-width:760px;margin:0 auto;padding:18px;padding-bottom:calc(18px + env(safe-area-inset-bottom))}.card{border:1px solid rgba(148,163,184,.22);border-radius:18px;background:linear-gradient(180deg,#0d1834 0%,#0a1228 100%);padding:16px;margin-top:12px;box-shadow:0 12px 36px rgba(2,6,23,.38)}.hero{padding:18px;background:linear-gradient(180deg,#0e1f43 0%,#09162f 100%);border:1px solid rgba(34,211,238,.22)}.hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.trust-sticky{position:sticky;top:8px;z-index:40;border:1px solid rgba(34,211,238,.35);background:rgba(8,16,36,.85);backdrop-filter:blur(8px);padding:10px 12px;border-radius:12px;margin-bottom:10px;font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}.trust-label{display:flex;align-items:center;gap:8px}.trust-dot{width:8px;height:8px;border-radius:999px;display:inline-block}.auth-card{border-color:rgba(34,211,238,.28);box-shadow:0 8px 28px rgba(34,211,238,.08)}.auth-topline{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc;margin-bottom:8px}.brand{display:flex;align-items:center;gap:10px;margin-bottom:8px}.brand-mark{width:36px;height:36px;border-radius:11px;background:linear-gradient(160deg,#05203d,#0b355f);border:1px solid rgba(125,211,252,.35);display:grid;place-items:center;font-weight:800;color:#e0f2fe;position:relative;overflow:hidden}.brand-ni{display:inline-flex;align-items:flex-end;gap:1px}.brand-ni .n-letter{font-size:16px;line-height:1}.brand-ni .i-stack{position:relative;display:inline-block;padding-top:2px}.brand-ni .i-stem{font-size:16px;line-height:1}.brand-ni .i-dot{position:absolute;top:-1px;left:50%;width:4px;height:4px;border-radius:999px;background:#7dd3fc;transform:translate(-50%,-50%);box-shadow:0 0 0 1px rgba(125,211,252,.22)}.brand-ni .i-orbit{position:absolute;top:-1px;left:50%;width:11px;height:7px;border:1px solid rgba(125,211,252,.5);border-radius:999px;transform:translate(-50%,-50%) rotate(-10deg)}.brand-text{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7dd3fc}.badge{display:inline-block;border-radius:999px;border:1px solid rgba(255,255,255,.25);padding:4px 10px;font-size:11px;font-weight:700;letter-spacing:.04em}.lang-switch{display:flex;gap:6px;margin-top:6px}.lang-switch a{text-decoration:none;font-size:10px;padding:3px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.4);color:#dbeafe}.lang-switch a.active{border-color:#22d3ee;color:#67e8f9;background:rgba(34,211,238,.12)}.hero h1{margin:10px 0 4px;font-size:clamp(1.7rem,6vw,2.1rem);line-height:1.08;letter-spacing:-.015em}.hero-meta{margin-top:6px;color:#b6c8e7;font-size:12px}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.chip{border:1px solid rgba(148,163,184,.35);border-radius:999px;padding:4px 10px;font-size:11px;color:#cbd5e1;background:rgba(2,6,23,.24)}.chip-soft{background:rgba(34,211,238,.08);border-color:rgba(34,211,238,.35)}.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.kpi{border:1px solid rgba(148,163,184,.28);border-radius:12px;padding:10px;background:rgba(2,6,23,.45);min-height:72px;display:flex;flex-direction:column;justify-content:center}.kpi b{display:block;font-size:14px}.kpi span{font-size:11px;color:#9fb5d9}.section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(148,163,184,.2)}.section-head h3{margin:0}.section-tag{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc;border:1px solid rgba(125,211,252,.35);padding:2px 8px;border-radius:999px}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.detail-item{border:1px solid rgba(148,163,184,.2);border-radius:12px;padding:9px 10px;background:rgba(15,23,42,.35)}.detail-item .k{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#93c5fd;margin-bottom:4px}.detail-item .v{font-size:14px;font-weight:700;color:#f8fafc}.world-map-wrap{margin-top:10px;border:1px solid rgba(148,163,184,.28);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#07142d 0%,#081b38 100%)}.world-map-canvas{position:relative;aspect-ratio:1000/460;background:#0b1e47}.world-map-image{display:block;width:100%;height:100%;object-fit:cover;filter:saturate(1.05) contrast(1.02)}.world-evidence-overlay{position:absolute;inset:0;width:100%;height:100%;--sun-ocean-1:#06243c;--sun-ocean-2:#071827;--sun-ocean-3:#111136;--sun-tile-overlay:rgba(2,6,23,.16);--sun-grid-stroke:rgba(226,232,240,.055)}.atlas-tiles-light{display:none}.world-map-legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;padding:8px;border-top:1px solid rgba(148,163,184,.22)}.legend-item{font-size:11px;color:#dbeafe;border:1px solid rgba(148,163,184,.28);border-radius:10px;padding:8px;background:rgba(15,23,42,.35)}.legend-item small{display:block;margin-top:5px;color:#9fb5d9;line-height:1.35}.legend-dot{display:inline-block;width:8px;height:8px;border-radius:999px;margin-right:6px}.legend-origin{background:#22d3ee}.legend-tap{background:#f97316}.journey-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}.journey-step{border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:8px;background:rgba(15,23,42,.32)}.journey-step b{display:block;font-size:12px;margin-bottom:4px}.journey-step span{font-size:11px;color:#9fb5d9}details{margin-top:10px}button{border:1px solid rgba(148,163,184,.4);border-radius:10px;background:#071229;color:#dbeafe;padding:9px 8px;font-size:12px;font-weight:700;transition:transform .16s ease,background .2s ease,border-color .2s ease,box-shadow .2s ease}button:hover{transform:translateY(-1px);border-color:#38bdf8;background:#0b1f3f;box-shadow:0 8px 20px rgba(56,189,248,.18)}button:active{transform:scale(.98)}button:disabled{opacity:.45;cursor:not-allowed}.actions-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.link-btn{text-decoration:none;border:1px solid rgba(148,163,184,.32);border-radius:10px;padding:9px 8px;font-size:12px;font-weight:700;text-align:center;transition:transform .15s ease,filter .15s ease}.link-btn:hover{transform:translateY(-1px);filter:brightness(1.08)}.subtitle{margin:0;color:#9fb5d9;font-size:13px}.risk-meter{margin-top:12px}.risk-track{height:10px;border-radius:999px;background:rgba(148,163,184,.2);overflow:hidden}.risk-fill{height:100%;background:linear-gradient(90deg,#22c55e,#f59e0b,#ef4444);transition:width .6s ease}.pulse-ok{display:inline-block;animation:pulse 1.6s infinite}@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.45)}70%{box-shadow:0 0 0 12px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}@media (hover:hover){.card{transition:transform .2s ease,box-shadow .2s ease}.card:hover{transform:translateY(-1px);box-shadow:0 14px 34px rgba(2,6,23,.44)}}@media (max-width:720px){.kpis,.detail-grid,.actions-grid,.world-map-legend,.journey-steps{grid-template-columns:1fr}.hero-top{flex-direction:column;align-items:flex-start}.trust-sticky{padding:9px 10px}.trust-label{line-height:1.25}.kpi{min-height:64px}}@media (prefers-color-scheme: light){body{background:linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%);color:#0f172a}.card{background:#ffffff;border-color:#cbd5e1;box-shadow:0 8px 24px rgba(15,23,42,.08)}.hero{background:linear-gradient(180deg,#f8fbff 0%,#f1f5f9 100%)}.brand-mark{background:linear-gradient(160deg,#dff3ff,#bfdbfe);border-color:#93c5fd;color:#0f172a}.brand-text{color:#0369a1}.subtitle,.hero-meta{color:#334155}.chip{color:#334155;border-color:#cbd5e1;background:#f8fafc}.chip-soft{background:#ecfeff;border-color:#a5f3fc}.kpi{background:#f8fafc;border-color:#cbd5e1}.kpi span{color:#475569}.section-tag{color:#0369a1;border-color:#93c5fd}.detail-item,.journey-step{background:#f8fafc;border-color:#cbd5e1}.detail-item .k{color:#0369a1}.detail-item .v{color:#0f172a}.journey-step span{color:#475569}.world-map-wrap{background:linear-gradient(180deg,#f8fcff 0%,#dff4ff 100%);border-color:#93c5fd}.world-map-canvas{background:#eaf7ff}.world-evidence-overlay{--sun-ocean-1:#effaff;--sun-ocean-2:#e0f7ff;--sun-ocean-3:#eef4ff;--sun-tile-overlay:rgba(255,255,255,.28);--sun-grid-stroke:rgba(14,116,144,.1)}.atlas-tiles-dark{display:none}.atlas-tiles-light{display:block}.world-map-image{filter:saturate(.9) contrast(.92) brightness(1.08)}.legend-item{background:#f8fafc;border-color:#cbd5e1;color:#0f172a}.legend-item small{color:#475569}button{background:#f8fafc;color:#0f172a}.link-btn{border-color:#cbd5e1}.lang-switch a{color:#0f172a;border-color:#cbd5e1}.lang-switch a.active{color:#075985}}@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}</style></head><body><main class="wrap">
  <style id="nexid-white-first">body{background:linear-gradient(180deg,#f8fbfd 0%,#eef5f7 100%);color:#0f172a}.card{background:#fff;border-color:#cbd5e1;box-shadow:0 8px 24px rgba(15,23,42,.08)}.hero{background:linear-gradient(180deg,#fbfeff 0%,#f1f8fa 100%);border-color:#bae6ef}.trust-sticky{background:rgba(255,255,255,.94);border-color:#a5ddea;box-shadow:0 8px 28px rgba(15,23,42,.09)}.trust-sticky .chip{background:#fff!important}.brand-mark{background:linear-gradient(160deg,#dff6fb,#c8ebf3);border-color:#8fd3e2;color:#0f172a}.brand-text,.auth-topline,.section-tag{color:#076e82}.subtitle,.hero-meta{color:#475569}.chip{color:#334155;border-color:#cbd5e1;background:#f8fafc}.chip-soft{background:#ecfeff;border-color:#a5f3fc}.kpi,.detail-item,.journey-step{background:#f8fafc;border-color:#cbd5e1}.kpi span,.journey-step span{color:#475569}.detail-item .k{color:#08768b}.detail-item .v{color:#0f172a}.world-map-wrap{background:linear-gradient(180deg,#f8fcff 0%,#dff4ff 100%);border-color:#93c5fd}.world-map-canvas{background:#eaf7ff}.legend-item{background:#f8fafc;border-color:#cbd5e1;color:#0f172a}.legend-item small{color:#475569}.sensor-evidence{background:#f8fafc!important}.sensor-evidence span{color:#475569!important}.trace-story{background:linear-gradient(180deg,#f0fdff,#f8fafc)!important;border-color:#a5e5ef!important}.trace-story-head p{color:#475569!important}.trace-story>p{color:#08768b!important}.story-grid>*,.ledger-grid>*{background:#fff!important;color:#0f172a!important;border-color:#cbd5e1!important}.story-grid span,.ledger-grid span{color:#475569!important}.story-grid b,.ledger-grid b{color:#0f172a!important}button{background:#f8fafc;color:#0f172a}.link-btn{border-color:#cbd5e1}.lang-switch a{color:#0f172a;border-color:#cbd5e1}.lang-switch a.active{color:#075985}</style>
  <div class="trust-sticky"><span class="trust-label"><span class="trust-dot" style="background:${authRibbonTone}"></span><b>${copy.authPanel}:</b> <span style="color:${authRibbonTone};font-weight:700">${contract.status.label}</span></span><span class="chip" style="margin-top:0;border-color:${riskTone};color:${riskTone};background:rgba(2,6,23,.36)">${riskLevelLabel}</span></div>
  <section class="card hero"><div class="hero-top"><div><div class="brand"><span class="brand-mark"><span class="brand-ni"><span class="n-letter">N</span><span class="i-stack"><span class="i-stem">i</span><span class="i-dot"></span><span class="i-orbit"></span></span></span></span><span class="brand-text">NexID Verified Tap</span></div><h1>${copy.title}</h1><p class="subtitle">${contract.status.summary}</p><p class="hero-meta">${labels.heroRoute} · ${labels.eventLabel} #${contract.identity.eventId || 'N/A'}</p><div class="lang-switch"><a href="${langUrl('es-AR')}" class="${locale === 'es-AR' ?'active' : ''}">ES</a><a href="${langUrl('pt-BR')}" class="${locale === 'pt-BR' ?'active' : ''}">PT</a><a href="${langUrl('en')}" class="${locale === 'en' ?'active' : ''}">EN</a></div></div><span class="badge" style="color:${tone};border-color:${tone}">${contract.status.label}</span></div><div class="chips"><span class="chip">BID ${maskedBid}</span><span class="chip">UID ${maskedUid}</span><span class="chip">Tap #${contract.identity.readCounter ?? 'N/A'}</span><span class="chip ${contract.status.code === "VALID" ?"pulse-ok" : ""}">${qualitySummary}</span></div>${qualityMeterHtml}<div class="kpis"><div class="kpi"><b>${contract.provenance.timelineSummary.length}</b><span>${labels.events}</span></div><div class="kpi"><b>${tokenizationStatusLabel}</b><span>${labels.tokenization}</span></div><div class="kpi"><b>${contract.tapContext.deviceType || "-"}</b><span>${labels.device}</span></div></div></section>
  <section class="card auth-card"><div class="auth-topline">Trust signal</div><h3 style="margin:0 0 6px">${copy.authPanel}</h3><p class="subtitle">${authPanelMessage}</p><div class="chips"><span class="chip">${commercialStateLabel}</span><span class="chip">${riskStateLabel}</span><span class="chip">${labels.dashboardSync}</span></div></section>
  <section class="card"><div class="section-head"><h3>${copy.identityPanel}</h3><span class="section-tag">${labels.wineProfile}</span></div><p><b>${contract.product.name || 'Unprofiled product'}</b></p><p>${contract.product.winery || '-'} · ${contract.product.region || '-'}</p><div class="detail-grid"><div class="detail-item"><span class="k">${labels.varietal}</span><span class="v">${contract.product.varietal || '-'}</span></div><div class="detail-item"><span class="k">${labels.vintage}</span><span class="v">${contract.product.vintage || '-'}</span></div><div class="detail-item"><span class="k">${labels.harvest}</span><span class="v">${contract.product.harvestYear || '-'}</span></div><div class="detail-item"><span class="k">${labels.barrel}</span><span class="v">${contract.product.barrelMonths || '-'} ${labels.months}</span></div><div class="detail-item"><span class="k">${labels.alcohol}</span><span class="v">${contract.product.alcohol || '-'}</span></div><div class="detail-item"><span class="k">${labels.serving}</span><span class="v">${contract.product.serving || '-'}</span></div></div><p style="margin-top:10px">${labels.bottleFormat}: <b>${contract.product.bottle || '-'}</b></p></section>
  <section class="card"><div class="section-head"><h3>${copy.provenancePanel}</h3><span class="section-tag">${labels.traceability}</span></div><p>${labels.origin}: <b>${contract.provenance.origin || contract.iot.wineryLocation || '-'}</b></p><p>${copy.firstVerified}: <b>${contract.provenance.firstVerified.at || 'N/A'} · ${contract.provenance.firstVerified.city || '-'}, ${contract.provenance.firstVerified.country || '-'}</b></p><p>${copy.lastVerified}: <b>${contract.provenance.lastVerifiedLocation.at || 'N/A'} · ${contract.provenance.lastVerifiedLocation.city || '-'}, ${contract.provenance.lastVerifiedLocation.country || '-'}</b></p></section>
  <section class="card"><div class="section-head"><h3>${copy.iotPanel}</h3><span class="section-tag">${labels.sensorIntelligence}</span></div><p>${labels.winery}: <b>${contract.iot.wineryLocation || 'N/A'}</b></p><p>${labels.altitude}: <b>${contract.iot.altitude || '-'}</b> · ${labels.oak}: <b>${contract.iot.oakType || '-'}</b></p><p>${labels.cellarTemp}: <b>${contract.iot.sensorSnapshot.cellarTemperature || '-'}</b> · ${labels.humidity}: <b>${contract.iot.sensorSnapshot.humidity || '-'}</b></p><p>${labels.light}: <b>${contract.iot.sensorSnapshot.lightExposure || '-'}</b> · ${labels.transit}: <b>${contract.iot.sensorSnapshot.transitShock || '-'}</b></p></section>
  <section class="card"><div class="section-head"><h3>${copy.tapPanel}</h3><span class="section-tag">${labels.geoContext}</span></div><p>${labels.os}: <b>${contract.tapContext.os}</b> · ${labels.browser}: <b>${contract.tapContext.browser}</b> · ${labels.device}: <b>${contract.tapContext.deviceType}</b></p><p>${labels.tapLocation}: <b>${contract.tapContext.city || '-'}, ${contract.tapContext.country || '-'}</b>${tapLocationAvailable ?` · (${tapLat}, ${tapLng})` : ''}</p><div class="detail-grid"><div class="detail-item"><span class="k">${labels.routeDistance}</span><span class="v">${routeDistanceLabel}</span></div><div class="detail-item"><span class="k">${labels.routeRegion}</span><span class="v">${contract.tapContext.city || '-'}, ${contract.tapContext.country || '-'}</span></div><div class="detail-item"><span class="k">${locationEvidenceTitle}</span><span class="v">${htmlText(tapLocationEvidenceLabel)}</span></div></div>
  <div class="world-map-wrap"><div class="world-map-canvas">${responsiveAtlasMap}</div>${mapLegendHtml}</div>
  <div class="trace-story" style="margin-top:10px;border:1px solid rgba(34,211,238,.22);border-radius:14px;padding:10px;background:linear-gradient(180deg,rgba(8,47,73,.44),rgba(15,23,42,.28))"><div class="trace-story-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px"><div><h4 style="margin:0;font-size:14px">${labels.mapStoryTitle}</h4><p style="margin:2px 0 0;color:#9fb5d9;font-size:11px">${labels.mapStorySubtitle}</p></div><span class="section-tag">${labels.mapLedgerTitle}</span></div><div class="story-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px">${traceStoryHtml}</div><div class="ledger-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px;margin-top:8px">${traceLedgerHtml}</div><p style="margin:9px 0 0;font-size:11px;color:#a7f3d0">${labels.mapInvestorSignal}: ${contract.provenance.timelineSummary.length} ${labels.events}, ${routeDistanceLabel}, ${htmlText(tokenProof)}. ${labels.mapConsumerSignal}: ${labels.linkPortal} + ${labels.linkRewards}.</p></div>
  <p style="margin:8px 0 0;font-size:11px;color:#94a3b8">${labels.routeSummary}: ${routeSummaryText}</p></section>
  <section class="card"><h3 style="margin:0 0 6px">${copy.timelinePanel}</h3><ul style="margin:0;padding-left:18px">${timelineHtml}</ul></section>
  <section class="card"><h3 style="margin:0 0 6px">${copy.tokenPanel}</h3><p>${labels.statusLabel}: <b>${contract.tokenization.status}</b> · ${labels.networkLabel}: <b>${contract.tokenization.network || '-'}</b></p><p>${labels.tokenIdLabel}: ${contract.tokenization.tokenId || '-'} · ${labels.txLabel}: ${contract.tokenization.txHash || '-'}</p></section>
  <section class="card">
    <details>
      <summary style="font-weight:700;cursor:pointer;color:#7dd3fc;outline:none">Ver Digital Proofs (Trust Layer)</summary>
      <div style="margin-top:10px;font-size:12px;color:#cbd5e1">
        <p style="margin:4px 0"><b>Evidencia digital del tag:</b> ${contract.status.code === 'VALID' || contract.status.code === 'OPENED' ? '<span style="color:#22c55e">Mensaje NXP SUN validado; no certifica el producto físico</span>' : '<span style="color:#ef4444">No validada</span>'}</p>
        <p style="margin:4px 0"><b>Capa de tokenización:</b> ${contract.tokenization.status === 'minted' && contract.tokenization.txHash ? '<span style="color:#22c55e">Transacción Polygon reportada; ownership sujeto a policy y aprobación</span>' : 'Sin transacción confirmada en esta vista'}</p>
        <p style="margin:4px 0"><b>Evidencia IOTA:</b> No expuesta por este pasaporte; validar hash, tx y explorer en Chain Lab.</p>
        <p style="margin:4px 0"><b>Ref:</b> ${contract.identity.eventId || '-'}</p>
      </div>
    </details>
  </section>
  <section class="card"><div class="section-head"><h3>${copy.actionsPanel}</h3><span class="section-tag">${labels.consumerJourney}</span></div><p class="subtitle" style="margin-bottom:10px">${labels.actionSubtitle}</p><div class="journey-steps"><div class="journey-step"><b>${labels.journey1}</b><span>${labels.journey1Desc}</span></div><div class="journey-step"><b>${labels.journey2}</b><span>${labels.journey2Desc}</span></div><div class="journey-step"><b>${labels.journey3}</b><span>${labels.journey3Desc}</span></div></div><div class="actions-grid" style="margin-bottom:8px"><a href="${contract.cta.marketplaceUrl}" data-gated-link="marketplace" class="link-btn" style="color:#a5f3fc;background:rgba(6,182,212,.12)">🛍 ${labels.linkMarketplace} ${contract.cta.clubName}</a><a href="${contract.cta.rewardsUrl}" data-gated-link="rewards" class="link-btn" style="color:#ddd6fe;background:rgba(139,92,246,.12)">🎁 ${labels.linkRewards}</a><a href="${contract.cta.registerUrl}" data-gated-link="register" class="link-btn" style="color:#d1fae5;background:rgba(16,185,129,.12)">🧾 ${labels.linkRegister}</a><a href="${contract.cta.portalUrl}" data-gated-link="portal" class="link-btn" style="color:#dbeafe;background:rgba(59,130,246,.12)">👤 ${labels.linkPortal}</a></div><div class="actions-grid"><button type="button" data-cta="claim-ownership" ${contract.cta.claimOwnership ?"" : "disabled"}>✓ ${copy.ctaClaim}</button><button type="button" data-cta="register-warranty" ${contract.cta.registerWarranty ?"" : "disabled"}>🛡 ${copy.ctaWarranty}</button><button type="button" data-cta="provenance" ${contract.cta.provenance ?"" : "disabled"}>📍 ${copy.ctaProvenance}</button><button type="button" data-cta="tokenize-request" ${contract.cta.tokenize ?"" : "disabled"}>⛓ ${copy.ctaTokenize}</button></div><button id="nfc-scan" type="button" style="margin-top:8px;display:none">📲 Escanear con NFC</button><p id="cta-status" style="margin:10px 0 0;font-size:12px;color:#cbd5e1">${isRiskBlocked ?copy.statusReplay : copy.statusReady}</p><p style="margin:6px 0 0;font-size:11px;color:#94a3b8">${labels.tapHelp}</p>${shareToken ?"" : `<p style="margin:8px 0 0;font-size:11px;color:#fbbf24">${labels.demoMode}</p>`}</section>
<script>
(() => {
  const share = ${serializeForInlineScript(shareToken)};
  const bid = ${serializeForInlineScript(rawContract.identity.bid)};
  const uid = '';
  const copy = ${serializeForInlineScript(copy)};
  const labels = ${serializeForInlineScript(labels)};
  const sunMapData = ${serializeForInlineScript(sunMapPayload)};
  const initSunMap = () => {
    const container = document.getElementById('nexid-sun-map');
    if (!container) return;
    if (!window.maplibregl) {
      const status = container.querySelector('.world-map-loading');
      if (status) status.textContent = 'No se pudo iniciar MapLibre. La evidencia textual sigue disponible.';
      container.setAttribute('data-map-state', 'error');
      return;
    }
      // The public post-tap passport is white-first on every device. It must not
      // inherit a dark OS preference and surprise a user after the physical tap.
      const prefersLight = true;
    const map = new window.maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: [prefersLight ? sunMapData.lightTileTemplate : sunMapData.tileTemplate],
            tileSize: 256,
            attribution: sunMapData.attribution,
          },
        },
        layers: [
          { id: 'sun-map-background', type: 'background', paint: { 'background-color': prefersLight ? '#eaf7fb' : '#061322' } },
          { id: 'sun-map-basemap', type: 'raster', source: 'basemap' },
        ],
      },
      center: [sunMapData.tap.lng, sunMapData.tap.lat],
      zoom: 8,
      attributionControl: false,
      cooperativeGestures: true,
      fadeDuration: 0,
    });
    map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new window.maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new window.maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('error', (event) => {
      if (!event || !event.error) return;
      let status = container.querySelector('.world-map-loading');
      if (!status) {
        status = document.createElement('div');
        status.className = 'world-map-loading';
        status.setAttribute('role', 'status');
        status.style.cssText = 'position:absolute;left:12px;right:12px;top:58px;z-index:5;padding:10px 12px;border:1px solid rgba(251,191,36,.45);border-radius:10px;background:rgba(69,26,3,.92);color:#fef3c7;font:600 12px/1.45 system-ui,sans-serif;text-align:center';
        container.appendChild(status);
      }
      status.textContent = 'Algunas teselas no se pudieron cargar. La evidencia textual sigue disponible.';
      container.setAttribute('data-map-state', 'degraded');
    });
    map.on('load', () => {
      const mapPoints = [sunMapData.origin, sunMapData.tap].filter(Boolean);
      map.addSource('sun-location-evidence', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: mapPoints.map((point) => ({
            type: 'Feature',
            properties: { id: point.id, label: point.label, detail: point.detail, tone: point.tone },
            geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
          })),
        },
      });
      map.addLayer({
        id: 'sun-location-halo',
        type: 'circle',
        source: 'sun-location-evidence',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 12, 11, 28],
          'circle-color': ['match', ['get', 'tone'], 'origin', 'rgba(52,211,153,.2)', 'rgba(249,115,22,.2)'],
          'circle-stroke-color': ['match', ['get', 'tone'], 'origin', '#34d399', '#f97316'],
          'circle-stroke-width': 1,
        },
      });
      map.addLayer({
        id: 'sun-location-points',
        type: 'circle',
        source: 'sun-location-evidence',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 11, 8],
          'circle-color': ['match', ['get', 'tone'], 'origin', '#34d399', '#f97316'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      if (mapPoints.length > 1) {
        const bounds = new window.maplibregl.LngLatBounds();
        mapPoints.forEach((point) => bounds.extend([point.lng, point.lat]));
        map.fitBounds(bounds, { padding: 56, maxZoom: 9, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550 });
      }
      const status = container.querySelector('.world-map-loading');
      if (status && container.getAttribute('data-map-state') !== 'degraded') status.remove();
      if (container.getAttribute('data-map-state') !== 'degraded') container.setAttribute('data-map-state', 'ready');
    });
    map.on('click', 'sun-location-points', (event) => {
      const feature = event.features && event.features[0];
      const coordinates = feature && feature.geometry && feature.geometry.coordinates;
      if (!feature || !Array.isArray(coordinates)) return;
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      const detail = document.createElement('span');
      title.textContent = String(feature.properties.label || 'Ubicación reportada');
      detail.textContent = String(feature.properties.detail || '');
      detail.style.display = 'block';
      detail.style.marginTop = '4px';
      popup.append(title, detail);
      new window.maplibregl.Popup({ closeButton: false }).setLngLat(coordinates).setDOMContent(popup).addTo(map);
    });
    map.on('mouseenter', 'sun-location-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'sun-location-points', () => { map.getCanvas().style.cursor = ''; });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSunMap, { once: true });
  else initSunMap();
  const ui = copy.lang === 'pt-BR'
    ?{
      askContact: 'Informe seu e-mail ou telefone para registrar/associar ao tenant:',
      askCode: 'Código de verificação (demo):',
      askRewards: 'E-mail para ativar promoções/rewards do clube:',
      validating: 'Validando identidade e associando seu usuário ao tenant...',
      notVerified: 'Este toque não ficou em estado verificado. Refaça o toque físico da etiqueta.',
      hostFail: 'Não foi possível validar sessão neste host. Vamos levar você ao registro para continuar.',
      assocFail: 'Não foi possível completar registro/associação',
      assocOk: 'Associação concluída. Redirecionando...',
      nfcReady: 'Leitor NFC ativo. Aproxime a etiqueta do telefone.',
      nfcFail: 'Não foi possível iniciar NFC neste dispositivo.',
    }
    : copy.lang === 'en'
      ?{
        askContact: 'Enter your email or phone to register/link your account to this tenant:',
        askCode: 'Verification code (demo):',
        askRewards: 'Email to activate club promos/rewards:',
        validating: 'Validating identity and linking your account to tenant...',
        notVerified: 'This tap is not verified. Please perform a fresh physical tap.',
        hostFail: 'Session validation failed on this host. Redirecting to registration.',
        assocFail: 'Could not complete registration/association',
        assocOk: 'Association complete. Redirecting...',
        nfcReady: 'NFC listener active. Bring the tag close to your phone.',
        nfcFail: 'Could not start NFC on this device.',
      }
      : {
        askContact: 'Ingresá tu email o teléfono para registrarte/asociarte al tenant:',
        askCode: 'Código de verificación (demo):',
        askRewards: 'Email para activar promos/rewards del club:',
        validating: 'Validando identidad y asociando tu usuario al tenant...',
        notVerified: 'Este tap no quedó en estado verificado. Reintentá escanear físicamente la etiqueta.',
        hostFail: 'No pudimos validar sesión en este host. Te llevamos a registro para continuar.',
        assocFail: 'No pudimos completar registro/asociación',
        assocOk: 'Asociación completada. Redirigiendo...',
        nfcReady: 'NFC listener activo. Acercá la etiqueta al teléfono.',
        nfcFail: 'No fue posible iniciar NFC en este dispositivo.',
      };
  const ctaButtons = Array.from(document.querySelectorAll('[data-cta]'));
  const gatedLinks = Array.from(document.querySelectorAll('[data-gated-link]'));
  const eventId = ${serializeForInlineScript(rawContract.identity.eventId || null)};
  const canAssociate = ${serializeForInlineScript((rawContract.allowedActions as readonly string[]).includes("save") && rawContract.status.code !== "REPLAY_SUSPECT")};
  const appBase = window.location.origin;
  const nfcBtn = document.getElementById('nfc-scan');
  const jsonFetch = (path, init = {}) => fetch(appBase + path, { credentials: 'include', ...init }).then((r) => r.json());
  async function ensureAuthAndTenant(action) {
    if (!canAssociate) return { ok: false, reason: 'tap_not_verified' };
    const me = await jsonFetch('/consumer/me', { cache: 'no-store' }).catch(() => null);
    let contact = '';
    if (!me?.ok) {
      contact = window.prompt(ui.askContact) || '';
      if (!contact.trim()) return { ok: false, reason: 'cancelled' };
      const normalizedContact = contact.trim();
      const payload = normalizedContact.includes('@') ?{ email: normalizedContact } : { phone: normalizedContact };
      const start = await jsonFetch('/consumer/auth/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null);
      if (!start?.ok) return { ok: false, reason: 'start_failed' };
      let entered = String(start.code || '').trim();
      if (!entered) {
        entered = (window.prompt(ui.askCode, '') || '').trim();
      }
      if (!entered) return { ok: false, reason: 'code_cancelled' };
      const buildVerifyPayload = (code) => normalizedContact.includes('@')
        ?{ email: normalizedContact, code }
        : { phone: normalizedContact, code };
      let verify = await jsonFetch('/consumer/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildVerifyPayload(entered)) }).catch(() => null);
      if (!verify?.ok && start?.code) {
        const manual = (window.prompt(ui.askCode, String(start.code || '')) || '').trim();
        if (manual) {
          verify = await jsonFetch('/consumer/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildVerifyPayload(manual)) }).catch(() => null);
        }
      }
      if (!verify?.ok) return { ok: false, reason: 'verify_failed' };
    }
    if (eventId) {
      await jsonFetch('/mobile/passport/' + encodeURIComponent(eventId) + '/consumer/join-tenant', { method: 'POST' }).catch(() => null);
      await jsonFetch('/mobile/passport/' + encodeURIComponent(eventId) + '/consumer/save-product', { method: 'POST' }).catch(() => null);
      if (action === 'rewards') {
        const contactForEnroll = contact || window.prompt(ui.askRewards) || '';
        if (contactForEnroll.trim()) {
          await jsonFetch('/mobile/passport/' + encodeURIComponent(eventId) + '/loyalty/enroll', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(contactForEnroll.includes('@') ?{ email: contactForEnroll } : { phone: contactForEnroll }),
          }).catch(() => null);
        }
      }
    }
    return { ok: true };
  }
  gatedLinks.forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      const action = link.getAttribute('data-gated-link') || 'portal';
      const statusNode = document.getElementById('cta-status');
      if (statusNode) statusNode.textContent = ui.validating;
      const auth = await ensureAuthAndTenant(action);
      if (!auth.ok) {
        if (statusNode) statusNode.textContent = auth.reason === 'tap_not_verified'
          ?ui.notVerified
          : auth.reason === 'start_failed' || auth.reason === 'verify_failed'
            ?ui.hostFail
            : ui.assocFail + ' (' + auth.reason + ').';
        if (auth.reason === 'start_failed' || auth.reason === 'verify_failed') {
          window.location.href = ${serializeForInlineScript(rawContract.cta.registerUrl)};
        }
        return;
      }
      if (statusNode) statusNode.textContent = ui.assocOk;
      window.location.href = link.getAttribute('href') || '/me';
    });
  });
  if (nfcBtn && 'NDEFReader' in window) {
    nfcBtn.style.display = 'block';
    nfcBtn.addEventListener('click', async () => {
      const statusNode = document.getElementById('cta-status');
      try {
        const reader = new window.NDEFReader();
        await reader.scan();
        if (statusNode) statusNode.textContent = ui.nfcReady;
      } catch {
        if (statusNode) statusNode.textContent = ui.nfcFail;
      }
    });
  }
  ctaButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.getAttribute('data-cta');
      if (!action || (!uid && !eventId) || button.disabled) return;
      const statusNode = document.getElementById('cta-status');
      const originalLabel = button.textContent || action;
      button.disabled = true;
      button.textContent = copy.processing;
      if (statusNode) statusNode.textContent = copy.processing + ' ' + action;
      const shareQuery = share ?'&share=' + encodeURIComponent(share) : '';
      const endpoint = '/public/cta/' + action + '?' + (share ?'share=' + encodeURIComponent(share) : '');
      try {
        const res = await fetch(endpoint, action === 'provenance' ?{ method: 'GET', cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bid, uid, event_id: eventId, source: 'sun_mobile_preview' }) });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.ok) {
          const reason = payload?.reason || ('HTTP ' + res.status);
          button.textContent = 'Error';
          if (statusNode) statusNode.textContent = action + ' ' + copy.actionFail + ': ' + reason;
          return;
        }
        const requestOnly = payload?.outcome === 'request_recorded' || payload?.request_status === 'pending_review';
        button.textContent = requestOnly ? 'Solicitud recibida' : labels.actionDone;
        if (statusNode) statusNode.textContent = requestOnly
          ? action + ': solicitud registrada y pendiente de revision; no confirma garantia ni ticket.'
          : action + ' ' + copy.actionOk;
        if (action === 'provenance') {
          const timeline = Array.isArray(payload?.timeline) ?payload.timeline : [];
          if (statusNode) statusNode.textContent = labels.provenanceLoaded + ': ' + timeline.length + ' ' + labels.eventsLoaded + '.';
        }
      } catch {
        button.textContent = 'Error';
        if (statusNode) statusNode.textContent = 'Network error on ' + action;
      } finally {
        button.disabled = false;
        if (button.textContent === 'Error') {
          setTimeout(() => {
            button.textContent = originalLabel;
          }, 2000);
        }
      }
    });
  });
})();
</script>
</main></body></html>`;
}


async function queueAutoTokenizationForValidTap(params: { bid: string; uid: string; traceId: string; eventId?: number | null }) {
  const enabled = String(process.env.SUN_AUTO_TOKENIZE_ON_VALID_TAP || "false").toLowerCase() === "true";
  if (!enabled) return null;
  if (!params.eventId) return { ok: false, reason: "event_identity_required", status: "blocked" } as const;

  try {
    await ensureTokenizationCommercialScopeSchema();
  } catch (error) {
    if (isTokenizationCommercialScopeSchemaError(error)) {
      return { ok: false, reason: TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED, status: "blocked" } as const;
    }
    throw error;
  }

  const eventIdentityRows = await sql/*sql*/`
    SELECT e.tenant_id, e.batch_id, e.created_at AS source_event_created_at, tag.id AS tag_id,
           b.sdm_config AS batch_sdm_config,
           tsp.vertical AS sun_profile_vertical,
           tsp.tokenization_mode AS sun_profile_tokenization_mode,
           tsp.claim_policy AS sun_profile_claim_policy,
           tsp.ownership_policy AS sun_profile_ownership_policy,
           tsp.metadata AS sun_profile_metadata
    FROM events e
    JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
    JOIN tags tag ON tag.batch_id = e.batch_id AND UPPER(tag.uid_hex) = UPPER(e.uid_hex)
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = e.tenant_id
    WHERE e.id = ${params.eventId}
      AND b.bid = ${params.bid}
      AND UPPER(e.uid_hex) = UPPER(${params.uid})
    LIMIT 2
  `;
  const eventIdentity = eventIdentityRows[0];
  if (eventIdentityRows.length !== 1
    || !eventIdentity?.tenant_id
    || !eventIdentity?.batch_id
    || !eventIdentity?.tag_id
    || !eventIdentity?.source_event_created_at) {
    return { ok: false, reason: "event_identity_mismatch", status: "blocked" } as const;
  }

  const runtimeMode = resolveTokenizationRuntimeMode();
  const targetNetwork = runtimeMode === "simulated" ? "simulation" : "polygon-amoy";
  const executionClass = classifyTokenizationExecutionClass(targetNetwork, { simulated: runtimeMode === "simulated" });
  if (!executionClass) return { ok: false, reason: "tokenization_execution_class_invalid", status: "blocked" } as const;
  const tokenizationConfig = resolveExplicitSunAutoTokenizationAuthorization(eventIdentity);
  if (!tokenizationConfig.enabled) {
    return { ok: false, reason: "tokenization_auto_opt_in_required", status: "blocked" } as const;
  }
  if (tokenizationConfig.policy !== "lot_anchor" && tokenizationConfig.policy !== "issuer_batch_anchor") {
    return { ok: false, reason: "tokenization_auto_policy_not_authorized", status: "blocked" } as const;
  }
  const trustedRecipient = runtimeMode === "simulated"
    ? ""
    : String(tokenizationConfig.configuredRecipient || "").trim();
  if (runtimeMode !== "simulated" && !/^0x[0-9a-f]{40}$/i.test(trustedRecipient)) {
    return { ok: false, reason: "tokenization_tenant_recipient_required", status: "blocked" } as const;
  }

  const row = (await sql/*sql*/`
    SELECT tr.id, tr.status, tr.network, tr.issuer_wallet, tr.tx_hash, tr.token_id, tr.anchor_hash, tr.external_ref,
           tr.last_error, tr.next_attempt_at, tr.attempt_count
    FROM tokenization_requests tr
    WHERE tr.tenant_id = ${eventIdentity.tenant_id}::uuid
      AND tr.batch_id = ${eventIdentity.batch_id}::uuid
      AND tr.tag_id = ${eventIdentity.tag_id}::uuid
      AND tr.bid = ${params.bid}
      AND tr.uid_hex = ${params.uid}
      AND tr.execution_class = ${executionClass}
      AND tr.network = ${targetNetwork}
      AND tr.status IN ('pending', 'processing', 'reconciling', 'anchored', 'failed', 'simulated', 'blocked')
    ORDER BY tr.requested_at DESC
    LIMIT 1
  `)[0];
  if (row?.id) {
    if (String(row.issuer_wallet || "").toLowerCase() !== trustedRecipient.toLowerCase()) {
      return { ok: false, reason: "tokenization_request_recipient_mismatch", status: "blocked" } as const;
    }
    return await anchorTokenizationRequest({
      requestId: String(row.id),
      tenantId: String(eventIdentity.tenant_id),
      issuerWallet: trustedRecipient || null,
      processor: "sun_auto_tokenization",
    });
  }

  const inserted = (await sql/*sql*/`
    INSERT INTO tokenization_requests (
      tenant_id, batch_id, tag_id, source_event_id, source_event_created_at, bid, uid_hex, execution_class,
      status, network, asset_ref, issuer_wallet, requested_by, next_attempt_at, meta
    ) VALUES (
      ${eventIdentity.tenant_id},
      ${eventIdentity.batch_id},
      ${eventIdentity.tag_id},
      ${params.eventId}::bigint,
      ${eventIdentity.source_event_created_at},
      ${params.bid},
      ${params.uid},
      ${executionClass},
      'pending',
      ${targetNetwork},
      ${null},
      ${trustedRecipient || null},
      'sun_auto_valid_tap',
      now(),
      ${JSON.stringify({
        trace_id: params.traceId,
        event_id: params.eventId || null,
        source: "sun_valid_tap_auto_mint",
        execution_class: executionClass,
        tokenization_policy: tokenizationConfig.policy,
        tokenization_policy_source: tokenizationConfig.policySource,
        auto_tokenization_source: tokenizationConfig.autoSource,
      })}::jsonb
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `)[0];

  const executionRequest = inserted || (await sql/*sql*/`
    SELECT id
    FROM tokenization_requests
    WHERE tenant_id = ${eventIdentity.tenant_id}::uuid
      AND tag_id = ${eventIdentity.tag_id}::uuid
      AND execution_class = ${executionClass}
      AND network = ${targetNetwork}
      AND status IN ('pending', 'processing', 'reconciling', 'failed', 'anchored', 'blocked')
    ORDER BY requested_at DESC, id DESC
    LIMIT 1
  `)[0];
  if (!executionRequest?.id) {
    return { ok: false, reason: "tokenization_request_creation_conflict", status: "blocked" } as const;
  }
  return await anchorTokenizationRequest({
    requestId: String(executionRequest.id),
    tenantId: String(eventIdentity.tenant_id),
    issuerWallet: trustedRecipient || null,
    processor: "sun_auto_tokenization",
  });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const meta = getRequestMeta(req);
  const traceId = meta.traceId;
  const bid = url.searchParams.get('bid') || '';
  const picc_data = url.searchParams.get('picc_data') || '';
  const enc = url.searchParams.get('enc') || '';
  const cmac = url.searchParams.get('cmac') || '';
  const lowAssuranceChannel = String(url.searchParams.get("channel") || "").toLowerCase();
  const isQrScan = url.searchParams.get("qr") === "1"
    || lowAssuranceChannel === "qr"
    || lowAssuranceChannel === "static_nfc";

  const ua = req.headers.get('user-agent') || '';
  const ip = meta.ip;
  const geoCity = safeDecode(req.headers.get('x-vercel-ip-city'));
  const geoCountry = req.headers.get('x-vercel-ip-country') || null;
  const edgeCoordinate = normalizeCoordinatePair(
    req.headers.get('x-vercel-ip-latitude'),
    req.headers.get('x-vercel-ip-longitude'),
  );
  const geoLat = edgeCoordinate?.lat ?? null;
  const geoLng = edgeCoordinate?.lng ?? null;
  const locale = resolveSunLocale(url, geoCountry, req.headers.get('accept-language'));

  const payloadFingerprint = crypto
    .createHash("sha256")
    .update(`${bid}:${picc_data}:${enc}:${cmac}`)
    .digest("hex")
    .slice(0, 32);
  const [ipRate, bidRate, payloadRate] = await Promise.all([
    safeHitSunRateLimit('ip', ip || 'unknown', 60, RATE_LIMIT_MAX_IP),
    safeHitSunRateLimit('bid', bid || 'unknown', 60, RATE_LIMIT_MAX_BID),
    safeHitSunRateLimit('payload', payloadFingerprint, 60, RATE_LIMIT_MAX_UID_CTR),
  ]);
  if ([ipRate, bidRate, payloadRate].some((rate) => rate.unavailable) && shouldFailClosedSunRateLimit()) {
    return json(
      { ok: false, reason: 'sun_security_temporarily_unavailable' },
      503,
      { "cache-control": "no-store", "retry-after": "30", "x-nexid-trace-id": traceId, "x-request-id": traceId },
    );
  }
  if (ipRate.limited || bidRate.limited || payloadRate.limited) {
    const retryAfter = Math.max(ipRate.retryAfterSeconds, bidRate.retryAfterSeconds, payloadRate.retryAfterSeconds);
    return json(
      { ok: false, reason: 'rate_limited' },
      429,
      { "cache-control": "no-store", "retry-after": String(retryAfter), "x-nexid-trace-id": traceId, "x-request-id": traceId },
    );
  }
  if (isQrScan) {
    return handleQrScan({ req, url, traceId, ip, userAgent: ua, geoCity, geoCountry, geoLat, geoLng });
  }
  const malformed = (reason: string, need?: string[]) => json({
    ok: false,
    request_id: traceId,
    result: 'MALFORMED_URL',
    auth_status: 'MALFORMED_URL',
    product_state: 'MALFORMED_URL',
    reason,
    ...(need ? { need } : {}),
  }, 400, { "x-nexid-trace-id": traceId, "x-request-id": traceId });
  if (!bid || !picc_data || !enc || !cmac) return malformed('missing params', ['bid', 'picc_data', 'enc', 'cmac']);
  if (!BID_RE.test(bid)) return malformed('invalid bid format');
  if (!HEX_RE.test(picc_data) || picc_data.length % 2 !== 0) return malformed('invalid picc_data hex');
  if (!HEX_RE.test(enc) || enc.length !== 32) return malformed('invalid enc hex (expected 32 hex chars)');
  if (!HEX_RE.test(cmac) || cmac.length !== 16) return malformed('invalid cmac hex (expected 16 hex chars)');

  const sunScanInput = {
    bid,
    piccDataHex: picc_data,
    encHex: enc,
    cmacHex: cmac,
    rawQuery: Object.fromEntries(url.searchParams.entries()),
    context: {
      ip,
      userAgent: ua,
      city: geoCity,
      countryCode: geoCountry,
      lat: geoLat,
      lng: geoLng,
      source: 'real' as const,
      meta: {
        trace_id: traceId,
        request_id: req.headers.get('x-request-id') || null,
      },
    },
  };
  let result: SunResult;
  try {
    result = await withTimeout(processSunScan(sunScanInput), SUN_PIPELINE_TIMEOUT_MS, "sun_pipeline");
  } catch (error) {
    const internalReason = error instanceof Error ?error.message : 'sun_processing_error';
    result = { status: 503, body: { ok: false, reason: sanitizePublicErrorReason(internalReason) } } as SunResult;
    console.error("[sun_scan_error]", JSON.stringify({ traceId, bid, reason: internalReason }));
  }

  if (shouldRepairDemoBodegaSun(bid, result)) {
    try {
      const seeded = await withTimeout(seedDemoPack({ pack: "wine-secure", forceBid: bid }), 6000, "demo_bodega_seed_repair");
      console.warn("[sun_demo_bodega_repaired]", JSON.stringify({
        traceId,
        bid,
        pack: seeded.pack,
        imported: seeded.imported,
      }));
      result = await withTimeout(processSunScan({
        ...sunScanInput,
        context: {
          ...sunScanInput.context,
          meta: {
            ...sunScanInput.context.meta,
            demo_bodega_auto_repaired: true,
          },
        },
      }), SUN_PIPELINE_TIMEOUT_MS, "sun_pipeline_repaired");
    } catch (error) {
      console.error("[sun_demo_bodega_repair_failed]", JSON.stringify({
        traceId,
        bid,
        reason: error instanceof Error ?error.message : "demo_bodega_repair_failed",
      }));
    }
  }

  let uid = result.body.uid || null;
  let eventId = Number((result.body as { event_id?: number }).event_id || 0) || null;
  let ctr = typeof result.body.ctr === 'number' ?result.body.ctr : null;
  if (uid && ctr != null) {
    const uidCtrRate = await safeHitSunRateLimit('uid_ctr', `${uid}:${ctr}`, 60, RATE_LIMIT_MAX_UID_CTR);
    if (uidCtrRate.unavailable && shouldFailClosedSunRateLimit()) {
      return json(
        { ok: false, reason: 'sun_security_temporarily_unavailable' },
        503,
        { "cache-control": "no-store", "retry-after": "30", "x-nexid-trace-id": traceId, "x-request-id": traceId },
      );
    }
    if (uidCtrRate.limited) {
      return json(
        { ok: false, reason: 'rate_limited' },
        429,
        { "cache-control": "no-store", "retry-after": String(uidCtrRate.retryAfterSeconds), "x-nexid-trace-id": traceId, "x-request-id": traceId },
      );
    }
  }
  const tagPassport = await withTimeout(getPassportSnapshot(bid, uid || undefined), 2500, "sun_passport_snapshot").catch(() => null);
  const batchContext = tagPassport
    ? null
    : await withTimeout(getBatchSunContext(bid), 2500, "sun_batch_context").catch(() => null);
  const passport = tagPassport || batchContext;
  const timeline = await withTimeout(getTimelineSummary(bid, uid || undefined), 2500, "sun_timeline_summary").catch(() => [] as TimelineEvent[]);
  const ctaTimeline = await withTimeout(getCtaTimelineSummary(bid, uid || undefined), 2500, "sun_cta_timeline").catch(() => [] as TimelineEvent[]);
  const mergedTimeline = [...timeline, ...ctaTimeline]
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 8);
  const contract = buildPublicContract({
    bid,
    uid,
    ctr,
    result: result.body,
    passport,
    timeline: mergedTimeline,
    tap: {
      userAgent: ua,
      city: geoCity,
      country: geoCountry,
      lat: geoLat,
      lng: geoLng,
    },
  });
  (contract as Record<string, unknown>).trace_id = traceId;

  if (!contract.provenance.timelineSummary.length) {
    contract.provenance.timelineSummary = [
      {
        at: new Date().toISOString(),
        result: contract.status.code || "REVIEW",
        city: geoCity || "Unknown",
        country: geoCountry || "--",
        device: `${contract.tapContext.os} · ${contract.tapContext.browser}`,
        lat: geoLat,
        lng: geoLng,
        stage: "current_tap",
      },
    ];
  }

  const tenantTokenizationMode = String(contract.tenant?.tokenizationMode || "manual");
  const tapTokenizationPolicy = String(contract.tapSecurity?.policy || "");
  const tenantAllowsAutoTokenization =
    tenantTokenizationMode === "valid_and_opened"
      ?tapTokenizationPolicy === "fresh_valid_tap" || tapTokenizationPolicy === "verified_opened_tap"
      : tenantTokenizationMode === "valid_only"
        ?tapTokenizationPolicy === "fresh_valid_tap"
        : false;
  const canAutoTokenizeFreshTap =
    Boolean(result.body.ok && uid)
    && tenantAllowsAutoTokenization
    && contract.trustSignals?.antiReplay === true
    && !String(contract.status.reason || result.body.reason || "").toLowerCase().includes("replay")
    && !String(contract.status.reason || result.body.reason || "").toLowerCase().includes("copied url")
    && !contract.blockedActions?.includes("tokenization")
    && contract.tapSecurity?.tokenizationEligible === true;

  if (canAutoTokenizeFreshTap && uid) {
    const autoMint = await queueAutoTokenizationForValidTap({ bid, uid, traceId, eventId }).catch((error) => ({
      ok: false,
      reason: error instanceof Error ?error.message : "auto_tokenization_failed",
      status: "failed",
    }));
    if (autoMint && typeof autoMint === "object" && "ok" in autoMint) {
      if (autoMint.ok === false) {
        const mintReason = "reason" in autoMint ?String(autoMint.reason || "unknown_error") : "unknown_error";
        const autoStatus = "status" in autoMint ?String(autoMint.status || "failed").toLowerCase() : "failed";
        const publicReason = sanitizePublicErrorReason(mintReason);
        const tokenizationMeta = contract.tokenization as Record<string, unknown>;
        if ("request_id" in autoMint && autoMint.request_id) tokenizationMeta.requestId = String(autoMint.request_id);
        if ("next_attempt_at" in autoMint && autoMint.next_attempt_at) tokenizationMeta.nextAttemptAt = String(autoMint.next_attempt_at);
        tokenizationMeta.reason = publicReason;
        console.warn("[sun_auto_tokenization]", JSON.stringify({
          traceId,
          bid,
          uidMasked: maskIdentityValue(uid),
          status: autoStatus,
          requestId: tokenizationMeta.requestId || null,
          reason: publicReason,
        }));
        if (autoStatus === "pending" || autoStatus === "processing") {
          contract.tokenization.status = "mint_pending_retry";
          contract.troubleshooting = [
            ...contract.troubleshooting,
            `Tokenizacion Polygon en cola (${publicReason}).`,
            "La lectura sigue siendo valida; el minter reintentara sin mostrar fallo final al consumidor.",
          ];
        } else {
          contract.tokenization.status = "mint_failed";
          contract.troubleshooting = [
            ...contract.troubleshooting,
            `Tokenizacion automatica fallo (${publicReason}).`,
            "Revisa balance de gas, RPC de Polygon y clave minter en variables de entorno.",
          ];
        }
      } else if (autoMint.ok === true && "status" in autoMint && String(autoMint.status || "") === "anchored") {
        contract.tokenization.status = "minted";
        if ("tx_hash" in autoMint && autoMint.tx_hash) contract.tokenization.txHash = String(autoMint.tx_hash);
        if ("token_id" in autoMint && autoMint.token_id) contract.tokenization.tokenId = String(autoMint.token_id);
        if ("network" in autoMint && autoMint.network) contract.tokenization.network = String(autoMint.network);
        if ("anchor_hash" in autoMint && autoMint.anchor_hash) (contract.tokenization as Record<string, unknown>).anchorHash = String(autoMint.anchor_hash);
        if ("request_id" in autoMint && autoMint.request_id) (contract.tokenization as Record<string, unknown>).requestId = String(autoMint.request_id);
      }
    }
  }

  if ((contract.tokenization.status === "none" || !contract.tokenization.status) && contract.status.code === "REPLAY_SUSPECT") {
    contract.tokenization.status = "blocked_replay";
  }
  if (
    (contract.tokenization.status === "none" || !contract.tokenization.status)
    && contract.blockedActions?.includes("tokenization")
    && String(contract.tapSecurity?.policy || "").startsWith("blocked_")
  ) {
    contract.tokenization.status = contract.tapSecurity.policy;
  }

  if ((contract.tokenization.status === "none" || !contract.tokenization.status) && ctaTimeline.some((item) => String(item.result || "").includes("TOKENIZE_REQUEST"))) {
    contract.tokenization.status = "requested";
    contract.tokenization.network = contract.tokenization.network || "polygon-amoy";
  }

  const maskedUid = uid ?`${String(uid).slice(0, 4)}***${String(uid).slice(-4)}` : null;
  const verdict = String(contract.status.code || result.body.result || "UNKNOWN");
  const diagnosticRequest = {
    evidence_source: "public_sun_route",
    evidence_version: 1,
    ...(redactSensitiveQueryValues({ bid, picc_data, enc, cmac }) || { bid }),
    payload_fingerprint: payloadFingerprint,
  };
  const diagnosticId = await insertSunDiagnostic({
    trace_id: traceId,
    tool_type: "sun_scan",
    bid,
    uid_hex: uid || null,
    uid_masked: maskedUid,
    read_counter: typeof ctr === "number" ?ctr : null,
    auth_status: String((result.body as { auth_status?: string }).auth_status || result.body.result || "UNKNOWN"),
    replay_status: verdict === "REPLAY_SUSPECT" ?"REPLAY_SUSPECT" : "NO_REPLAY",
    product_state: (result.body as { product_state?: string }).product_state || null,
    tamper_status: (result.body as { tamper_status?: string }).tamper_status || null,
    tamper_signal: (result.body as { tamper_signal?: string }).tamper_signal || null,
    tamper_opened: Boolean((result.body as { tamper_opened?: boolean }).tamper_opened),
    tamper_risk: Boolean((result.body as { tamper_risk?: boolean }).tamper_risk),
    tagtamper_config_detected: Boolean((result.body as { tag_tamper_config_detected?: boolean }).tag_tamper_config_detected),
    enc_plain_status_byte: (result.body as { enc_plain_status_byte?: string }).enc_plain_status_byte || null,
    request_json: diagnosticRequest,
    result_json: { contract, raw_result: result.body },
    notes: [`trace:${traceId}`],
  });
  const sunDiagnostics = ((result.body as { sun_diagnostics?: Record<string, unknown> }).sun_diagnostics || {}) as Record<string, unknown>;
  console.info("[sun_scan]", JSON.stringify({
    traceId,
    route: "/sun",
    bid,
    uidMasked: maskedUid,
    verdict,
    cryptoErrorReason: sunDiagnostics.crypto_error_reason || null,
    verificationMethod: sunDiagnostics.verification_method || null,
    cmacValid: sunDiagnostics.cmac_valid ?? null,
    sdmDecryptionOk: sunDiagnostics.sdm_decryption_ok ?? null,
    uidDecoded: sunDiagnostics.uid_decoded ?? null,
    readCounter: sunDiagnostics.read_counter ?? null,
    piccLayout: sunDiagnostics.picc_layout || null,
    selectedMacInput: sunDiagnostics.selected_mac_input || null,
    configuredMacInputModes: sunDiagnostics.configured_mac_input_modes || null,
    piccCandidateCount: sunDiagnostics.picc_candidate_count ?? null,
    cmacCandidateCount: sunDiagnostics.cmac_candidate_count ?? null,
    encPlainHexLength: sunDiagnostics.enc_plain_hex_length ?? null,
    ttRaw: sunDiagnostics.tt_raw || null,
    ttPermHex: sunDiagnostics.tt_perm_hex || null,
    ttCurrHex: sunDiagnostics.tt_curr_hex || null,
    ttPermStatus: sunDiagnostics.tt_perm_status || null,
    ttCurrStatus: sunDiagnostics.tt_curr_status || null,
    ttStatusSource: sunDiagnostics.tt_status_source || null,
    ttStatusOffset: sunDiagnostics.tt_status_offset ?? null,
    ttStatusLength: sunDiagnostics.tt_status_length ?? null,
    batchSdmConfig: sunDiagnostics.batch_sdm_config || null,
    supplierPayloadMatch: sunDiagnostics.supplier_payload_match ?? null,
    tamperSignal: (result.body as { tamper_signal?: string }).tamper_signal || null,
    tamperOpened: Boolean((result.body as { tamper_opened?: boolean }).tamper_opened),
    tamperRisk: Boolean((result.body as { tamper_risk?: boolean }).tamper_risk),
    tagTamperConfigDetected: Boolean((result.body as { tag_tamper_config_detected?: boolean }).tag_tamper_config_detected),
    encPlainStatusByte: (result.body as { enc_plain_status_byte?: string }).enc_plain_status_byte || null,
    eventId,
    diagnosticId,
    status: result.status,
    tenant: contract.tenantSlug || contract.tenant?.slug || "unknown",
    createdAt: new Date().toISOString(),
  }));
  if (diagnosticId) (contract as Record<string, unknown>).diagnostic_id = diagnosticId;
  if (eventId) {
    try {
      const certificateShareToken = createPublicCertificateShareToken(eventId);
      const certificateUrl = new URL(`/certificado/${encodeURIComponent(String(eventId))}`, webBaseUrl(url));
      certificateUrl.searchParams.set("share", certificateShareToken);
      (contract as Record<string, unknown>).certificate = {
        shareToken: certificateShareToken,
        url: certificateUrl.toString(),
      };
    } catch {
      // Production certificates fail closed if a signing secret is unavailable.
    }
  }

  if (wantsHtml(req, url)) {
    const snapshotAccessToken = diagnosticId
      ?(() => {
          try {
            return createSunSnapshotAccessToken({ diagnosticId, traceId });
          } catch (error) {
            console.warn("[sun_snapshot_access_unavailable]", JSON.stringify({
              traceId,
              diagnosticId,
              reason: sanitizePublicErrorReason(error instanceof Error ?error.message : "snapshot_access_error"),
            }));
            return null;
          }
        })()
      : null;
    const freshHandoffToken = diagnosticId && contract.tapSecurity?.freshTap && !contract.tapSecurity?.replayDetected && eventId
      ?(() => {
          try {
            const now = Math.floor(Date.now() / 1000);
            return createSunFreshHandoffToken({
              bid,
              eventId: String(eventId),
              uidHex: uid,
              readCounter: ctr,
              diagnosticId,
              traceId,
              exp: now + 60 * 5,
            });
          } catch (error) {
            console.warn("[sun_fresh_handoff_unavailable]", JSON.stringify({
              traceId,
              diagnosticId,
              reason: sanitizePublicErrorReason(error instanceof Error ?error.message : "fresh_handoff_error"),
            }));
            return null;
          }
        })()
      : null;
    const webTarget = wantsInlineApiHtml(url)
      ?null
      : buildWebSunSnapshotUrl(url, diagnosticId, traceId, locale, freshHandoffToken, snapshotAccessToken);
    if (webTarget) {
      return Response.redirect(webTarget, 303);
    }
    const shareToken = uid || eventId
      ?(() => {
          try {
            const now = Math.floor(Date.now() / 1000);
            return createDemoShareToken({ bid, uid: uid || (eventId ?eventShareUid(eventId) : ""), exp: now + 60 * 30 });
          } catch {
            return null;
          }
        })()
      : null;
    return new Response(renderSunHtml(contract, shareToken, locale, url), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-robots-tag': 'noindex, nofollow',
        'referrer-policy': 'no-referrer',
        'x-nexid-trace-id': traceId,
        'x-request-id': traceId,
        'x-nexid-upstream-status': String(result.status || 200),
      },
    });
  }

  const response = json(contract, result.status);
  response.headers.set("x-nexid-trace-id", traceId);
  response.headers.set("x-request-id", traceId);
  if (diagnosticId) response.headers.set("x-nexid-diagnostic-id", String(diagnosticId));
  if (eventId) response.headers.set("x-nexid-event-id", String(eventId));
  return response;
}
