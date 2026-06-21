export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json } from '../../lib/http';
import { processSunScan } from '../../lib/sun-service';
import { normalizeDemoBodegaSunResult } from '../../lib/sun-demo-bodega-normalizer';
import { createDemoShareToken } from '../../lib/demo-share';
import { seedDemoPack } from '../../lib/demo-seed';
import { sql } from '../../lib/db';
import { anchorTokenizationRequest } from '../../lib/tokenization-engine';
import { ensureTokenizationRequestsSchema } from '../../lib/tokenization-schema';
import { buildLifecycleState, listDemoCta } from '../../lib/demo-cta';
import { insertSunDiagnostic } from '../../lib/sun-diagnostics';
import { mapVerdictAndRisk, resolveActionMatrix, resolveRightsPolicy } from '../../lib/sun-passport-policy';
import { resolveSunTenantProfile } from '../../lib/sun-tenant-profile';
import { ensureSunTenantProfilesSchema } from '../../lib/sun-tenant-profile-schema';
import { ensureCarrierProfileSchema } from '../../lib/commercial-runtime-schema';
import { getRequestMeta } from '../../lib/request-meta';
import { hitSunRateLimit } from '../../lib/sun-rate-limit-store';
import { createSunFreshHandoffToken } from '../../lib/sun-fresh-handoff';
import { eventShareUid } from '../../lib/public-cta-target';
import { recordTapEvent } from '../../lib/tap-event-service';
import { resolveEventLocalTime } from '@product/core';
import crypto from "node:crypto";

const RATE_LIMIT_MAX_IP = Number(process.env.SUN_RATE_LIMIT_IP_PER_MIN || 120);
const RATE_LIMIT_MAX_BID = Number(process.env.SUN_RATE_LIMIT_BID_PER_MIN || 240);
const RATE_LIMIT_MAX_UID_CTR = Number(process.env.SUN_RATE_LIMIT_UID_CTR_PER_MIN || 30);
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
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
} | null;

