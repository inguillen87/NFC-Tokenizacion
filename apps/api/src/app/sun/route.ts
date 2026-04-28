export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json } from '../../lib/http';
import { processSunScan } from '../../lib/sun-service';
import { createDemoShareToken } from '../../lib/demo-share';
import { sql } from '../../lib/db';
import { anchorTokenizationRequest } from '../../lib/tokenization-engine';
import { buildLifecycleState, listDemoCta } from '../../lib/demo-cta';
import { insertSunDiagnostic } from '../../lib/sun-diagnostics';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.SUN_RATE_LIMIT_PER_MIN || 120);
const rateMap = new Map<string, { count: number; start: number }>();
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const HEX_RE = /^[0-9A-F]+$/i;

const SUN_PIPELINE_TIMEOUT_MS = Number(process.env.SUN_PIPELINE_TIMEOUT_MS || 8000);

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
  | "INVALID"
  | "UNKNOWN_BATCH"
  | "NOT_REGISTERED"
  | "NOT_ACTIVE";

type PassportSnapshot = {
  product_name: string | null;
  sku: string | null;
  winery: string | null;
  region: string | null;
  grape_varietal: string | null;
  vintage: string | null;
  harvest_year: number | null;
  barrel_months: number | null;
  temperature_storage: string | null;
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

function isRateLimited(ip: string | null) {
  if (!ip) return false;
  const now = Date.now();
  const current = rateMap.get(ip);
  if (!current || now - current.start > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(ip, { count: 1, start: now });
    return false;
  }
  current.count += 1;
  rateMap.set(ip, current);
  return current.count > RATE_LIMIT_MAX;
}

function wantsHtml(req: Request, url: URL) {
  const force = (url.searchParams.get('view') || '').toLowerCase();
  if (force === 'json') return false;
  if (force === 'html') return true;
  return (req.headers.get('accept') || '').toLowerCase().includes('text/html');
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

function buildTroubleshooting(reason: string, bid: string) {
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
  if (normalized.includes('cmac') || normalized.includes('invalid')) return ['Posible desalineación de llaves SUN del lote.', 'Verificá K_META/K_FILE del batch.', 'Usá URL generada por tap NFC real.'];
  return ['Revisá onboarding del batch.', 'Confirmá UID importado/activo.', 'Auditar eventos y llaves en dashboard.'];
}

function resolveTrustState(status: string, reason: string, productState?: string | null) {
  const normalizedStatus = status.toUpperCase();
  const normalizedReason = reason.toLowerCase();
  const normalizedProductState = String(productState || "").toUpperCase();
  if (normalizedStatus === 'REPLAY_SUSPECT' || normalizedReason.includes('replay')) {
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
    return { code: 'VALID_UNKNOWN_TAMPER', label: 'Autenticidad confirmada', summary: 'Producto auténtico. Estado de apertura no disponible para este lote.', tone: 'good' as const };
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
    ? "iOS"
    : normalized.includes("android")
      ? "Android"
      : normalized.includes("windows")
        ? "Windows"
        : normalized.includes("mac os") || normalized.includes("macintosh")
          ? "macOS"
          : "Unknown OS";
  const browser = normalized.includes("edg/")
    ? "Edge"
    : normalized.includes("samsungbrowser")
      ? "Samsung Internet"
      : normalized.includes("chrome/")
        ? "Chrome"
        : normalized.includes("safari/")
          ? "Safari"
          : normalized.includes("firefox/")
            ? "Firefox"
            : "Unknown Browser";
  const device = normalized.includes("mobile") || normalized.includes("iphone") || normalized.includes("android")
    ? "Mobile"
    : normalized.includes("ipad") || normalized.includes("tablet")
      ? "Tablet"
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

async function getPassportSnapshot(bid: string, uid: string | undefined): Promise<PassportSnapshot> {
  if (!uid) return null;
  const rows = await sql/*sql*/`
    SELECT
      tp.product_name,
      tp.sku,
      tp.winery,
      tp.region,
      tp.grape_varietal,
      tp.vintage,
      tp.harvest_year,
      tp.barrel_months,
      tp.temperature_storage,
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
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    LEFT JOIN LATERAL (
      SELECT created_at, city, country_code
      FROM events e
      WHERE e.batch_id = t.batch_id AND e.uid_hex = t.uid_hex
      ORDER BY created_at ASC
      LIMIT 1
    ) first_evt ON TRUE
    LEFT JOIN LATERAL (
      SELECT created_at, city, country_code, result
      FROM events e
      WHERE e.batch_id = t.batch_id AND e.uid_hex = t.uid_hex
      ORDER BY created_at DESC
      LIMIT 1
    ) last_evt ON TRUE
    LEFT JOIN LATERAL (
      SELECT status, network, tx_hash, token_id
      FROM tokenization_requests tr
      WHERE tr.batch_id = t.batch_id AND tr.uid_hex = t.uid_hex
      ORDER BY requested_at DESC
      LIMIT 1
    ) tok ON TRUE
    WHERE b.bid = ${bid} AND t.uid_hex = ${uid}
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
    WHERE b.bid = ${bid} AND e.uid_hex = ${uid}
    ORDER BY e.created_at DESC
    LIMIT 6
  `;
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const meta = (row.meta && typeof row.meta === "object") ? row.meta as Record<string, unknown> : {};
    const sensors = (meta.sensors && typeof meta.sensors === "object") ? meta.sensors as Record<string, unknown> : {};
    return {
      at: row.at ? String(row.at) : null,
      result: row.result ? String(row.result) : null,
      city: row.city ? String(row.city) : null,
      country: row.country ? String(row.country) : null,
      device: row.device ? String(row.device) : null,
      lat: typeof row.lat === "number" ? Number(row.lat) : null,
      lng: typeof row.lng === "number" ? Number(row.lng) : null,
      sensorTempC: typeof sensors.temperatureC === "number" ? Number(sensors.temperatureC) : null,
      sensorHumidity: typeof sensors.humidityPct === "number" ? Number(sensors.humidityPct) : null,
      stage: typeof sensors.stage === "string" ? String(sensors.stage) : null,
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

function buildDemoSensorHistory(timeline: TimelineEvent[], fallbackStorage: string | null, barrelMonths: number | null) {
  const baselineTemp = Number((fallbackStorage || "").replace(/[^\d.]/g, "")) || 16;
  const baselineHumidity = 68;
  const stages = ["cellar", "distribution", "retail", "consumer"];
  if (timeline.length) {
    return timeline.map((event, index) => ({
      at: event.at,
      stage: event.stage || stages[Math.min(index, stages.length - 1)],
      temperatureC: event.sensorTempC ?? Number((baselineTemp + Math.sin(index + 1) * 0.8).toFixed(1)),
      humidityPct: event.sensorHumidity ?? Number((baselineHumidity + Math.cos(index + 1) * 2.2).toFixed(0)),
      barrelAgeMonths: barrelMonths,
      alert: (event.result || "").toLowerCase().includes("replay") ? "Payload replay detectado" : null,
    }));
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
  const status = params.result.result || (params.result.ok ? 'VALID' : 'INVALID');
  const reason = params.result.reason || 'sin_observaciones';
  const trust = resolveTrustState(status, reason, params.result.product_state || null);
  const troubleshooting = buildTroubleshooting(reason, params.bid);
  const preset = BID_PASSPORT_PRESETS[params.bid];
  const fallbackName = preset?.name || `NexID Verified Asset · ${params.bid}`;
  const fallbackWinery = preset?.winery || "Verified winery";
  const fallbackRegion = preset?.region || "Origin region";
  const fallbackVarietal = preset?.varietal || "Varietal pending";
  const fallbackVintage = preset?.vintage || new Date().getUTCFullYear().toString();
  const fallbackHarvestYear = preset?.harvestYear || null;
  const fallbackBarrelMonths = preset?.barrelMonths || null;
  const fallbackStorage = preset?.storage || null;
  const fallbackAlcohol = preset?.alcohol || null;
  const fallbackBottle = preset?.bottle || null;
  const fallbackServing = preset?.serving || null;
  const tenantSlug = preset?.tenantSlug || "demobodega";
  const webBase = process.env.NEXT_PUBLIC_WEB_URL || "https://nexid.lat";
  const eventId = (params.result as { event_id?: string | number | null }).event_id ? String((params.result as { event_id?: string | number | null }).event_id) : null;
  const tapQuery = new URLSearchParams({
    tenant: tenantSlug,
    fromTap: "1",
  });
  if (eventId) tapQuery.set("eventId", eventId);
  const wineryLocation = preset?.wineryLocation || null;
  const sensorHistory = buildDemoSensorHistory(params.timeline, fallbackStorage, params.passport?.barrel_months || fallbackBarrelMonths);
  const avgTemp = sensorHistory.length ? (sensorHistory.reduce((acc, item) => acc + (item.temperatureC || 0), 0) / sensorHistory.length) : null;
  const avgHumidity = sensorHistory.length ? (sensorHistory.reduce((acc, item) => acc + (item.humidityPct || 0), 0) / sensorHistory.length) : null;
  const timelineLatest = params.timeline[0] || null;
  const timelineOldest = params.timeline[params.timeline.length - 1] || null;
  const ua = summarizeUserAgent(params.tap.userAgent);
  const trustPenalty = trust.code === "VALID" ? 0 : trust.code === "REPLAY_SUSPECT" ? 35 : 20;
  const sensorPenalty = sensorHistory.some((item) => item.alert) ? 10 : 0;
  const qualityScore = Math.max(0, Math.min(100, 92 - trustPenalty - sensorPenalty));

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
    },
    identity: {
      bid: params.bid,
      uid: params.uid,
      readCounter: params.ctr,
      eventId,
      tagStatus: params.passport?.tag_status || null,
      scanCount: params.passport?.scan_count || 0,
      tenantSlug,
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
    iot: {
      wineryLocation,
      wineryCoordinates: preset?.wineryCoordinates || null,
      altitude: preset?.altitude || null,
      oakType: preset?.oakType || null,
      sensorSnapshot: {
        cellarTemperature: avgTemp != null ? `${avgTemp.toFixed(1)}°C` : null,
        humidity: avgHumidity != null ? `${avgHumidity.toFixed(0)}%` : null,
        lightExposure: "Low / protected",
        transitShock: sensorHistory.some((item) => item.alert) ? "Potential handling alert detected" : "No critical shocks detected",
      },
      sensorHistory,
    },
    tapContext: {
      os: ua.os,
      browser: ua.browser,
      deviceType: ua.device,
      userAgent: params.tap.userAgent || null,
      city: params.tap.city,
      country: params.tap.country,
      lat: roundCoord(params.tap.lat, 2),
      lng: roundCoord(params.tap.lng, 2),
    },
    quality: {
      score: qualityScore,
      tier: qualityScore >= 85 ? "Premium" : qualityScore >= 65 ? "Monitored" : "At Risk",
    },
    cta: {
      claimOwnership: Boolean(params.uid),
      registerWarranty: Boolean(params.uid),
      provenance: Boolean(params.uid),
      tokenize: Boolean(params.uid),
      clubName: preset?.clubName || "Club premium",
      registerUrl: `${webBase}/me?${tapQuery.toString()}&action=register`,
      portalUrl: `${webBase}/me?${tapQuery.toString()}&action=portal`,
      marketplaceUrl: `${webBase}/me/marketplace?${tapQuery.toString()}&action=marketplace`,
      rewardsUrl: `${webBase}/me/rewards?${tapQuery.toString()}&action=rewards`,
    },
    troubleshooting,
    technical: {
      raw: {
        piccDataPrefix: `${params.raw.picc_data.slice(0, 12)}...`,
        encPrefix: `${params.raw.enc.slice(0, 12)}...`,
        cmacPrefix: `${params.raw.cmac.slice(0, 8)}...`,
      },
    },
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
    ? {
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
    }
    : locale === "en"
      ? {
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
      }
      : {
        manualOpened: "Producto auténtico. Sello marcado como abierto por operador.",
        opened: "Producto auténtico, pero el sello fue abierto.",
        openedPreviously: "Autenticidad confirmada. El sello fue abierto anteriormente.",
        unknownTamper: "Autenticidad confirmada. Estado de apertura no disponible para este lote.",
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
      };
  const tone = contract.status.tone === 'good' ? '#22c55e' : contract.status.tone === 'risk' ? '#ef4444' : '#f59e0b';
  const isReplay = contract.status.code === "REPLAY_SUSPECT";
  const productState = String(contract.status.productState || "").toUpperCase();
  const authPanelMessage = isReplay
    ? copy.authReplay
    : productState === "VALID_MANUAL_OPENED" || contract.status.code === "MANUAL_OPENED"
      ? labels.manualOpened
      : productState === "VALID_OPENED" || contract.status.code === "OPENED"
      ? labels.opened
      : productState === "VALID_OPENED_PREVIOUSLY" || contract.status.code === "OPENED_PREVIOUSLY"
        ? labels.openedPreviously
      : productState === "VALID_UNKNOWN_TAMPER"
        ? labels.unknownTamper
        : copy.authOk;
  const commercialStateLabel = isReplay
    ? `${labels.commercialState}: ${labels.hold}`
    : productState === "VALID_MANUAL_OPENED" || contract.status.code === "MANUAL_OPENED"
      ? `${labels.commercialState}: DEMO_OPENED`
      : productState === "VALID_OPENED" || contract.status.code === "OPENED"
      ? `${labels.commercialState}: ${labels.review}`
      : productState === "VALID_OPENED_PREVIOUSLY" || contract.status.code === "OPENED_PREVIOUSLY"
        ? `${labels.commercialState}: ${labels.reviewPrev}`
      : `${labels.commercialState}: ${labels.ok}`;
  const riskStateLabel = isReplay
    ? `${labels.risk}: ${labels.riskReplay}`
    : productState === "VALID_MANUAL_OPENED" || contract.status.code === "MANUAL_OPENED"
      ? `${labels.risk}: ${labels.riskManual}`
      : productState === "VALID_OPENED" || contract.status.code === "OPENED"
      ? `${labels.risk}: ${labels.riskTamper}`
      : productState === "VALID_OPENED_PREVIOUSLY" || contract.status.code === "OPENED_PREVIOUSLY"
        ? `${labels.risk}: ${labels.riskPrev}`
      : `${labels.risk}: ${labels.riskControlled}`;
  const timeline = contract.provenance.timelineSummary;
  const timelineHtml = timeline.length
    ? timeline.map((item) => `<li>${item.at || 'N/A'} · <b>${item.result || '-'}</b> · ${item.city || '-'}, ${item.country || '-'}</li>`).join('')
    : `<li>${copy.timelineEmpty}</li>`;
  const tapLat = contract.tapContext.lat;
  const tapLng = contract.tapContext.lng;
  const wineryLat = contract.iot.wineryCoordinates?.lat ?? tapLat ?? -33.0086;
  const wineryLng = contract.iot.wineryCoordinates?.lng ?? tapLng ?? -68.7794;
  const destinationLat = tapLat ?? wineryLat;
  const destinationLng = tapLng ?? wineryLng;
  const projectWorld = (lat: number, lng: number) => ({
    x: ((lng + 180) / 360) * 1000,
    y: ((90 - lat) / 180) * 460,
  });
  const wineryPoint = projectWorld(wineryLat, wineryLng);
  const tapPoint = projectWorld(destinationLat, destinationLng);
  const toRad = (v: number) => v * (Math.PI / 180);
  const earthKm = 6371;
  const dLat = toRad(destinationLat - wineryLat);
  const dLng = toRad(destinationLng - wineryLng);
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(wineryLat)) * Math.cos(toRad(destinationLat)) * Math.sin(dLng / 2) ** 2;
  const routeDistanceKm = Math.round(earthKm * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)));
  const maskedBid = maskIdentityValue(contract.identity.bid);
  const maskedUid = maskIdentityValue(contract.identity.uid || "");

  return `<!doctype html><html lang="${copy.lang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>NexID Product Passport</title>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/logo-mark.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-icon" />
  <style>body{margin:0;background:radial-gradient(circle at top,#0b1e47 0%,#020617 58%);color:#e2e8f0;font-family:Inter,system-ui,sans-serif}.wrap{max-width:760px;margin:0 auto;padding:18px}.card{border:1px solid rgba(148,163,184,.22);border-radius:18px;background:linear-gradient(180deg,#0d1834 0%,#0a1228 100%);padding:16px;margin-top:12px;box-shadow:0 12px 36px rgba(2,6,23,.38)}.hero{padding:18px;background:linear-gradient(180deg,#0e1f43 0%,#09162f 100%)}.hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.brand{display:flex;align-items:center;gap:10px;margin-bottom:8px}.brand-mark{width:36px;height:36px;border-radius:11px;background:linear-gradient(160deg,#05203d,#0b355f);border:1px solid rgba(125,211,252,.35);display:grid;place-items:center;font-weight:800;color:#e0f2fe;position:relative;overflow:hidden}.brand-ni{display:inline-flex;align-items:flex-end;gap:1px}.brand-ni .n-letter{font-size:16px;line-height:1}.brand-ni .i-stack{position:relative;display:inline-block;padding-top:2px}.brand-ni .i-stem{font-size:16px;line-height:1}.brand-ni .i-dot{position:absolute;top:-1px;left:50%;width:4px;height:4px;border-radius:999px;background:#7dd3fc;transform:translate(-50%,-50%);box-shadow:0 0 0 1px rgba(125,211,252,.22)}.brand-ni .i-orbit{position:absolute;top:-1px;left:50%;width:11px;height:7px;border:1px solid rgba(125,211,252,.5);border-radius:999px;transform:translate(-50%,-50%) rotate(-10deg)}.brand-text{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7dd3fc}.badge{display:inline-block;border-radius:999px;border:1px solid rgba(255,255,255,.25);padding:4px 10px;font-size:11px;font-weight:700;letter-spacing:.04em}.lang-switch{display:flex;gap:6px;margin-top:6px}.lang-switch a{text-decoration:none;font-size:10px;padding:3px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.4);color:#dbeafe}.lang-switch a.active{border-color:#22d3ee;color:#67e8f9;background:rgba(34,211,238,.12)}.hero h1{margin:10px 0 4px;font-size:31px;line-height:1.08;letter-spacing:-.015em}.hero-meta{margin-top:6px;color:#b6c8e7;font-size:12px}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.chip{border:1px solid rgba(148,163,184,.35);border-radius:999px;padding:4px 10px;font-size:11px;color:#cbd5e1;background:rgba(2,6,23,.24)}.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.kpi{border:1px solid rgba(148,163,184,.28);border-radius:12px;padding:8px;background:rgba(2,6,23,.45)}.kpi b{display:block;font-size:13px}.kpi span{font-size:11px;color:#9fb5d9}.section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.section-head h3{margin:0}.section-tag{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc;border:1px solid rgba(125,211,252,.35);padding:2px 8px;border-radius:999px}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.detail-item{border:1px solid rgba(148,163,184,.2);border-radius:12px;padding:9px 10px;background:rgba(15,23,42,.35)}.detail-item .k{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#93c5fd;margin-bottom:4px}.detail-item .v{font-size:14px;font-weight:700;color:#f8fafc}.world-map-wrap{margin-top:10px;border:1px solid rgba(148,163,184,.28);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#07142d 0%,#081b38 100%)}.world-map-canvas{position:relative;aspect-ratio:1000/460;background:#0b1e47}.world-map-image{display:block;width:100%;height:100%;object-fit:cover;filter:saturate(1.05) contrast(1.02)}.world-route-overlay{position:absolute;inset:0;width:100%;height:100%}.world-map-legend{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;border-top:1px solid rgba(148,163,184,.22)}.legend-item{font-size:11px;color:#dbeafe;border:1px solid rgba(148,163,184,.28);border-radius:10px;padding:8px;background:rgba(15,23,42,.35)}.legend-dot{display:inline-block;width:8px;height:8px;border-radius:999px;margin-right:6px}.legend-origin{background:#22d3ee}.legend-tap{background:#f97316}.journey-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}.journey-step{border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:8px;background:rgba(15,23,42,.32)}.journey-step b{display:block;font-size:12px;margin-bottom:4px}.journey-step span{font-size:11px;color:#9fb5d9}details{margin-top:10px}button{border:1px solid rgba(148,163,184,.4);border-radius:10px;background:#071229;color:#dbeafe;padding:9px 8px;font-size:12px;font-weight:700;transition:transform .16s ease,background .2s ease,border-color .2s ease,box-shadow .2s ease}button:hover{transform:translateY(-1px);border-color:#38bdf8;background:#0b1f3f;box-shadow:0 8px 20px rgba(56,189,248,.18)}button:active{transform:scale(.98)}button:disabled{opacity:.45;cursor:not-allowed}.actions-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.link-btn{text-decoration:none;border:1px solid rgba(148,163,184,.32);border-radius:10px;padding:9px 8px;font-size:12px;font-weight:700;text-align:center;transition:transform .15s ease,filter .15s ease}.link-btn:hover{transform:translateY(-1px);filter:brightness(1.08)}.subtitle{margin:0;color:#9fb5d9;font-size:13px}.risk-meter{margin-top:12px}.risk-track{height:10px;border-radius:999px;background:rgba(148,163,184,.2);overflow:hidden}.risk-fill{height:100%;background:linear-gradient(90deg,#22c55e,#f59e0b,#ef4444);transition:width .6s ease}.pulse-ok{display:inline-block;animation:pulse 1.6s infinite}@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.45)}70%{box-shadow:0 0 0 12px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}@media (max-width:720px){.kpis,.detail-grid,.actions-grid,.world-map-legend,.journey-steps{grid-template-columns:1fr}.hero-top{flex-direction:column;align-items:flex-start}}@media (prefers-color-scheme: light){body{background:linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%);color:#0f172a}.card{background:#ffffff;border-color:#cbd5e1;box-shadow:0 8px 24px rgba(15,23,42,.08)}.hero{background:linear-gradient(180deg,#f8fbff 0%,#f1f5f9 100%)}.brand-mark{background:linear-gradient(160deg,#dff3ff,#bfdbfe);border-color:#93c5fd;color:#0f172a}.brand-text{color:#0369a1}.subtitle,.hero-meta{color:#334155}.chip{color:#334155;border-color:#cbd5e1;background:#f8fafc}.kpi{background:#f8fafc;border-color:#cbd5e1}.kpi span{color:#475569}.section-tag{color:#0369a1;border-color:#93c5fd}.detail-item,.journey-step{background:#f8fafc;border-color:#cbd5e1}.detail-item .k{color:#0369a1}.detail-item .v{color:#0f172a}.journey-step span{color:#475569}.world-map-wrap{background:linear-gradient(180deg,#dbeafe 0%,#bfdbfe 100%);border-color:#93c5fd}.world-map-canvas{background:#dbeafe}.world-map-image{filter:saturate(1) contrast(1)}.legend-item{background:#f8fafc;border-color:#cbd5e1;color:#0f172a}button{background:#f8fafc;color:#0f172a}.link-btn{border-color:#cbd5e1}.lang-switch a{color:#0f172a;border-color:#cbd5e1}.lang-switch a.active{color:#075985}}@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}</style></head><body><main class="wrap">
  <section class="card hero"><div class="hero-top"><div><div class="brand"><span class="brand-mark"><span class="brand-ni"><span class="n-letter">N</span><span class="i-stack"><span class="i-stem">i</span><span class="i-dot"></span><span class="i-orbit"></span></span></span></span><span class="brand-text">NexID Verified Tap</span></div><h1>${copy.title}</h1><p class="subtitle">${contract.status.summary}</p><p class="hero-meta">${labels.heroRoute} · ${labels.eventLabel} #${contract.identity.eventId || 'N/A'}</p><div class="lang-switch"><a href="${langUrl('es-AR')}" class="${locale === 'es-AR' ? 'active' : ''}">ES</a><a href="${langUrl('pt-BR')}" class="${locale === 'pt-BR' ? 'active' : ''}">PT</a><a href="${langUrl('en')}" class="${locale === 'en' ? 'active' : ''}">EN</a></div></div><span class="badge" style="color:${tone};border-color:${tone}">${contract.status.label}</span></div><div class="chips"><span class="chip">BID ${maskedBid}</span><span class="chip">UID ${maskedUid}</span><span class="chip">Tap #${contract.identity.readCounter ?? 'N/A'}</span><span class="chip ${contract.status.code === "VALID" ? "pulse-ok" : ""}">${copy.quality} ${contract.quality.score}/100 · ${contract.quality.tier}</span></div><div class="risk-meter"><div class="risk-track"><div class="risk-fill" style="width:${contract.quality.score}%"></div></div></div><div class="kpis"><div class="kpi"><b>${contract.provenance.timelineSummary.length}</b><span>${labels.events}</span></div><div class="kpi"><b>${contract.tokenization.status || "-"}</b><span>${labels.tokenization}</span></div><div class="kpi"><b>${contract.tapContext.deviceType || "-"}</b><span>${labels.device}</span></div></div></section>
  <section class="card"><h3 style="margin:0 0 6px">${copy.authPanel}</h3><p class="subtitle">${authPanelMessage}</p><div class="chips"><span class="chip">${commercialStateLabel}</span><span class="chip">${riskStateLabel}</span><span class="chip">${labels.dashboardSync}</span></div></section>
  <section class="card"><div class="section-head"><h3>${copy.identityPanel}</h3><span class="section-tag">${labels.wineProfile}</span></div><p><b>${contract.product.name || 'Unprofiled product'}</b></p><p>${contract.product.winery || '-'} · ${contract.product.region || '-'}</p><div class="detail-grid"><div class="detail-item"><span class="k">${labels.varietal}</span><span class="v">${contract.product.varietal || '-'}</span></div><div class="detail-item"><span class="k">${labels.vintage}</span><span class="v">${contract.product.vintage || '-'}</span></div><div class="detail-item"><span class="k">${labels.harvest}</span><span class="v">${contract.product.harvestYear || '-'}</span></div><div class="detail-item"><span class="k">${labels.barrel}</span><span class="v">${contract.product.barrelMonths || '-'} ${labels.months}</span></div><div class="detail-item"><span class="k">${labels.alcohol}</span><span class="v">${contract.product.alcohol || '-'}</span></div><div class="detail-item"><span class="k">${labels.serving}</span><span class="v">${contract.product.serving || '-'}</span></div></div><p style="margin-top:10px">${labels.bottleFormat}: <b>${contract.product.bottle || '-'}</b></p></section>
  <section class="card"><div class="section-head"><h3>${copy.provenancePanel}</h3><span class="section-tag">${labels.traceability}</span></div><p>${labels.origin}: <b>${contract.provenance.origin || contract.iot.wineryLocation || '-'}</b></p><p>${copy.firstVerified}: <b>${contract.provenance.firstVerified.at || 'N/A'} · ${contract.provenance.firstVerified.city || '-'}, ${contract.provenance.firstVerified.country || '-'}</b></p><p>${copy.lastVerified}: <b>${contract.provenance.lastVerifiedLocation.at || 'N/A'} · ${contract.provenance.lastVerifiedLocation.city || '-'}, ${contract.provenance.lastVerifiedLocation.country || '-'}</b></p></section>
  <section class="card"><div class="section-head"><h3>${copy.iotPanel}</h3><span class="section-tag">${labels.sensorIntelligence}</span></div><p>${labels.winery}: <b>${contract.iot.wineryLocation || 'N/A'}</b></p><p>${labels.altitude}: <b>${contract.iot.altitude || '-'}</b> · ${labels.oak}: <b>${contract.iot.oakType || '-'}</b></p><p>${labels.cellarTemp}: <b>${contract.iot.sensorSnapshot.cellarTemperature || '-'}</b> · ${labels.humidity}: <b>${contract.iot.sensorSnapshot.humidity || '-'}</b></p><p>${labels.light}: <b>${contract.iot.sensorSnapshot.lightExposure || '-'}</b> · ${labels.transit}: <b>${contract.iot.sensorSnapshot.transitShock || '-'}</b></p></section>
  <section class="card"><div class="section-head"><h3>${copy.tapPanel}</h3><span class="section-tag">${labels.geoContext}</span></div><p>${labels.os}: <b>${contract.tapContext.os}</b> · ${labels.browser}: <b>${contract.tapContext.browser}</b> · ${labels.device}: <b>${contract.tapContext.deviceType}</b></p><p>${labels.tapLocation}: <b>${contract.tapContext.city || '-'}, ${contract.tapContext.country || '-'}</b>${contract.tapContext.lat != null && contract.tapContext.lng != null ? ` · (${contract.tapContext.lat}, ${contract.tapContext.lng})` : ''}</p><p style="font-size:11px;color:#94a3b8">User-Agent: ${contract.tapContext.userAgent || '-'}</p><div class="detail-grid"><div class="detail-item"><span class="k">${labels.routeDistance}</span><span class="v">${routeDistanceKm} km</span></div><div class="detail-item"><span class="k">${labels.routeRegion}</span><span class="v">${contract.tapContext.city || '-'}, ${contract.tapContext.country || '-'}</span></div></div>
  <div class="world-map-wrap"><div class="world-map-canvas"><img class="world-map-image" alt="${labels.mapGlobalTitle}" src="https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg" loading="lazy"/><svg class="world-route-overlay" viewBox="0 0 1000 460" aria-hidden="true"><line x1="${wineryPoint.x.toFixed(2)}" y1="${wineryPoint.y.toFixed(2)}" x2="${tapPoint.x.toFixed(2)}" y2="${tapPoint.y.toFixed(2)}" stroke="#f97316" stroke-width="3" stroke-dasharray="9 7"/><circle cx="${wineryPoint.x.toFixed(2)}" cy="${wineryPoint.y.toFixed(2)}" r="7" fill="#22d3ee"/><circle cx="${tapPoint.x.toFixed(2)}" cy="${tapPoint.y.toFixed(2)}" r="7" fill="#f97316"/></svg></div><div class="world-map-legend"><div class="legend-item"><span class="legend-dot legend-origin"></span><b>${labels.origin}</b><br/>${contract.iot.wineryLocation || "N/A"}</div><div class="legend-item"><span class="legend-dot legend-tap"></span><b>${labels.tapLocation}</b><br/>${contract.tapContext.city || "N/A"}, ${contract.tapContext.country || "N/A"}</div></div></div>
  <p style="margin:8px 0 0;font-size:11px;color:#94a3b8">${labels.routeSummary}: ${contract.iot.wineryLocation || labels.origin} → ${contract.tapContext.city || '-'}, ${contract.tapContext.country || '-'} · ${labels.mapLegend}.</p></section>
  <section class="card"><h3 style="margin:0 0 6px">${copy.timelinePanel}</h3><ul style="margin:0;padding-left:18px">${timelineHtml}</ul></section>
  <section class="card"><h3 style="margin:0 0 6px">${copy.tokenPanel}</h3><p>${labels.statusLabel}: <b>${contract.tokenization.status}</b> · ${labels.networkLabel}: <b>${contract.tokenization.network || '-'}</b></p><p>${labels.tokenIdLabel}: ${contract.tokenization.tokenId || '-'} · ${labels.txLabel}: ${contract.tokenization.txHash || '-'}</p></section>
  <section class="card"><div class="section-head"><h3>${copy.actionsPanel}</h3><span class="section-tag">${labels.consumerJourney}</span></div><p class="subtitle" style="margin-bottom:10px">${labels.actionSubtitle}</p><div class="journey-steps"><div class="journey-step"><b>${labels.journey1}</b><span>${labels.journey1Desc}</span></div><div class="journey-step"><b>${labels.journey2}</b><span>${labels.journey2Desc}</span></div><div class="journey-step"><b>${labels.journey3}</b><span>${labels.journey3Desc}</span></div></div><div class="actions-grid" style="margin-bottom:8px"><a href="${contract.cta.marketplaceUrl}" data-gated-link="marketplace" class="link-btn" style="color:#a5f3fc;background:rgba(6,182,212,.12)">🛍 ${labels.linkMarketplace} ${contract.cta.clubName}</a><a href="${contract.cta.rewardsUrl}" data-gated-link="rewards" class="link-btn" style="color:#ddd6fe;background:rgba(139,92,246,.12)">🎁 ${labels.linkRewards}</a><a href="${contract.cta.registerUrl}" data-gated-link="register" class="link-btn" style="color:#d1fae5;background:rgba(16,185,129,.12)">🧾 ${labels.linkRegister}</a><a href="${contract.cta.portalUrl}" data-gated-link="portal" class="link-btn" style="color:#dbeafe;background:rgba(59,130,246,.12)">👤 ${labels.linkPortal}</a></div><div class="actions-grid"><button type="button" data-cta="claim-ownership" ${isReplay ? "disabled" : ""}>✓ ${copy.ctaClaim}</button><button type="button" data-cta="register-warranty" ${isReplay ? "disabled" : ""}>🛡 ${copy.ctaWarranty}</button><button type="button" data-cta="provenance">📍 ${copy.ctaProvenance}</button><button type="button" data-cta="tokenize-request" ${isReplay ? "disabled" : ""}>⛓ ${copy.ctaTokenize}</button></div><button id="nfc-scan" type="button" style="margin-top:8px;display:none">📲 Escanear con NFC</button><p id="cta-status" style="margin:10px 0 0;font-size:12px;color:#cbd5e1">${isReplay ? copy.statusReplay : copy.statusReady}</p><p style="margin:6px 0 0;font-size:11px;color:#94a3b8">${labels.tapHelp}</p>${shareToken ? "" : `<p style="margin:8px 0 0;font-size:11px;color:#fbbf24">${labels.demoMode}</p>`}</section>
<script>
(() => {
  const share = ${JSON.stringify(shareToken)};
  const bid = ${JSON.stringify(contract.identity.bid)};
  const uid = ${JSON.stringify(contract.identity.uid || '')};
  const copy = ${JSON.stringify(copy)};
  const labels = ${JSON.stringify(labels)};
  const ui = copy.lang === 'pt-BR'
    ? {
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
      ? {
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
  const canAssociate = ${JSON.stringify(contract.status.tone === "good" && contract.status.code !== "REPLAY_SUSPECT")};
  const appBase = (() => {
    try {
      return new URL(${JSON.stringify(contract.cta.portalUrl)}).origin;
    } catch {
      return window.location.origin;
    }
  })();
  const nfcBtn = document.getElementById('nfc-scan');
  const jsonFetch = (path, init = {}) => fetch(appBase + path, { credentials: 'include', ...init }).then((r) => r.json());
  async function ensureAuthAndTenant(action) {
    if (!canAssociate) return { ok: false, reason: 'tap_not_verified' };
    const me = await jsonFetch('/api/consumer/me', { cache: 'no-store' }).catch(() => null);
    let contact = '';
    if (!me?.ok) {
      contact = window.prompt(ui.askContact) || '';
      if (!contact.trim()) return { ok: false, reason: 'cancelled' };
      const normalizedContact = contact.trim();
      const payload = normalizedContact.includes('@') ? { email: normalizedContact } : { phone: normalizedContact };
      const start = await jsonFetch('/api/consumer/auth/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null);
      if (!start?.ok) return { ok: false, reason: 'start_failed' };
      let entered = String(start.code || '').trim();
      if (!entered) {
        entered = (window.prompt(ui.askCode, '') || '').trim();
      }
      if (!entered) return { ok: false, reason: 'code_cancelled' };
      const buildVerifyPayload = (code) => normalizedContact.includes('@')
        ? { email: normalizedContact, code }
        : { phone: normalizedContact, code };
      let verify = await jsonFetch('/api/consumer/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildVerifyPayload(entered)) }).catch(() => null);
      if (!verify?.ok && start?.code) {
        const manual = (window.prompt(ui.askCode, String(start.code || '')) || '').trim();
        if (manual) {
          verify = await jsonFetch('/api/consumer/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildVerifyPayload(manual)) }).catch(() => null);
        }
      }
      if (!verify?.ok) return { ok: false, reason: 'verify_failed' };
    }
    if (eventId) {
      await jsonFetch('/api/mobile/passport/' + encodeURIComponent(eventId) + '/consumer/join-tenant', { method: 'POST' }).catch(() => null);
      await jsonFetch('/api/mobile/passport/' + encodeURIComponent(eventId) + '/consumer/save-product', { method: 'POST' }).catch(() => null);
      if (action === 'rewards') {
        const contactForEnroll = contact || window.prompt(ui.askRewards) || '';
        if (contactForEnroll.trim()) {
          await jsonFetch('/api/mobile/passport/' + encodeURIComponent(eventId) + '/loyalty/enroll', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(contactForEnroll.includes('@') ? { email: contactForEnroll } : { phone: contactForEnroll }),
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
          ? ui.notVerified
          : auth.reason === 'start_failed' || auth.reason === 'verify_failed'
            ? ui.hostFail
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
      if (!action || !uid || button.disabled) return;
      const statusNode = document.getElementById('cta-status');
      const originalLabel = button.textContent || action;
      button.disabled = true;
      button.textContent = copy.processing;
      if (statusNode) statusNode.textContent = copy.processing + ' ' + action;
      const shareQuery = share ? '&share=' + encodeURIComponent(share) : '';
      const endpoint = action === 'provenance'
        ? '/public/cta/provenance?bid=' + encodeURIComponent(bid) + '&uid=' + encodeURIComponent(uid) + shareQuery
        : '/public/cta/' + action + '?' + (share ? 'share=' + encodeURIComponent(share) : '');
      try {
        const res = await fetch(endpoint, action === 'provenance' ? { method: 'GET', cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bid, uid, event_id: eventId, source: 'sun_mobile_preview' }) });
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
          const timeline = Array.isArray(payload?.timeline) ? payload.timeline : [];
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
  const url = process.env.SCAN_WEBHOOK_URL;
  if (!url) return;
  const secret = process.env.SCAN_WEBHOOK_SECRET || '';
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { 'x-nexid-signature': secret } : {}) },
    body: JSON.stringify(payload),
    cache: 'no-store',
  }).catch(() => null);
}

async function queueAutoTokenizationForValidTap(params: { bid: string; uid: string; traceId: string }) {
  const enabled = String(process.env.SUN_AUTO_TOKENIZE_ON_VALID_TAP || "false").toLowerCase() === "true";
  if (!enabled) return null;

  const row = (await sql/*sql*/`
    SELECT tr.id, tr.status
    FROM tokenization_requests tr
    WHERE tr.bid = ${params.bid}
      AND tr.uid_hex = ${params.uid}
      AND tr.status IN ('pending', 'processing', 'anchored')
    ORDER BY tr.requested_at DESC
    LIMIT 1
  `)[0];
  if (row?.status === "anchored") return { ok: true, deduplicated: true, status: "anchored" };
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
      ${JSON.stringify({ trace_id: params.traceId, source: "sun_valid_tap_auto_mint" })}::jsonb
    )
    RETURNING id
  `)[0];

  if (!inserted?.id) return null;
  return await anchorTokenizationRequest({ requestId: String(inserted.id), processor: "sun_auto_tokenization" });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const traceId = req.headers.get("x-nexid-trace-id") || req.headers.get("x-request-id") || `sun_${Date.now().toString(36)}`;
  const bid = url.searchParams.get('bid') || '';
  const picc_data = url.searchParams.get('picc_data') || '';
  const enc = url.searchParams.get('enc') || '';
  const cmac = url.searchParams.get('cmac') || '';

  const ua = req.headers.get('user-agent') || '';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const geoCity = safeDecode(req.headers.get('x-vercel-ip-city'));
  const geoCountry = req.headers.get('x-vercel-ip-country') || null;
  const geoLat = Number(req.headers.get('x-vercel-ip-latitude') || '');
  const geoLng = Number(req.headers.get('x-vercel-ip-longitude') || '');
  const locale = resolveSunLocale(url, geoCountry, req.headers.get('accept-language'));

  if (isRateLimited(ip)) return json({ ok: false, reason: 'rate_limited', limitPerMinute: RATE_LIMIT_MAX }, 429);
  if (!bid || !picc_data || !enc || !cmac) return json({ ok: false, reason: 'missing params', need: ['bid', 'picc_data', 'enc', 'cmac'] }, 400);
  if (!BID_RE.test(bid)) return json({ ok: false, reason: 'invalid bid format' }, 400);
  if (!HEX_RE.test(picc_data) || picc_data.length % 2 !== 0) return json({ ok: false, reason: 'invalid picc_data hex' }, 400);
  if (!HEX_RE.test(enc) || enc.length !== 32) return json({ ok: false, reason: 'invalid enc hex (expected 32 hex chars)' }, 400);
  if (!HEX_RE.test(cmac) || cmac.length !== 16) return json({ ok: false, reason: 'invalid cmac hex (expected 16 hex chars)' }, 400);

  let result: SunResult;
  try {
    result = await withTimeout(processSunScan({
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
        lat: Number.isFinite(geoLat) ? geoLat : null,
        lng: Number.isFinite(geoLng) ? geoLng : null,
        source: 'real',
        meta: {
          trace_id: traceId,
          request_id: req.headers.get('x-request-id') || null,
        },
      },
    }), SUN_PIPELINE_TIMEOUT_MS, "sun_pipeline");
  } catch (error) {
    const internalReason = error instanceof Error ? error.message : 'sun_processing_error';
    result = { status: 200, body: { ok: false, reason: sanitizePublicErrorReason(internalReason) } };
    console.error("[sun_scan_error]", JSON.stringify({ traceId, bid, reason: internalReason }));
  }

  const uid = result.body.uid || null;
  const eventId = Number((result.body as { event_id?: number }).event_id || 0) || null;
  const ctr = typeof result.body.ctr === 'number' ? result.body.ctr : null;
  const passport = await withTimeout(getPassportSnapshot(bid, uid || undefined), 2500, "sun_passport_snapshot").catch(() => null);
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
      lat: Number.isFinite(geoLat) ? geoLat : null,
      lng: Number.isFinite(geoLng) ? geoLng : null,
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
        lat: Number.isFinite(geoLat) ? geoLat : null,
        lng: Number.isFinite(geoLng) ? geoLng : null,
        stage: "current_tap",
      },
    ];
  }

  if (result.body.ok && uid) {
    const autoMint = await queueAutoTokenizationForValidTap({ bid, uid, traceId }).catch((error) => ({
      ok: false,
      reason: error instanceof Error ? error.message : "auto_tokenization_failed",
      status: "failed",
    }));
    if (autoMint && typeof autoMint === "object" && "ok" in autoMint) {
      if (autoMint.ok === false) {
        const mintReason = "reason" in autoMint ? String(autoMint.reason || "unknown_error") : "unknown_error";
        contract.tokenization.status = "mint_failed";
        contract.troubleshooting = [
          ...contract.troubleshooting,
          `Tokenización automática falló (${sanitizePublicErrorReason(mintReason)}).`,
          "Revisá balance de gas, RPC de Polygon y clave minter en variables de entorno.",
        ];
      } else if (autoMint.ok === true && "status" in autoMint && String(autoMint.status || "") === "anchored") {
        contract.tokenization.status = "minted";
      }
    }
  }

  if ((contract.tokenization.status === "none" || !contract.tokenization.status) && ctaTimeline.some((item) => String(item.result || "").includes("TOKENIZE_REQUEST"))) {
    contract.tokenization.status = "requested";
    contract.tokenization.network = contract.tokenization.network || "polygon-amoy";
  }
  if ((contract.tokenization.status === "none" || !contract.tokenization.status) && contract.status.code === "REPLAY_SUSPECT") {
    contract.tokenization.status = "blocked_replay";
  }

  if (result.body.ok) {
    void dispatchValidScanWebhook({ event: 'tag.scan.valid', bid, uid: result.body.uid, counter: result.body.ctr, ip, userAgent: ua, geoCity, geoCountry, geoLat: Number.isFinite(geoLat) ? geoLat : null, geoLng: Number.isFinite(geoLng) ? geoLng : null, ts: new Date().toISOString() });
  }

  const maskedUid = uid ? `${String(uid).slice(0, 4)}***${String(uid).slice(-4)}` : null;
  const verdict = String(contract.status.code || result.body.result || "UNKNOWN");
  const diagnosticId = await insertSunDiagnostic({
    trace_id: traceId,
    tool_type: "sun_scan",
    bid,
    uid_hex: uid || null,
    uid_masked: maskedUid,
    read_counter: typeof ctr === "number" ? ctr : null,
    auth_status: String((result.body as { auth_status?: string }).auth_status || result.body.result || "UNKNOWN"),
    replay_status: verdict === "REPLAY_SUSPECT" ? "REPLAY_SUSPECT" : "NO_REPLAY",
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
  console.info("[sun_scan]", JSON.stringify({
    traceId,
    route: "/sun",
    bid,
    uidMasked: maskedUid,
    verdict,
    tamperSignal: (result.body as { tamper_signal?: string }).tamper_signal || null,
    tamperOpened: Boolean((result.body as { tamper_opened?: boolean }).tamper_opened),
    tamperRisk: Boolean((result.body as { tamper_risk?: boolean }).tamper_risk),
    tagTamperConfigDetected: Boolean((result.body as { tag_tamper_config_detected?: boolean }).tag_tamper_config_detected),
    encPlainStatusByte: (result.body as { enc_plain_status_byte?: string }).enc_plain_status_byte || null,
    eventId,
    diagnosticId,
    status: result.status,
    tenant: bid.startsWith("DEMO-") ? "demobodega" : "unknown",
    createdAt: new Date().toISOString(),
  }));
  if (diagnosticId) (contract as Record<string, unknown>).diagnostic_id = diagnosticId;

  if (wantsHtml(req, url)) {
    const shareToken = uid
      ? (() => {
          try {
            const now = Math.floor(Date.now() / 1000);
            return createDemoShareToken({ bid, uid, exp: now + 60 * 30 });
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
        'x-nexid-upstream-status': String(result.status || 200),
      },
    });
  }

  const response = json(contract, result.status);
  response.headers.set("x-nexid-trace-id", traceId);
  if (diagnosticId) response.headers.set("x-nexid-diagnostic-id", String(diagnosticId));
  if (eventId) response.headers.set("x-nexid-event-id", String(eventId));
  return response;
}