type TimelineEvent = {
  at: string | null;
  result: string | null;
  city: string | null;
  country: string | null;
  device: string | null;
  lat?: number | null;
  lng?: number | null;
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
    winery: "Demo Bodega",
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
    winery: "Demo Bodega",
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

function buildWebSunSnapshotUrl(url: URL, diagnosticId: number | null, traceId: string, locale: SunLocale, freshToken?: string | null) {
  if (!traceId) return null;
  const target = new URL("/sun", webBaseUrl(url));
  if (diagnosticId) {
    target.searchParams.set("snapshot", String(diagnosticId));
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
    console.warn("[sun_rate_limit_unavailable]", JSON.stringify({ scope, scopeKey, reason: sanitizePublicErrorReason(reason) }));
    return { hits: 0, limited: false, unavailable: true };
  }
}

function shouldRepairDemoBodegaSun(bid: string, result: SunResult) {
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
      quality: "Qualidade",
      authReplay: "Replay detectado: solicite um novo toque físico antes de titularidade/garantia/tokenização.",
      authOk: "Autenticação concluída. Você pode continuar com titularidade, garantia, proveniência e tokenização opcional.",
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
      quality: "Quality",
      authReplay: "Replay detected: request a fresh physical tap before ownership/warranty/tokenization.",
      authOk: "Authentication complete. You can continue with ownership, warranty, provenance and optional tokenization.",
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
    quality: "Calidad",
    authReplay: "Replay detectado: pedí un nuevo tap físico antes de titularidad/garantía/tokenización.",
    authOk: "Autenticación completada. Podés seguir con titularidad, garantía, proveniencia y tokenización opcional.",
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
  if (normalizedStatus === 'REPLAY_SUSPECT' || normalizedReason.includes('replay') || normalizedReason.includes('copied url')) {
    return { code: 'REPLAY_SUSPECT', label: 'URL reutilizada', summary: 'Este payload ya fue usado. Escaneá físicamente la etiqueta para generar una nueva lectura.', tone: 'warn' as const };
  }
  if (normalizedProductState === "VALID_OPENED" || normalizedStatus === 'OPENED' || normalizedReason.includes('opened')) {
    return { code: 'OPENED', label: 'Sello abierto', summary: 'Producto auténtico, pero el sello fue abierto.', tone: 'warn' as const };
  }
  if (normalizedProductState === "VALID_OPENED_PREVIOUSLY") {
    return { code: 'OPENED_PREVIOUSLY', label: 'Autenticidad confirmada', summary: 'Autenticidad confirmada. El sello fue abierto anteriormente.', tone: 'warn' as const };
  }
  if (normalizedProductState === "VALID_MANUAL_OPENED") {
    return { code: 'MANUAL_OPENED', label: 'Apertura registrada', summary: 'Producto auténtico. Sello marcado como abierto por operador.', tone: 'warn' as const };
  }
  if (normalizedProductState === "VALID_UNKNOWN_TAMPER") {
    return { code: 'VALID_UNKNOWN_TAMPER', label: 'Autenticidad confirmada', summary: 'Autenticidad confirmada. Estado de apertura no disponible para este lote.', tone: 'good' as const };
  }
  if (normalizedStatus === 'TAMPER_RISK' || normalizedReason.includes('tamper')) {
    return { code: 'TAMPER_RISK', label: 'Riesgo de manipulación', summary: 'Se detectaron señales de posible manipulación.', tone: 'risk' as const };
  }
  if (normalizedProductState === "VALID_CLOSED" || normalizedStatus === 'VALID') {
    return { code: 'VALID', label: 'Autenticidad confirmada', summary: 'Producto auténtico. Sello intacto.', tone: 'good' as const };
  }
  return { code: normalizedStatus || 'INVALID', label: 'Validación no concluyente', summary: 'No fue posible confirmar autenticidad final.', tone: 'warn' as const };
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

function parseCoordinate(value: string | null, fallback: number) {
  const parsed = Number(value || "");
  return Number.isFinite(parsed) ? parsed : fallback;
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

async function resolveQrTenantBatch(url: URL) {
  const tenantSlug = firstParam(url, ["tenant", "tenantSlug", "tenant_slug"], "demobodega").toLowerCase();
  const requestedBid = firstParam(url, ["bid", "batch", "batchId"]);
  const rows = await sql/*sql*/`
    SELECT
      tn.id::text AS tenant_id,
      tn.slug AS tenant_slug,
      tn.name AS tenant_name,
      b.id::text AS batch_id,
      b.bid,
      b.sdm_config
    FROM tenants tn
    LEFT JOIN LATERAL (
      SELECT id, bid, sdm_config, created_at
      FROM batches b
      WHERE b.tenant_id = tn.id
        AND b.status = 'active'
        AND (${requestedBid} = '' OR b.bid = ${requestedBid})
      ORDER BY CASE WHEN b.bid = ${requestedBid} THEN 0 ELSE 1 END, b.created_at DESC
      LIMIT 1
    ) b ON TRUE
    WHERE tn.slug = ${tenantSlug}
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
  reason: string;
  ip: string | null;
  userAgent: string;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  rawQuery: Record<string, string>;
  meta: Record<string, unknown>;
}) {
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
      'QR_SCAN',
      ${input.reason},
      ${input.ip},
      ${input.userAgent},
      ${input.city},
      ${input.country},
      ${input.lat},
      ${input.lng},
      'real',
      ${JSON.stringify(input.rawQuery)}::jsonb,
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
  geoLat: number;
  geoLng: number;
}) {
  const requestedProduct = firstParam(input.url, ["product", "productName", "name"], "Gran Reserva Malbec");
  const requestedWinery = firstParam(input.url, ["winery", "brand"], "Demo Bodega");
  const requestedRegion = firstParam(input.url, ["region", "origin"], "Mendoza, Argentina");
  const browserLat = parseCoordinate(input.url.searchParams.get("lat") || input.url.searchParams.get("gps_lat"), input.geoLat);
  const browserLng = parseCoordinate(input.url.searchParams.get("lng") || input.url.searchParams.get("gps_lng"), input.geoLng);
  const hasGeo = Number.isFinite(browserLat) && Number.isFinite(browserLng);
  const tenantBatch = await resolveQrTenantBatch(input.url).catch(() => undefined);
  
  const tenantSlug = String(tenantBatch?.tenant_slug || firstParam(input.url, ["tenant", "tenantSlug", "tenant_slug"], "demobodega")).toLowerCase();
  const tenantName = String(tenantBatch?.tenant_name || requestedWinery || tenantSlug);
  
  let tenantId = tenantBatch?.tenant_id || null;
  let batchId = tenantBatch?.batch_id || null;
  let sdmConfig = jsonObject(tenantBatch?.sdm_config);
  let bid = String(tenantBatch?.bid || firstParam(input.url, ["bid"], ""));

  if (!tenantId) {
    try {
      const newTenant = await sql`
        INSERT INTO tenants (slug, name, status)
        VALUES (${tenantSlug}, ${tenantName}, 'active')
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
        RETURNING id::text, slug, name
      `;
      if (newTenant[0]) {
        tenantId = newTenant[0].id;
      }
    } catch (e) {
      console.error("[sun] auto-create tenant failed", e);
    }
  }

  if (tenantId && !batchId) {
    try {
      const existing = await sql`
        SELECT id::text, bid, sdm_config
        FROM batches
        WHERE tenant_id = ${tenantId} AND bid = 'QR-DEFAULT'
        LIMIT 1
      `;
      if (existing[0]) {
        batchId = existing[0].id;
        sdmConfig = jsonObject(existing[0].sdm_config);
        bid = existing[0].bid;
      } else {
        const newBatch = await sql`
          INSERT INTO batches (tenant_id, bid, status, sdm_config, name)
          VALUES (${tenantId}, 'QR-DEFAULT', 'active', '{}'::jsonb, 'Default QR Batch')
          RETURNING id::text, bid, sdm_config
        `;
        if (newBatch[0]) {
          batchId = newBatch[0].id;
          sdmConfig = jsonObject(newBatch[0].sdm_config);
          bid = newBatch[0].bid;
        }
      }
    } catch (e) {
      console.error("[sun] auto-create QR-DEFAULT batch failed", e);
    }
  }

  if (!bid) {
    bid = "QR-DEFAULT";
  }

  const rawQuery = Object.fromEntries(input.url.searchParams.entries());
  const deviceMeta = {
    userAgent: input.userAgent,
    platform: platformFromUserAgent(input.userAgent),
    browser: browserFromUserAgent(input.userAgent),
    mobile: /mobile|iphone|android|ipad/i.test(input.userAgent),
    language: input.req.headers.get("accept-language") || null,
    timezone: firstParam(input.url, ["timezone", "tz"]),
  };
  const meta = {
    trace_id: input.traceId,
    channel: "qr",
    qr: true,
    product: { name: requestedProduct, winery: requestedWinery, region: requestedRegion },
    sun_context: { client: deviceMeta },
  };

  const eventId = batchId
    ? await recordTapEvent({
      tenantId: tenantId,
      tenantSlug,
      batchId: batchId,
      bid,
      uidHex: firstParam(input.url, ["uid", "uidHex", "uid_hex"]) || null,
      source: "real",
      eventType: "PROVENANCE_VIEWED",
      verdict: "valid",
      riskLevel: "low",
      cmacOk: null,
      allowlisted: null,
      tagStatus: null,
      userAgent: input.userAgent,
      city: input.geoCity,
      countryCode: input.geoCountry,
      lat: hasGeo ? browserLat : null,
      lng: hasGeo ? browserLng : null,
      geoPrecision: hasGeo ? "ip" : "none",
      productName: requestedProduct,
      reason: "qr_scan",
      meta,
      traceId: input.traceId,
      ip: input.ip,
      geoCity: input.geoCity,
      geoCountry: input.geoCountry,
      deviceLabel: deviceMeta.platform,
      rawQuery,
    })
    : null;

  if (!eventId) {
    await logQrAttempt({
      bid,
      reason: batchId ? "qr_event_insert_failed" : "qr_batch_not_found",
      ip: input.ip,
      userAgent: input.userAgent,
      city: input.geoCity,
      country: input.geoCountry,
      lat: hasGeo ? browserLat : null,
      lng: hasGeo ? browserLng : null,
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
      code: "QR_SCAN",
      label: "QR / SDK engagement",
      tone: "warn",
      summary: "Canal de bajo costo para ficha, CRM, analitica, leads y fidelizacion. No reemplaza la autenticacion criptografica NFC ni activa propiedad automaticamente.",
      reason: "qr_scan",
      productState: "QR_UNVERIFIED",
      carrierProfileCode: "qr_basic",
      carrierLabel: "QR / SDK",
    },
    identity: {
      bid,
      uid: null,
      uidMasked: null,
      eventId: eventId ? String(eventId) : null,
      tenantSlug,
      tenantId: tenantId,
      scanCount: 1,
    },
    tenant: {
      id: tenantId,
      slug: tenantSlug,
      name: tenantName,
      vertical: String(sdmConfig.vertical || "wine"),
      productLabel: "vino",
      clubName: String(sdmConfig.club_name || "Club Demo Bodega"),
      tokenizationMode: "nfc_only",
    },
    product: {
      name: requestedProduct,
      winery: requestedWinery,
      region: requestedRegion,
      varietal: firstParam(input.url, ["varietal"], "N/A"),
      vintage: firstParam(input.url, ["vintage"]),
      category: "Vino",
      vertical: "vino",
    },
    provenance: {
      origin: requestedRegion,
      firstVerified: { at: null, city: null, country: null },
      lastVerifiedLocation: { at: qrNow, city: input.geoCity, country: input.geoCountry, result: "QR_SCAN" },
      timelineSummary: [{
        at: qrNow,
        result: "QR_SCAN",
        city: input.geoCity || "Unknown",
        country: input.geoCountry || "--",
        device: `${deviceMeta.platform} - ${deviceMeta.browser}`,
        lat: hasGeo ? browserLat : null,
        lng: hasGeo ? browserLng : null,
      }],
    },
    tapContext: {
      city: input.geoCity,
      country: input.geoCountry,
      lat: hasGeo ? browserLat : null,
      lng: hasGeo ? browserLng : null,
      locationSource: hasGeo ? "ip_geo" : "none",
      accuracyM: null,
      ...qrTapTime,
    },
    tag_tamper: { available: false, status: "not_available", raw: null },
    cta: { claimOwnership: false, registerWarranty: false, provenance: true, tokenize: false },
    allowedActions: ["lead", "feedback", "sommelier"],
    blockedActions: ["ownership", "tokenization", "warranty"],
    trustSignals: { antiReplay: false, tamperRisk: false, tamperStatus: "not_available", tamperSupported: false, lastEventResult: "QR_SCAN" },
    tapSecurity: { replayDetected: false, freshTap: false, tokenizationEligible: false, policy: "qr_unverified", actionability: "content_and_crm_only", requiresFreshTapForCommercialActions: true },
    troubleshooting: ["Para titularidad, garantia o NFT, toca fisicamente el chip NFC seguro."],
    technical: { carrierProfileCode: "qr_basic", carrierLabel: "QR / SDK", raw: undefined },
  };

  const response = json(contract, 200);
  response.headers.set("x-nexid-trace-id", input.traceId);
  response.headers.set("x-request-id", input.traceId);
  if (eventId) response.headers.set("x-nexid-event-id", String(eventId));
  return response;
}

async function getPassportSnapshot(bid: string, uid: string | undefined): Promise<PassportSnapshot> {
  if (!uid) return null;
  await ensureTokenizationRequestsSchema().catch((error) => {
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
      NULL::text AS tokenization_token_id
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
    SELECT e.created_at::text AS at, e.result, e.city, e.country_code AS country, e.device_label AS device, e.lat, e.lng, e.meta
    FROM events e
    JOIN batches b ON b.id = e.batch_id
    WHERE b.bid = ${bid} AND UPPER(e.uid_hex) = UPPER(${uid})
    ORDER BY e.created_at DESC
    LIMIT 6
  `;
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const meta = (row.meta && typeof row.meta === "object") ?row.meta as Record<string, unknown> : {};
    const sensors = (meta.sensors && typeof meta.sensors === "object") ?meta.sensors as Record<string, unknown> : {};
    return {
      at: row.at ?String(row.at) : null,
      result: row.result ?String(row.result) : null,
      city: row.city ?String(row.city) : null,
      country: row.country ?String(row.country) : null,
      device: row.device ?String(row.device) : null,
      lat: typeof row.lat === "number" ?Number(row.lat) : null,
      lng: typeof row.lng === "number" ?Number(row.lng) : null,
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

function buildDemoSensorHistory(
  timeline: TimelineEvent[],
  fallbackStorage: string | null,
  barrelMonths: number | null,
  simulatedTemp?: number | string | null,
  simulatedHumidity?: number | string | null
) {
  const baselineTemp = simulatedTemp != null && !Number.isNaN(Number(simulatedTemp)) ? Number(simulatedTemp) : (Number((fallbackStorage || "").replace(/[^\d.]/g, "")) || 16);
  const baselineHumidity = simulatedHumidity != null && !Number.isNaN(Number(simulatedHumidity)) ? Number(simulatedHumidity) : 68;
  const stages = ["cellar", "distribution", "retail", "consumer"];
  const measuredTimeline = timeline.filter((event) => event.sensorTempC != null || event.sensorHumidity != null);
  if (measuredTimeline.length) {
    return measuredTimeline.map((event, index) => {
      const temperatureC = event.sensorTempC != null ? Number(event.sensorTempC) : baselineTemp;
      const humidityPct = event.sensorHumidity != null ? Number(event.sensorHumidity) : baselineHumidity;
      const alert = temperatureC > 24 || temperatureC < 6
        ? "Temperatura fuera de rango declarado"
        : humidityPct > 82 || humidityPct < 45
          ? "Humedad fuera de rango declarado"
          : null;
      return {
        at: event.at,
        stage: event.stage || stages[Math.min(index, stages.length - 1)],
        temperatureC,
        humidityPct,
        barrelAgeMonths: barrelMonths,
        alert,
      };
    });
  }
  return [{
    at: new Date().toISOString(),
    stage: "cellar",
    temperatureC: baselineTemp,
    humidityPct: baselineHumidity,
    barrelAgeMonths: barrelMonths,
    alert: null,
  }];
}

function buildPublicContract(params: {
  bid: string;
  uid: string | null;
  ctr: number | null;
  result: SunResult['body'];
  passport: PassportSnapshot;
  timeline: TimelineEvent[];
  raw: { picc_data: string; enc: string; cmac: string };
  tap: { userAgent: string; city: string | null; country: string | null; lat: number | null; lng: number | null };
}) {
  const status = params.result.result || (params.result.ok ?'VALID' : 'INVALID');
  const reason = params.result.reason || 'sin_observaciones';
  const resultMeta = params.result as Record<string, unknown>;
  const trust = resolveTrustState(status, reason, params.result.product_state || null, resultMeta);
  const verdictRisk = mapVerdictAndRisk({ statusCode: trust.code, productState: params.result.product_state || null, reason });
  const tenantResolution = resolveSunTenantProfile({ bid: params.bid, passport: params.passport, result: params.result as Record<string, unknown> });
  const setupDashboardBase = dashboardBaseUrl();
  const setupEventId = (params.result as { event_id?: string | number | null }).event_id ? String((params.result as { event_id?: string | number | null }).event_id) : null;
  const setupUa = summarizeUserAgent(params.tap.userAgent);
  const troubleshooting = buildTroubleshooting(reason, params.bid, resultMeta);
  const carrierProfileCode = params.passport?.carrier_profile_code || null;
  const inferredCryptoCarrier = Boolean(resultMeta.tamper_supported || resultMeta.tag_tamper || resultMeta.ttstatus_raw || resultMeta.tamper_raw_value);
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
  if (!tenantResolution.ok) {
    const tenantSlug = tenantResolution.tenantSlug || "tenant-setup-required";
    const setupQuery = new URLSearchParams({ tenant: tenantSlug, fromTap: "1", action: "setup-required" });
    if (setupEventId) setupQuery.set("eventId", setupEventId);
    const setupProductName = params.passport?.product_name || params.passport?.sku || `Batch ${params.bid}`;
    const setupIsAuthentic = ["VALID", "OPENED", "OPENED_PREVIOUSLY", "MANUAL_OPENED", "VALID_UNKNOWN_TAMPER"].includes(trust.code);
    const setupIsReplay = trust.code === "REPLAY_SUSPECT" || verdictRisk.verdict === "replay_suspect";
    const setupScore = setupIsReplay ?22 : setupIsAuthentic ?(trust.code === "VALID" ?72 : 64) : 35;
    const setupRiskLevel = setupIsReplay || verdictRisk.verdict === "tampered"
      ?"high"
      : setupIsAuthentic
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
        productState: params.result.product_state || null,
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
      quality: { score: setupScore, tier: setupIsReplay ?"Replay Hold" : setupIsAuthentic ?"Setup Hold" : "Setup Required" },
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
      verdict: setupIsAuthentic ?"tenant_setup_required_authentic" : "tenant_setup_required",
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
  const sensorHistory = buildDemoSensorHistory(
    params.timeline,
    fallbackStorage,
    params.passport?.barrel_months || fallbackBarrelMonths,
    tenantProfile.product.simulatedTempC,
    tenantProfile.product.simulatedHumidityPct
  );
  const avgTemp = sensorHistory.length ?(sensorHistory.reduce((acc, item) => acc + (item.temperatureC || 0), 0) / sensorHistory.length) : null;
  const avgHumidity = sensorHistory.length ?(sensorHistory.reduce((acc, item) => acc + (item.humidityPct || 0), 0) / sensorHistory.length) : null;
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
    || ["OPENED", "OPENED_PREVIOUSLY", "MANUAL_OPENED"].includes(trust.code);
  const isAuthenticTap = verdictRisk.verdict === "valid" || isVerifiedOpenedTap;
  const rightsPolicy = resolveRightsPolicy({
    verdict: verdictRisk.verdict,
    vertical: tenantProfile.vertical,
    tokenizationMode: tenantProfile.tokenizationMode,
    claimPolicy: tenantProfile.claimPolicy,
    ownershipPolicy: tenantProfile.ownershipPolicy,
    statusCode: trust.code,
    productState: params.result.product_state || null,
    reason,
  });
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
    !carrierSupportsOwnership ?`${carrierLabel}: ownership publico requiere compra/custodia o carrier seguro.` : "",
    !carrierSupportsTokenization ?`${carrierLabel}: tokenizacion automatica requiere NTAG 424 DNA/TT o aprobacion manual.` : "",
  ].filter(Boolean);
  const effectiveRequirements = Array.from(new Set([...rightsPolicy.requirements, ...carrierRequirements]));
  const actionMatrix = {
    allowedActions: Array.from(carrierAllowedActions),
    blockedActions: Array.from(carrierBlockedActions),
  };
  const trustPenalty = trust.code === "VALID"
    ?0
    : isVerifiedOpenedTap
      ?8
      : trust.code === "SUN_PROFILE_MISMATCH"
        ?50
      : trust.code === "REPLAY_SUSPECT"
        ?35
        : trust.code === "TAMPER_RISK"
          ?44
          : 22;
  const sensorPenalty = sensorHistory.some((item) => item.alert) ?10 : 0;
  const qualityScore = Math.max(0, Math.min(100, 92 - trustPenalty - sensorPenalty));
  const compatibilityTokenizationPolicy = actionMatrix.allowedActions.includes("tokenization")
    ?isVerifiedOpenedTap
      ?"verified_opened_tap"
      : "fresh_valid_tap"
    : !carrierSupportsTokenization
      ?"blocked_carrier_profile"
      : String(rightsPolicy.tokenizationPolicy || "").startsWith("blocked_")
      ?rightsPolicy.tokenizationPolicy
      : verdictRisk.verdict === "replay_suspect"
        ?"blocked_replay"
        : verdictRisk.verdict === "tampered"
          ?"blocked_tamper"
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
      productState: params.result.product_state || null,
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
      canClaimPublicly: rightsPolicy.canClaimPublicly && actionMatrix.allowedActions.includes("claim"),
      canTokenize: actionMatrix.allowedActions.includes("tokenization"),
      requiresReview: rightsPolicy.requiresReview,
      statusTitle: rightsPolicy.statusTitle,
      statusSummary: rightsPolicy.statusSummary,
      consumerCopy: rightsPolicy.consumerCopy,
      enterpriseCopy: rightsPolicy.enterpriseCopy,
      recommendedNextStep: rightsPolicy.recommendedNextStep,
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
      freshTap: isAuthenticTap && verdictRisk.verdict !== "replay_suspect",
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
      sensorSnapshot: {
        cellarTemperature: avgTemp != null ?`${avgTemp.toFixed(1)}°C` : null,
        humidity: avgHumidity != null ?`${avgHumidity.toFixed(0)}%` : null,
        lightExposure: tenantProfile.product.simulatedLight || "Low / protected",
        transitShock: tenantProfile.product.simulatedShock || (sensorHistory.some((item) => item.alert) ? "Potential handling alert detected" : "No critical shocks detected"),
      },
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
    quality: {
      score: qualityScore,
      tier: qualityScore >= 85 ?"Premium" : qualityScore >= 75 ?"Verified Open" : qualityScore >= 65 ?"Monitored" : "At Risk",
    },
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

function renderSunHtml(contract: ReturnType<typeof buildPublicContract>, shareToken: string | null, locale: SunLocale, currentUrl: URL) {
  const copy = getSunCopy(locale);
  const langUrl = (lang: "es-AR" | "pt-BR" | "en") => {
    const next = new URL(currentUrl.toString());
    next.searchParams.set("lang", lang);
    return next.pathname + next.search;
  };
  const labels = locale === "pt-BR"
    ?{
      manualOpened: "Produto autêntico. Selo marcado como aberto por operador.",
      opened: "Produto autêntico, mas o selo foi aberto.",
      openedPreviously: "Autenticidade confirmada. O selo foi aberto anteriormente.",
      unknownTamper: "Autenticidade confirmada. Estado de abertura indisponível para este lote.",
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
      mapLocalTitle: "Mapa local · rota adega → toque",
      mapGlobalTitle: "Contexto global · posição do toque",
      mapLegend: "Origem da adega → ponto de toque",
      routeSummary: "Resumo da rota",
      routeDistance: "Distância estimada",
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
      tapHelp: "Se o toque estiver verificado, vamos pedir login/registro e associar sua conta automaticamente ao tenant.",
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
      mapStoryTitle: "Prova viva do percurso",
      mapStorySubtitle: "Do lote ao toque: cada ponto conta uma evidencia comercial.",
      mapOriginStep: "Origem certificada",
      mapTapStep: "Toque verificado",
      mapTokenStep: "Token / NFT",
      mapOwnerStep: "Conta e beneficios",
      mapLedgerTitle: "Ledger visual",
      mapInvestorSignal: "Sinal para marca",
      mapConsumerSignal: "Sinal para consumidor",
    }
    : locale === "en"
      ?{
        manualOpened: "Authentic product. Seal flagged as opened by operator.",
        opened: "Authentic product, but the seal was opened.",
        openedPreviously: "Authenticity confirmed. The seal was opened previously.",
        unknownTamper: "Authenticity confirmed. Open-state unavailable for this batch.",
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
        mapLocalTitle: "Local map · winery to tap route",
        mapGlobalTitle: "Global context · tap position",
        mapLegend: "Winery origin → tap point",
        routeSummary: "Route summary",
        routeDistance: "Estimated distance",
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
        tapHelp: "If this tap is verified, we will ask for sign-in/register and auto-link your account to the tenant.",
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
        mapStoryTitle: "Live proof journey",
        mapStorySubtitle: "From lot to tap: each point tells commercial evidence.",
        mapOriginStep: "Certified origin",
        mapTapStep: "Verified tap",
        mapTokenStep: "Token / NFT",
        mapOwnerStep: "Account and benefits",
        mapLedgerTitle: "Visual ledger",
        mapInvestorSignal: "Brand signal",
        mapConsumerSignal: "Consumer signal",
      }
      : {
        manualOpened: "Producto auténtico. Sello marcado como abierto por operador.",
        opened: "Producto auténtico, pero el sello fue abierto.",
        openedPreviously: "Autenticidad confirmada. El sello fue abierto anteriormente.",
        unknownTamper: "Autenticidad confirmada. Estado de apertura no disponible.",
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
        mapLocalTitle: "Mapa local · ruta bodega → tap",
        mapGlobalTitle: "Contexto global · posición del tap",
        mapLegend: "Origen bodega → punto de tap",
        routeSummary: "Resumen de ruta",
        routeDistance: "Distancia estimada",
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
        tapHelp: "Si el tap está verificado, te vamos a pedir login/registro y asociar tu cuenta al tenant automáticamente.",
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
        mapStoryTitle: "Prueba viva del recorrido",
        mapStorySubtitle: "Del lote al tap: cada punto cuenta una evidencia comercial.",
        mapOriginStep: "Origen certificado",
        mapTapStep: "Tap verificado",
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
  const isClosedState = productState === "VALID_CLOSED" || (statusCode === "VALID" && !isSunProfileMismatchState);
  const isOpenedState =
    productState === "VALID_MANUAL_OPENED" ||
    productState === "VALID_OPENED" ||
    productState === "VALID_OPENED_PREVIOUSLY" ||
    statusCode === "MANUAL_OPENED" ||
    statusCode === "OPENED" ||
    statusCode === "OPENED_PREVIOUSLY";
  const authPanelMessage = isRiskBlocked || isSunProfileMismatchState
    ?copy.authReplay
    : isClosedState
      ?(copy.lang === "en" ?"Authenticity confirmed. Seal intact." : copy.lang === "pt-BR" ?"Autenticidade confirmada. Selo intacto." : "Autenticidad confirmada. Sello intacto.")
      : isOpenedState
        ?(copy.lang === "en" ?"Authentic product. Seal opened." : copy.lang === "pt-BR" ?"Produto autentico. Selo aberto." : "Producto autentico. Sello abierto.")
    : productState === "VALID_MANUAL_OPENED" || statusCode === "MANUAL_OPENED"
      ?labels.manualOpened
      : productState === "VALID_OPENED" || statusCode === "OPENED"
      ?labels.opened
      : productState === "VALID_OPENED_PREVIOUSLY" || statusCode === "OPENED_PREVIOUSLY"
        ?labels.openedPreviously
      : productState === "VALID_UNKNOWN_TAMPER"
        ?labels.unknownTamper
        : copy.authOk;
  const commercialStateLabel = isRiskBlocked
    ?`${labels.commercialState}: ${labels.hold}`
    : productState === "VALID_MANUAL_OPENED" || contract.status.code === "MANUAL_OPENED"
      ?`${labels.commercialState}: DEMO_OPENED`
      : productState === "VALID_OPENED" || contract.status.code === "OPENED"
      ?`${labels.commercialState}: ${labels.review}`
      : productState === "VALID_OPENED_PREVIOUSLY" || contract.status.code === "OPENED_PREVIOUSLY"
        ?`${labels.commercialState}: ${labels.reviewPrev}`
      : `${labels.commercialState}: ${labels.ok}`;
  const riskStateLabel = isRiskBlocked
    ?`${labels.risk}: ${labels.riskReplay}`
    : productState === "VALID_MANUAL_OPENED" || contract.status.code === "MANUAL_OPENED"
      ?`${labels.risk}: ${labels.riskManual}`
      : productState === "VALID_OPENED" || contract.status.code === "OPENED"
      ?`${labels.risk}: ${labels.riskTamper}`
      : productState === "VALID_OPENED_PREVIOUSLY" || contract.status.code === "OPENED_PREVIOUSLY"
        ?`${labels.risk}: ${labels.riskPrev}`
      : `${labels.risk}: ${labels.riskControlled}`;
  const timeline = contract.provenance.timelineSummary;
  const timelineHtml = timeline.length
    ? timeline.map((item) => `<li>${item.at || 'N/A'} · <b>${item.result || '-'}</b> · ${item.city || '-'}, ${item.country || '-'}</li>`).join('')
    : `<li>${copy.timelineEmpty}</li>`;
  const htmlText = (value: unknown) => String(value ?? "-").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] || char));
  const tapLat = contract.tapContext.lat;
  const tapLng = contract.tapContext.lng;
  const wineryLat = contract.iot.wineryCoordinates?.lat ?? tapLat ?? -33.0086;
  const wineryLng = contract.iot.wineryCoordinates?.lng ?? tapLng ?? -68.7794;
  const destinationLat = tapLat ?? wineryLat;
  const destinationLng = tapLng ?? wineryLng;
  const mapWidth = 1000;
  const mapHeight = 460;
  const projectWorld = (lat: number, lng: number) => {
    const clippedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
    const sin = Math.sin((clippedLat * Math.PI) / 180);
    return {
      x: ((lng + 180) / 360) * mapWidth,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * mapHeight,
    };
  };
  const clampMap = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const wineryPoint = projectWorld(wineryLat, wineryLng);
  const tapPoint = projectWorld(destinationLat, destinationLng);
  const toRad = (v: number) => v * (Math.PI / 180);
  const earthKm = 6371;
  const dLat = toRad(destinationLat - wineryLat);
  const dLng = toRad(destinationLng - wineryLng);
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(wineryLat)) * Math.cos(toRad(destinationLat)) * Math.sin(dLng / 2) ** 2;
  const routeDistanceKm = Math.round(earthKm * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)));
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
  const routeSpanX = Math.abs(wineryPoint.x - tapPoint.x);
  const routeSpanY = Math.abs(wineryPoint.y - tapPoint.y);
  const atlasViewWidth = clampMap(Math.max(210, routeSpanX * 3.8), 210, mapWidth);
  const atlasViewHeight = clampMap(Math.max(132, routeSpanY * 4.7), 132, mapHeight);
  const atlasCenterX = (wineryPoint.x + tapPoint.x) / 2;
  const atlasCenterY = (wineryPoint.y + tapPoint.y) / 2;
  const atlasViewX = clampMap(atlasCenterX - atlasViewWidth / 2, 0, mapWidth - atlasViewWidth);
  const atlasViewY = clampMap(atlasCenterY - atlasViewHeight / 2, 0, mapHeight - atlasViewHeight);
  const atlasViewBox = `${atlasViewX.toFixed(1)} ${atlasViewY.toFixed(1)} ${atlasViewWidth.toFixed(1)} ${atlasViewHeight.toFixed(1)}`;
  const atlasTileZoom = atlasViewWidth < 260 ?5 : atlasViewWidth < 520 ?4 : 3;
  const atlasTilesPerAxis = 2 ** atlasTileZoom;
  const atlasTileWidth = mapWidth / atlasTilesPerAxis;
  const atlasTileHeight = mapHeight / atlasTilesPerAxis;
  const atlasTileMinX = Math.floor(atlasViewX / atlasTileWidth) - 1;
  const atlasTileMaxX = Math.ceil((atlasViewX + atlasViewWidth) / atlasTileWidth) + 1;
  const atlasTileMinY = Math.max(0, Math.floor(atlasViewY / atlasTileHeight) - 1);
  const atlasTileMaxY = Math.min(atlasTilesPerAxis - 1, Math.ceil((atlasViewY + atlasViewHeight) / atlasTileHeight) + 1);
  const buildAtlasTileImages = (tileTemplate: string) => Array.from({ length: Math.max(0, atlasTileMaxY - atlasTileMinY + 1) }, (_, rowIndex) => atlasTileMinY + rowIndex)
    .flatMap((tileY) => Array.from({ length: Math.max(0, atlasTileMaxX - atlasTileMinX + 1) }, (_, colIndex) => atlasTileMinX + colIndex)
      .map((tileX) => {
        const wrappedX = ((tileX % atlasTilesPerAxis) + atlasTilesPerAxis) % atlasTilesPerAxis;
        const href = tileTemplate
          .replaceAll("{z}", String(atlasTileZoom))
          .replaceAll("{x}", String(wrappedX))
          .replaceAll("{y}", String(tileY));
        return `<image href="${htmlText(href)}" x="${(tileX * atlasTileWidth).toFixed(2)}" y="${(tileY * atlasTileHeight).toFixed(2)}" width="${atlasTileWidth.toFixed(2)}" height="${atlasTileHeight.toFixed(2)}" preserveAspectRatio="none"/>`;
      })).join("");
  const atlasTileImages = buildAtlasTileImages(rasterTileTemplate);
  const atlasLightTileImages = buildAtlasTileImages(lightRasterTileTemplate);
  const oldestTraceEvent = timeline[timeline.length - 1] || null;
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
  const traceStoryHtml = [
    {
      cls: "origin",
      label: labels.mapOriginStep,
      value: contract.provenance.origin || contract.iot.wineryLocation || labels.origin,
      detail: `${contract.product.name || "Producto"} · ${oldestTraceEvent?.at || contract.product.region || contract.product.winery || labels.winery}`,
    },
    {
      cls: "tap",
      label: labels.mapTapStep,
      value: `${contract.tapContext.city || newestTraceEvent?.city || "-"}, ${contract.tapContext.country || newestTraceEvent?.country || "-"}`,
      detail: `${contract.status.label} · ${newestTraceEvent?.at || contract.identity.eventId || "tap actual"}`,
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
    [labels.routeDistance, `${routeDistanceKm} km`],
    [labels.events, String(contract.provenance.timelineSummary.length)],
    [labels.statusLabel, contract.status.label],
    [labels.tokenIdLabel, contract.tokenization.tokenId || tokenizationStatusLabel],
  ].map(([label, value]) => `<div class="ledger-item" style="border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:8px;background:rgba(15,23,42,.36)"><span style="display:block;color:#9fb5d9;font-size:10px;text-transform:uppercase;letter-spacing:.08em">${htmlText(label)}</span><b style="display:block;margin-top:3px;font-size:12px;color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${htmlText(value)}</b></div>`).join("");
  const routeControlX = (wineryPoint.x + tapPoint.x) / 2;
  const routeControlY = Math.max(52, Math.min(wineryPoint.y, tapPoint.y) - Math.min(118, Math.max(58, routeDistanceKm / 62)));
  const atlasRoutePath = `M ${wineryPoint.x.toFixed(2)} ${wineryPoint.y.toFixed(2)} Q ${routeControlX.toFixed(2)} ${routeControlY.toFixed(2)} ${tapPoint.x.toFixed(2)} ${tapPoint.y.toFixed(2)}`;
  const atlasLights = [
    [-34.6, -58.4, 0.74],
    [-33.0, -68.8, 0.86],
    [-23.5, -46.6, 0.58],
    [19.4, -99.1, 0.58],
    [25.7, -80.2, 0.62],
    [40.7, -74.0, 0.62],
    [51.5, -0.1, 0.66],
    [48.8, 2.3, 0.58],
    [47.3, 8.5, 0.74],
    [35.6, 139.6, 0.54],
  ].map(([lat, lng, opacity], index) => {
    const p = projectWorld(Number(lat), Number(lng));
    return `<circle key="${index}" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.8" fill="#e0f2fe" opacity="${opacity}"/>`;
  }).join('');
  const compactMapLabel = (value: unknown, max = 24) => {
    const text = String(value ?? "-").trim() || "-";
    return text.length > max ?`${text.slice(0, Math.max(1, max - 3))}...` : text;
  };
  const atlasPanelWidth = clampMap(atlasViewWidth - 24, 142, 190);
  const atlasOriginPanelX = atlasViewX + 12;
  const atlasOriginPanelY = atlasViewY + atlasViewHeight - 54;
  const atlasTapPanelX = atlasViewX + atlasViewWidth - atlasPanelWidth - 12;
  const atlasTapPanelY = atlasViewY + 52;
  const atlasOriginSafeLabel = htmlText(compactMapLabel(contract.iot.wineryLocation || contract.provenance.origin || labels.origin));
  const atlasTapSafeLabel = htmlText(compactMapLabel([contract.tapContext.city, contract.tapContext.country].filter(Boolean).join(", ") || labels.tapLocation));
  const atlasSvg = `<svg class="world-route-overlay" viewBox="${atlasViewBox}" aria-hidden="true" data-map-source="${htmlText(mapSourceLabel)}"><defs><linearGradient id="sun-ocean" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="var(--sun-ocean-1,#06243c)"/><stop offset="52%" stop-color="var(--sun-ocean-2,#071827)"/><stop offset="100%" stop-color="var(--sun-ocean-3,#111136)"/></linearGradient><filter id="sun-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="${mapWidth}" height="${mapHeight}" fill="url(#sun-ocean)"/><g class="atlas-tiles atlas-tiles-dark">${atlasTileImages}</g><g class="atlas-tiles atlas-tiles-light">${atlasLightTileImages}</g><rect width="${mapWidth}" height="${mapHeight}" fill="var(--sun-tile-overlay,rgba(2,6,23,.16))"/><path d="M0 86 H1000 M0 158 H1000 M0 230 H1000 M0 302 H1000 M0 374 H1000 M116 0 V460 M248 0 V460 M500 0 V460 M752 0 V460 M884 0 V460" fill="none" stroke="var(--sun-grid-stroke,rgba(226,232,240,.055))" stroke-width="1" stroke-dasharray="8 14"/><g filter="url(#sun-glow)">${atlasLights}</g><circle cx="${wineryPoint.x.toFixed(2)}" cy="${wineryPoint.y.toFixed(2)}" r="54" fill="rgba(34,211,238,.16)"/><circle cx="${tapPoint.x.toFixed(2)}" cy="${tapPoint.y.toFixed(2)}" r="62" fill="rgba(249,115,22,.16)"/><path d="${atlasRoutePath}" fill="none" stroke="rgba(2,6,23,.82)" stroke-width="12" stroke-linecap="round"/><path d="${atlasRoutePath}" fill="none" stroke="#f97316" stroke-width="4.2" stroke-linecap="round" stroke-dasharray="10 12"><animate attributeName="stroke-dashoffset" values="0;-54" dur="3s" repeatCount="indefinite"/></path><circle r="5.5" fill="#facc15"><animateMotion dur="4.2s" repeatCount="indefinite" path="${atlasRoutePath}"/></circle><circle cx="${wineryPoint.x.toFixed(2)}" cy="${wineryPoint.y.toFixed(2)}" r="9" fill="#22d3ee" stroke="#ecfeff" stroke-width="2.4"/><circle cx="${tapPoint.x.toFixed(2)}" cy="${tapPoint.y.toFixed(2)}" r="10" fill="#f97316" stroke="#fff7ed" stroke-width="2.4"/><g transform="translate(${(atlasViewX + 12).toFixed(2)} ${(atlasViewY + 16).toFixed(2)})"><rect x="0" y="0" width="178" height="28" rx="14" fill="rgba(2,6,23,.74)" stroke="rgba(125,211,252,.32)"/><text x="14" y="18" fill="#cffafe" font-size="11" font-weight="800" letter-spacing="1.4">${htmlText(mapSourceLabel)}</text></g><text x="${(wineryPoint.x + 12).toFixed(2)}" y="${(wineryPoint.y - 13).toFixed(2)}" fill="#e0f2fe" font-size="18" font-weight="800" paint-order="stroke" stroke="rgba(2,6,23,.85)" stroke-width="4">${labels.origin}</text><text x="${(tapPoint.x + 12).toFixed(2)}" y="${(tapPoint.y - 13).toFixed(2)}" fill="#fed7aa" font-size="18" font-weight="800" paint-order="stroke" stroke="rgba(2,6,23,.85)" stroke-width="4">Tap</text><text x="${(atlasViewX + atlasViewWidth - 12).toFixed(2)}" y="${(atlasViewY + atlasViewHeight - 10).toFixed(2)}" text-anchor="end" fill="#cbd5e1" font-size="9" font-weight="700" opacity=".72" paint-order="stroke" stroke="rgba(2,6,23,.8)" stroke-width="3">${htmlText(mapAttribution)}</text></svg>`;
  const atlasSafePanels = `<g transform="translate(${atlasOriginPanelX.toFixed(2)} ${atlasOriginPanelY.toFixed(2)})"><rect x="0" y="0" width="${atlasPanelWidth.toFixed(2)}" height="42" rx="13" fill="rgba(2,6,23,.82)" stroke="rgba(34,211,238,.34)"/><text x="12" y="16" fill="#67e8f9" font-size="9" font-weight="900" letter-spacing="1.4">${htmlText(labels.origin)}</text><text x="12" y="31" fill="#f8fafc" font-size="13" font-weight="850">${atlasOriginSafeLabel}</text></g><g transform="translate(${atlasTapPanelX.toFixed(2)} ${atlasTapPanelY.toFixed(2)})"><rect x="0" y="0" width="${atlasPanelWidth.toFixed(2)}" height="42" rx="13" fill="rgba(2,6,23,.82)" stroke="rgba(249,115,22,.38)"/><text x="12" y="16" fill="#fed7aa" font-size="9" font-weight="900" letter-spacing="1.4">TAP</text><text x="12" y="31" fill="#f8fafc" font-size="13" font-weight="850">${atlasTapSafeLabel}</text></g>`;
  const responsiveAtlasSvg = atlasSvg.replace("</svg>", `${atlasSafePanels}</svg>`);
  const maskedBid = maskIdentityValue(contract.identity.bid);
  const maskedUid = contract.uidMasked;

  return `<!doctype html><html lang="${copy.lang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>NexID Product Passport</title>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/logo-mark.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-icon" />
  <style>body{margin:0;background:radial-gradient(circle at top,#0b1e47 0%,#020617 58%);color:#e2e8f0;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}.wrap{max-width:760px;margin:0 auto;padding:18px;padding-bottom:calc(18px + env(safe-area-inset-bottom))}.card{border:1px solid rgba(148,163,184,.22);border-radius:18px;background:linear-gradient(180deg,#0d1834 0%,#0a1228 100%);padding:16px;margin-top:12px;box-shadow:0 12px 36px rgba(2,6,23,.38)}.hero{padding:18px;background:linear-gradient(180deg,#0e1f43 0%,#09162f 100%);border:1px solid rgba(34,211,238,.22)}.hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.trust-sticky{position:sticky;top:8px;z-index:40;border:1px solid rgba(34,211,238,.35);background:rgba(8,16,36,.85);backdrop-filter:blur(8px);padding:10px 12px;border-radius:12px;margin-bottom:10px;font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}.trust-label{display:flex;align-items:center;gap:8px}.trust-dot{width:8px;height:8px;border-radius:999px;display:inline-block}.auth-card{border-color:rgba(34,211,238,.28);box-shadow:0 8px 28px rgba(34,211,238,.08)}.auth-topline{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc;margin-bottom:8px}.brand{display:flex;align-items:center;gap:10px;margin-bottom:8px}.brand-mark{width:36px;height:36px;border-radius:11px;background:linear-gradient(160deg,#05203d,#0b355f);border:1px solid rgba(125,211,252,.35);display:grid;place-items:center;font-weight:800;color:#e0f2fe;position:relative;overflow:hidden}.brand-ni{display:inline-flex;align-items:flex-end;gap:1px}.brand-ni .n-letter{font-size:16px;line-height:1}.brand-ni .i-stack{position:relative;display:inline-block;padding-top:2px}.brand-ni .i-stem{font-size:16px;line-height:1}.brand-ni .i-dot{position:absolute;top:-1px;left:50%;width:4px;height:4px;border-radius:999px;background:#7dd3fc;transform:translate(-50%,-50%);box-shadow:0 0 0 1px rgba(125,211,252,.22)}.brand-ni .i-orbit{position:absolute;top:-1px;left:50%;width:11px;height:7px;border:1px solid rgba(125,211,252,.5);border-radius:999px;transform:translate(-50%,-50%) rotate(-10deg)}.brand-text{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7dd3fc}.badge{display:inline-block;border-radius:999px;border:1px solid rgba(255,255,255,.25);padding:4px 10px;font-size:11px;font-weight:700;letter-spacing:.04em}.lang-switch{display:flex;gap:6px;margin-top:6px}.lang-switch a{text-decoration:none;font-size:10px;padding:3px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.4);color:#dbeafe}.lang-switch a.active{border-color:#22d3ee;color:#67e8f9;background:rgba(34,211,238,.12)}.hero h1{margin:10px 0 4px;font-size:clamp(1.7rem,6vw,2.1rem);line-height:1.08;letter-spacing:-.015em}.hero-meta{margin-top:6px;color:#b6c8e7;font-size:12px}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.chip{border:1px solid rgba(148,163,184,.35);border-radius:999px;padding:4px 10px;font-size:11px;color:#cbd5e1;background:rgba(2,6,23,.24)}.chip-soft{background:rgba(34,211,238,.08);border-color:rgba(34,211,238,.35)}.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.kpi{border:1px solid rgba(148,163,184,.28);border-radius:12px;padding:10px;background:rgba(2,6,23,.45);min-height:72px;display:flex;flex-direction:column;justify-content:center}.kpi b{display:block;font-size:14px}.kpi span{font-size:11px;color:#9fb5d9}.section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(148,163,184,.2)}.section-head h3{margin:0}.section-tag{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc;border:1px solid rgba(125,211,252,.35);padding:2px 8px;border-radius:999px}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.detail-item{border:1px solid rgba(148,163,184,.2);border-radius:12px;padding:9px 10px;background:rgba(15,23,42,.35)}.detail-item .k{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#93c5fd;margin-bottom:4px}.detail-item .v{font-size:14px;font-weight:700;color:#f8fafc}.world-map-wrap{margin-top:10px;border:1px solid rgba(148,163,184,.28);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#07142d 0%,#081b38 100%)}.world-map-canvas{position:relative;aspect-ratio:1000/460;background:#0b1e47}.world-map-image{display:block;width:100%;height:100%;object-fit:cover;filter:saturate(1.05) contrast(1.02)}.world-route-overlay{position:absolute;inset:0;width:100%;height:100%;--sun-ocean-1:#06243c;--sun-ocean-2:#071827;--sun-ocean-3:#111136;--sun-tile-overlay:rgba(2,6,23,.16);--sun-grid-stroke:rgba(226,232,240,.055)}.atlas-tiles-light{display:none}.world-map-legend{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;border-top:1px solid rgba(148,163,184,.22)}.legend-item{font-size:11px;color:#dbeafe;border:1px solid rgba(148,163,184,.28);border-radius:10px;padding:8px;background:rgba(15,23,42,.35)}.legend-dot{display:inline-block;width:8px;height:8px;border-radius:999px;margin-right:6px}.legend-origin{background:#22d3ee}.legend-tap{background:#f97316}.journey-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}.journey-step{border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:8px;background:rgba(15,23,42,.32)}.journey-step b{display:block;font-size:12px;margin-bottom:4px}.journey-step span{font-size:11px;color:#9fb5d9}details{margin-top:10px}button{border:1px solid rgba(148,163,184,.4);border-radius:10px;background:#071229;color:#dbeafe;padding:9px 8px;font-size:12px;font-weight:700;transition:transform .16s ease,background .2s ease,border-color .2s ease,box-shadow .2s ease}button:hover{transform:translateY(-1px);border-color:#38bdf8;background:#0b1f3f;box-shadow:0 8px 20px rgba(56,189,248,.18)}button:active{transform:scale(.98)}button:disabled{opacity:.45;cursor:not-allowed}.actions-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.link-btn{text-decoration:none;border:1px solid rgba(148,163,184,.32);border-radius:10px;padding:9px 8px;font-size:12px;font-weight:700;text-align:center;transition:transform .15s ease,filter .15s ease}.link-btn:hover{transform:translateY(-1px);filter:brightness(1.08)}.subtitle{margin:0;color:#9fb5d9;font-size:13px}.risk-meter{margin-top:12px}.risk-track{height:10px;border-radius:999px;background:rgba(148,163,184,.2);overflow:hidden}.risk-fill{height:100%;background:linear-gradient(90deg,#22c55e,#f59e0b,#ef4444);transition:width .6s ease}.pulse-ok{display:inline-block;animation:pulse 1.6s infinite}@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.45)}70%{box-shadow:0 0 0 12px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}@media (hover:hover){.card{transition:transform .2s ease,box-shadow .2s ease}.card:hover{transform:translateY(-1px);box-shadow:0 14px 34px rgba(2,6,23,.44)}}@media (max-width:720px){.kpis,.detail-grid,.actions-grid,.world-map-legend,.journey-steps{grid-template-columns:1fr}.hero-top{flex-direction:column;align-items:flex-start}.trust-sticky{padding:9px 10px}.trust-label{line-height:1.25}.kpi{min-height:64px}}@media (prefers-color-scheme: light){body{background:linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%);color:#0f172a}.card{background:#ffffff;border-color:#cbd5e1;box-shadow:0 8px 24px rgba(15,23,42,.08)}.hero{background:linear-gradient(180deg,#f8fbff 0%,#f1f5f9 100%)}.brand-mark{background:linear-gradient(160deg,#dff3ff,#bfdbfe);border-color:#93c5fd;color:#0f172a}.brand-text{color:#0369a1}.subtitle,.hero-meta{color:#334155}.chip{color:#334155;border-color:#cbd5e1;background:#f8fafc}.chip-soft{background:#ecfeff;border-color:#a5f3fc}.kpi{background:#f8fafc;border-color:#cbd5e1}.kpi span{color:#475569}.section-tag{color:#0369a1;border-color:#93c5fd}.detail-item,.journey-step{background:#f8fafc;border-color:#cbd5e1}.detail-item .k{color:#0369a1}.detail-item .v{color:#0f172a}.journey-step span{color:#475569}.world-map-wrap{background:linear-gradient(180deg,#f8fcff 0%,#dff4ff 100%);border-color:#93c5fd}.world-map-canvas{background:#eaf7ff}.world-route-overlay{--sun-ocean-1:#effaff;--sun-ocean-2:#e0f7ff;--sun-ocean-3:#eef4ff;--sun-tile-overlay:rgba(255,255,255,.28);--sun-grid-stroke:rgba(14,116,144,.1)}.atlas-tiles-dark{display:none}.atlas-tiles-light{display:block}.world-map-image{filter:saturate(.9) contrast(.92) brightness(1.08)}.legend-item{background:#f8fafc;border-color:#cbd5e1;color:#0f172a}button{background:#f8fafc;color:#0f172a}.link-btn{border-color:#cbd5e1}.lang-switch a{color:#0f172a;border-color:#cbd5e1}.lang-switch a.active{color:#075985}}@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}</style></head><body><main class="wrap">
  <div class="trust-sticky"><span class="trust-label"><span class="trust-dot" style="background:${authRibbonTone}"></span><b>${copy.authPanel}:</b> <span style="color:${authRibbonTone};font-weight:700">${contract.status.label}</span></span><span class="chip" style="margin-top:0;border-color:${riskTone};color:${riskTone};background:rgba(2,6,23,.36)">${riskLevelLabel}</span></div>
  <section class="card hero"><div class="hero-top"><div><div class="brand"><span class="brand-mark"><span class="brand-ni"><span class="n-letter">N</span><span class="i-stack"><span class="i-stem">i</span><span class="i-dot"></span><span class="i-orbit"></span></span></span></span><span class="brand-text">NexID Verified Tap</span></div><h1>${copy.title}</h1><p class="subtitle">${contract.status.summary}</p><p class="hero-meta">${labels.heroRoute} · ${labels.eventLabel} #${contract.identity.eventId || 'N/A'}</p><div class="lang-switch"><a href="${langUrl('es-AR')}" class="${locale === 'es-AR' ?'active' : ''}">ES</a><a href="${langUrl('pt-BR')}" class="${locale === 'pt-BR' ?'active' : ''}">PT</a><a href="${langUrl('en')}" class="${locale === 'en' ?'active' : ''}">EN</a></div></div><span class="badge" style="color:${tone};border-color:${tone}">${contract.status.label}</span></div><div class="chips"><span class="chip">BID ${maskedBid}</span><span class="chip">UID ${maskedUid}</span><span class="chip">Tap #${contract.identity.readCounter ?? 'N/A'}</span><span class="chip ${contract.status.code === "VALID" ?"pulse-ok" : ""}">${copy.quality} ${contract.quality.score}/100 · ${contract.quality.tier}</span></div><div class="risk-meter"><div class="risk-track"><div class="risk-fill" style="width:${contract.quality.score}%"></div></div></div><div class="kpis"><div class="kpi"><b>${contract.provenance.timelineSummary.length}</b><span>${labels.events}</span></div><div class="kpi"><b>${tokenizationStatusLabel}</b><span>${labels.tokenization}</span></div><div class="kpi"><b>${contract.tapContext.deviceType || "-"}</b><span>${labels.device}</span></div></div></section>
  <section class="card auth-card"><div class="auth-topline">Trust signal</div><h3 style="margin:0 0 6px">${copy.authPanel}</h3><p class="subtitle">${authPanelMessage}</p><div class="chips"><span class="chip">${commercialStateLabel}</span><span class="chip">${riskStateLabel}</span><span class="chip">${labels.dashboardSync}</span></div></section>
  <section class="card"><div class="section-head"><h3>${copy.identityPanel}</h3><span class="section-tag">${labels.wineProfile}</span></div><p><b>${contract.product.name || 'Unprofiled product'}</b></p><p>${contract.product.winery || '-'} · ${contract.product.region || '-'}</p><div class="detail-grid"><div class="detail-item"><span class="k">${labels.varietal}</span><span class="v">${contract.product.varietal || '-'}</span></div><div class="detail-item"><span class="k">${labels.vintage}</span><span class="v">${contract.product.vintage || '-'}</span></div><div class="detail-item"><span class="k">${labels.harvest}</span><span class="v">${contract.product.harvestYear || '-'}</span></div><div class="detail-item"><span class="k">${labels.barrel}</span><span class="v">${contract.product.barrelMonths || '-'} ${labels.months}</span></div><div class="detail-item"><span class="k">${labels.alcohol}</span><span class="v">${contract.product.alcohol || '-'}</span></div><div class="detail-item"><span class="k">${labels.serving}</span><span class="v">${contract.product.serving || '-'}</span></div></div><p style="margin-top:10px">${labels.bottleFormat}: <b>${contract.product.bottle || '-'}</b></p></section>
  <section class="card"><div class="section-head"><h3>${copy.provenancePanel}</h3><span class="section-tag">${labels.traceability}</span></div><p>${labels.origin}: <b>${contract.provenance.origin || contract.iot.wineryLocation || '-'}</b></p><p>${copy.firstVerified}: <b>${contract.provenance.firstVerified.at || 'N/A'} · ${contract.provenance.firstVerified.city || '-'}, ${contract.provenance.firstVerified.country || '-'}</b></p><p>${copy.lastVerified}: <b>${contract.provenance.lastVerifiedLocation.at || 'N/A'} · ${contract.provenance.lastVerifiedLocation.city || '-'}, ${contract.provenance.lastVerifiedLocation.country || '-'}</b></p></section>
  <section class="card"><div class="section-head"><h3>${copy.iotPanel}</h3><span class="section-tag">${labels.sensorIntelligence}</span></div><p>${labels.winery}: <b>${contract.iot.wineryLocation || 'N/A'}</b></p><p>${labels.altitude}: <b>${contract.iot.altitude || '-'}</b> · ${labels.oak}: <b>${contract.iot.oakType || '-'}</b></p><p>${labels.cellarTemp}: <b>${contract.iot.sensorSnapshot.cellarTemperature || '-'}</b> · ${labels.humidity}: <b>${contract.iot.sensorSnapshot.humidity || '-'}</b></p><p>${labels.light}: <b>${contract.iot.sensorSnapshot.lightExposure || '-'}</b> · ${labels.transit}: <b>${contract.iot.sensorSnapshot.transitShock || '-'}</b></p></section>
  <section class="card"><div class="section-head"><h3>${copy.tapPanel}</h3><span class="section-tag">${labels.geoContext}</span></div><p>${labels.os}: <b>${contract.tapContext.os}</b> · ${labels.browser}: <b>${contract.tapContext.browser}</b> · ${labels.device}: <b>${contract.tapContext.deviceType}</b></p><p>${labels.tapLocation}: <b>${contract.tapContext.city || '-'}, ${contract.tapContext.country || '-'}</b>${contract.tapContext.lat != null && contract.tapContext.lng != null ?` · (${contract.tapContext.lat}, ${contract.tapContext.lng})` : ''}</p><div class="detail-grid"><div class="detail-item"><span class="k">${labels.routeDistance}</span><span class="v">${routeDistanceKm} km</span></div><div class="detail-item"><span class="k">${labels.routeRegion}</span><span class="v">${contract.tapContext.city || '-'}, ${contract.tapContext.country || '-'}</span></div></div>
  <div class="world-map-wrap"><div class="world-map-canvas">${responsiveAtlasSvg}</div><div class="world-map-legend"><div class="legend-item"><span class="legend-dot legend-origin"></span><b>${labels.origin}</b><br/>${contract.iot.wineryLocation || "N/A"}</div><div class="legend-item"><span class="legend-dot legend-tap"></span><b>${labels.tapLocation}</b><br/>${contract.tapContext.city || "N/A"}, ${contract.tapContext.country || "N/A"}</div></div></div>
  <div class="trace-story" style="margin-top:10px;border:1px solid rgba(34,211,238,.22);border-radius:14px;padding:10px;background:linear-gradient(180deg,rgba(8,47,73,.44),rgba(15,23,42,.28))"><div class="trace-story-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px"><div><h4 style="margin:0;font-size:14px">${labels.mapStoryTitle}</h4><p style="margin:2px 0 0;color:#9fb5d9;font-size:11px">${labels.mapStorySubtitle}</p></div><span class="section-tag">${labels.mapLedgerTitle}</span></div><div class="story-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px">${traceStoryHtml}</div><div class="ledger-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px;margin-top:8px">${traceLedgerHtml}</div><p style="margin:9px 0 0;font-size:11px;color:#a7f3d0">${labels.mapInvestorSignal}: ${contract.provenance.timelineSummary.length} ${labels.events}, ${routeDistanceKm} km, ${htmlText(tokenProof)}. ${labels.mapConsumerSignal}: ${labels.linkPortal} + ${labels.linkRewards}.</p></div>
  <p style="margin:8px 0 0;font-size:11px;color:#94a3b8">${labels.routeSummary}: ${contract.iot.wineryLocation || labels.origin} → ${contract.tapContext.city || '-'}, ${contract.tapContext.country || '-'} · ${labels.mapLegend}.</p></section>
  <section class="card"><h3 style="margin:0 0 6px">${copy.timelinePanel}</h3><ul style="margin:0;padding-left:18px">${timelineHtml}</ul></section>
  <section class="card"><h3 style="margin:0 0 6px">${copy.tokenPanel}</h3><p>${labels.statusLabel}: <b>${contract.tokenization.status}</b> · ${labels.networkLabel}: <b>${contract.tokenization.network || '-'}</b></p><p>${labels.tokenIdLabel}: ${contract.tokenization.tokenId || '-'} · ${labels.txLabel}: ${contract.tokenization.txHash || '-'}</p></section>
  <section class="card"><div class="section-head"><h3>${copy.actionsPanel}</h3><span class="section-tag">${labels.consumerJourney}</span></div><p class="subtitle" style="margin-bottom:10px">${labels.actionSubtitle}</p><div class="journey-steps"><div class="journey-step"><b>${labels.journey1}</b><span>${labels.journey1Desc}</span></div><div class="journey-step"><b>${labels.journey2}</b><span>${labels.journey2Desc}</span></div><div class="journey-step"><b>${labels.journey3}</b><span>${labels.journey3Desc}</span></div></div><div class="actions-grid" style="margin-bottom:8px"><a href="${contract.cta.marketplaceUrl}" data-gated-link="marketplace" class="link-btn" style="color:#a5f3fc;background:rgba(6,182,212,.12)">🛍 ${labels.linkMarketplace} ${contract.cta.clubName}</a><a href="${contract.cta.rewardsUrl}" data-gated-link="rewards" class="link-btn" style="color:#ddd6fe;background:rgba(139,92,246,.12)">🎁 ${labels.linkRewards}</a><a href="${contract.cta.registerUrl}" data-gated-link="register" class="link-btn" style="color:#d1fae5;background:rgba(16,185,129,.12)">🧾 ${labels.linkRegister}</a><a href="${contract.cta.portalUrl}" data-gated-link="portal" class="link-btn" style="color:#dbeafe;background:rgba(59,130,246,.12)">👤 ${labels.linkPortal}</a></div><div class="actions-grid"><button type="button" data-cta="claim-ownership" ${contract.cta.claimOwnership ?"" : "disabled"}>✓ ${copy.ctaClaim}</button><button type="button" data-cta="register-warranty" ${contract.cta.registerWarranty ?"" : "disabled"}>🛡 ${copy.ctaWarranty}</button><button type="button" data-cta="provenance" ${contract.cta.provenance ?"" : "disabled"}>📍 ${copy.ctaProvenance}</button><button type="button" data-cta="tokenize-request" ${contract.cta.tokenize ?"" : "disabled"}>⛓ ${copy.ctaTokenize}</button></div><button id="nfc-scan" type="button" style="margin-top:8px;display:none">📲 Escanear con NFC</button><p id="cta-status" style="margin:10px 0 0;font-size:12px;color:#cbd5e1">${isRiskBlocked ?copy.statusReplay : copy.statusReady}</p><p style="margin:6px 0 0;font-size:11px;color:#94a3b8">${labels.tapHelp}</p>${shareToken ?"" : `<p style="margin:8px 0 0;font-size:11px;color:#fbbf24">${labels.demoMode}</p>`}</section>
<script>
(() => {
  const share = ${JSON.stringify(shareToken)};
  const bid = ${JSON.stringify(contract.identity.bid)};
  const uid = '';
  const copy = ${JSON.stringify(copy)};
  const labels = ${JSON.stringify(labels)};
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
  const eventId = ${JSON.stringify(contract.identity.eventId || null)};
  const canAssociate = ${JSON.stringify((contract.allowedActions as readonly string[]).includes("save") && contract.status.code !== "REPLAY_SUSPECT")};
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
          window.location.href = ${JSON.stringify(contract.cta.registerUrl)};
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
        button.textContent = labels.actionDone;
        if (statusNode) statusNode.textContent = action + ' ' + copy.actionOk;
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


async function dispatchValidScanWebhook(payload: Record<string, unknown>) {
  let url = process.env.SCAN_WEBHOOK_URL;
  if (!url) return;
  url = url.replace(/^['"]|['"]$/g, "").trim();
  const secret = (process.env.SCAN_WEBHOOK_SECRET || '').replace(/^['"]|['"]$/g, "").trim();
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ?{ 'x-nexid-signature': secret } : {}) },
    body: JSON.stringify(payload),
    cache: 'no-store',
  }).catch(() => null);
}

async function queueAutoTokenizationForValidTap(params: { bid: string; uid: string; traceId: string; eventId?: number | null }) {
  const enabled = String(process.env.SUN_AUTO_TOKENIZE_ON_VALID_TAP || "false").toLowerCase() === "true";
  if (!enabled) return null;

  await ensureTokenizationRequestsSchema();
  const row = (await sql/*sql*/`
    SELECT tr.id, tr.status, tr.network, tr.tx_hash, tr.token_id, tr.anchor_hash, tr.external_ref,
           tr.last_error, tr.next_attempt_at, tr.attempt_count
    FROM tokenization_requests tr
    WHERE tr.bid = ${params.bid}
      AND tr.uid_hex = ${params.uid}
      AND tr.status IN ('pending', 'processing', 'anchored', 'failed')
    ORDER BY tr.requested_at DESC
    LIMIT 1
  `)[0];
  if (row?.status === "anchored") {
    return {
      ok: true,
      deduplicated: true,
      status: "anchored",
      request_id: row.id,
      network: row.network || "polygon-amoy",
      tx_hash: row.tx_hash || null,
      token_id: row.token_id || null,
      anchor_hash: row.anchor_hash || null,
      external_ref: row.external_ref || null,
    };
  }
  if (row?.id) return await anchorTokenizationRequest({ requestId: String(row.id), processor: "sun_auto_tokenization" });

  const batch = (await sql/*sql*/`
    SELECT b.id, b.tenant_id
    FROM batches b
    WHERE b.bid = ${params.bid}
    LIMIT 1
  `)[0];

  const inserted = (await sql/*sql*/`
    INSERT INTO tokenization_requests (
      tenant_id, batch_id, bid, uid_hex, status, network, asset_ref, requested_by, next_attempt_at, meta
    ) VALUES (
      ${batch?.tenant_id || null},
      ${batch?.id || null},
      ${params.bid},
      ${params.uid},
      'pending',
      'polygon-amoy',
      ${`${params.bid}:${params.uid}`},
      'sun_auto_valid_tap',
      now(),
      ${JSON.stringify({ trace_id: params.traceId, event_id: params.eventId || null, source: "sun_valid_tap_auto_mint" })}::jsonb
    )
    RETURNING id
  `)[0];

  if (!inserted?.id) return null;
  return await anchorTokenizationRequest({ requestId: String(inserted.id), processor: "sun_auto_tokenization" });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const meta = getRequestMeta(req);
  const traceId = meta.traceId;
  const bid = url.searchParams.get('bid') || '';
  const picc_data = url.searchParams.get('picc_data') || '';
  const enc = url.searchParams.get('enc') || '';
  const cmac = url.searchParams.get('cmac') || '';
  const isQrScan = url.searchParams.get("qr") === "1" || String(url.searchParams.get("channel") || "").toLowerCase() === "qr";

  const ua = req.headers.get('user-agent') || '';
  const ip = meta.ip;
  const geoCity = safeDecode(req.headers.get('x-vercel-ip-city'));
  const geoCountry = req.headers.get('x-vercel-ip-country') || null;
  const geoLat = Number(req.headers.get('x-vercel-ip-latitude') || '');
  const geoLng = Number(req.headers.get('x-vercel-ip-longitude') || '');
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
  if (ipRate.limited || bidRate.limited || payloadRate.limited) {
    return json({ ok: false, reason: 'rate_limited' }, 429, { "x-nexid-trace-id": traceId, "x-request-id": traceId });
  }
  if (isQrScan) {
    return handleQrScan({ req, url, traceId, ip, userAgent: ua, geoCity, geoCountry, geoLat, geoLng });
  }
  if (!bid || !picc_data || !enc || !cmac) return json({ ok: false, reason: 'missing params', need: ['bid', 'picc_data', 'enc', 'cmac'] }, 400, { "x-nexid-trace-id": traceId, "x-request-id": traceId });
  if (!BID_RE.test(bid)) return json({ ok: false, reason: 'invalid bid format' }, 400, { "x-nexid-trace-id": traceId, "x-request-id": traceId });
  if (!HEX_RE.test(picc_data) || picc_data.length % 2 !== 0) return json({ ok: false, reason: 'invalid picc_data hex' }, 400, { "x-nexid-trace-id": traceId, "x-request-id": traceId });
  if (!HEX_RE.test(enc) || enc.length !== 32) return json({ ok: false, reason: 'invalid enc hex (expected 32 hex chars)' }, 400, { "x-nexid-trace-id": traceId, "x-request-id": traceId });
  if (!HEX_RE.test(cmac) || cmac.length !== 16) return json({ ok: false, reason: 'invalid cmac hex (expected 16 hex chars)' }, 400, { "x-nexid-trace-id": traceId, "x-request-id": traceId });

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
      lat: Number.isFinite(geoLat) ?geoLat : null,
      lng: Number.isFinite(geoLng) ?geoLng : null,
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
    result = { status: 200, body: { ok: false, reason: sanitizePublicErrorReason(internalReason) } };
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
    if (uidCtrRate.limited) {
      return json({ ok: false, reason: 'rate_limited' }, 429, { "x-nexid-trace-id": traceId, "x-request-id": traceId });
    }
  }
  const tagPassport = await withTimeout(getPassportSnapshot(bid, uid || undefined), 2500, "sun_passport_snapshot").catch(() => null);
  const batchContext = tagPassport
    ? null
    : await withTimeout(getBatchSunContext(bid), 2500, "sun_batch_context").catch(() => null);
  const passport = tagPassport || batchContext;
  const normalizedResult = normalizeDemoBodegaSunResult({
    bid,
    result,
    passport: passport as Record<string, unknown> | null,
  });
  if (normalizedResult !== result) {
    console.warn("[sun_demo_bodega_result_normalized]", JSON.stringify({
      traceId,
      bid,
      previousStatus: result.status,
      previousResult: result.body.result || null,
      previousReason: result.body.reason || null,
      eventId,
    }));
    result = normalizedResult as SunResult;
    uid = result.body.uid || uid;
    eventId = Number((result.body as { event_id?: number }).event_id || eventId || 0) || null;
    ctr = typeof result.body.ctr === 'number' ?result.body.ctr : ctr;
  }
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
    raw: { picc_data, enc, cmac },
    tap: {
      userAgent: ua,
      city: geoCity,
      country: geoCountry,
      lat: Number.isFinite(geoLat) ?geoLat : null,
      lng: Number.isFinite(geoLng) ?geoLng : null,
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
        lat: Number.isFinite(geoLat) ?geoLat : null,
        lng: Number.isFinite(geoLng) ?geoLng : null,
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

  if (result.body.ok) {
    void dispatchValidScanWebhook({ event: 'tag.scan.valid', bid, uid: result.body.uid, counter: result.body.ctr, ip, userAgent: ua, geoCity, geoCountry, geoLat: Number.isFinite(geoLat) ?geoLat : null, geoLng: Number.isFinite(geoLng) ?geoLng : null, ts: new Date().toISOString() });
  }

  const maskedUid = uid ?`${String(uid).slice(0, 4)}***${String(uid).slice(-4)}` : null;
  const verdict = String(contract.status.code || result.body.result || "UNKNOWN");
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
    request_json: { bid, picc_data, enc, cmac },
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
    uidHex: sunDiagnostics.uid_hex || null,
    readCounter: sunDiagnostics.read_counter ?? null,
    piccLayout: sunDiagnostics.picc_layout || null,
    selectedMacInput: sunDiagnostics.selected_mac_input || null,
    configuredMacInputModes: sunDiagnostics.configured_mac_input_modes || null,
    piccCandidateCount: sunDiagnostics.picc_candidate_count ?? null,
    cmacCandidateCount: sunDiagnostics.cmac_candidate_count ?? null,
    piccPlainHexPrefix: sunDiagnostics.picc_plain_hex_prefix || null,
    encPlainHexPrefix: sunDiagnostics.enc_plain_hex_prefix || null,
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

  if (wantsHtml(req, url)) {
    const freshHandoffToken = diagnosticId && contract.tapSecurity?.freshTap && !contract.tapSecurity?.replayDetected && eventId
      ?(() => {
          try {
            const now = Math.floor(Date.now() / 1000);
            return createSunFreshHandoffToken({
              bid,
              eventId: String(eventId),
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
    const webTarget = wantsInlineApiHtml(url) ?null : buildWebSunSnapshotUrl(url, diagnosticId, traceId, locale, freshHandoffToken);
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
