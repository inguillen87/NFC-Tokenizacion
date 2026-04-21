export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json } from '../../lib/http';
import { processSunScan } from '../../lib/sun-service';
import { createDemoShareToken } from '../../lib/demo-share';
import { sql } from '../../lib/db';
import { anchorTokenizationRequest } from '../../lib/tokenization-engine';
import { buildLifecycleState, listDemoCta } from '../../lib/demo-cta';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.SUN_RATE_LIMIT_PER_MIN || 120);
const rateMap = new Map<string, { count: number; start: number }>();
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const HEX_RE = /^[0-9A-F]+$/i;

type SunResult = Awaited<ReturnType<typeof processSunScan>>;

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
  harvestYear: number;
  barrelMonths: number;
  storage: string;
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
    harvestYear: 2022,
    barrelMonths: 12,
    storage: "16°C",
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
    harvestYear: 2023,
    barrelMonths: 10,
    storage: "15°C",
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

function resolveTrustState(status: string, reason: string) {
  const normalizedStatus = status.toUpperCase();
  const normalizedReason = reason.toLowerCase();
  if (normalizedStatus === 'REPLAY_SUSPECT' || normalizedReason.includes('replay')) {
    return { code: 'REPLAY_SUSPECT', label: 'Replay detectado', summary: 'Payload reutilizado. Pedí nuevo tap físico.', tone: 'warn' as const };
  }
  if (normalizedStatus === 'OPENED' || normalizedReason.includes('opened')) {
    return { code: 'OPENED', label: 'Producto abierto', summary: 'Se detectó estado de apertura en el flujo.', tone: 'warn' as const };
  }
  if (normalizedStatus === 'TAMPER_RISK' || normalizedReason.includes('tamper')) {
    return { code: 'TAMPER_RISK', label: 'Riesgo de manipulación', summary: 'Se detectaron señales de posible manipulación.', tone: 'risk' as const };
  }
  if (normalizedStatus === 'VALID') {
    return { code: 'VALID', label: 'Producto auténtico', summary: 'Firma SUN validada correctamente.', tone: 'good' as const };
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
  const trust = resolveTrustState(status, reason);
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
  const wineryLocation = preset?.wineryLocation || null;
  const sensorHistory = buildDemoSensorHistory(params.timeline, fallbackStorage, params.passport?.barrel_months || fallbackBarrelMonths);
  const avgTemp = sensorHistory.length ? (sensorHistory.reduce((acc, item) => acc + (item.temperatureC || 0), 0) / sensorHistory.length) : null;
  const avgHumidity = sensorHistory.length ? (sensorHistory.reduce((acc, item) => acc + (item.humidityPct || 0), 0) / sensorHistory.length) : null;
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
    },
    identity: {
      bid: params.bid,
      uid: params.uid,
      readCounter: params.ctr,
      tagStatus: params.passport?.tag_status || null,
      scanCount: params.passport?.scan_count || 0,
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
    },
    provenance: {
      origin: params.passport?.region || params.passport?.winery || null,
      firstVerified: {
        at: params.passport?.first_verified_at || null,
        city: params.passport?.first_city || null,
        country: params.passport?.first_country || null,
      },
      lastVerifiedLocation: {
        at: params.passport?.last_verified_at || null,
        city: params.passport?.last_city || null,
        country: params.passport?.last_country || null,
        result: params.passport?.last_result || null,
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
      city: params.tap.city,
      country: params.tap.country,
      lat: params.tap.lat,
      lng: params.tap.lng,
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

function renderSunHtml(contract: ReturnType<typeof buildPublicContract>, shareToken: string | null) {
  const tone = contract.status.tone === 'good' ? '#22c55e' : contract.status.tone === 'risk' ? '#ef4444' : '#f59e0b';
  const isReplay = contract.status.code === "REPLAY_SUSPECT";
  const timeline = contract.provenance.timelineSummary;
  const timelineHtml = timeline.length
    ? timeline.map((item) => `<li>${item.at || 'N/A'} · <b>${item.result || '-'}</b> · ${item.city || '-'}, ${item.country || '-'}</li>`).join('')
    : '<li>Sin eventos de timeline disponibles.</li>';
  const tapLat = contract.tapContext.lat;
  const tapLng = contract.tapContext.lng;
  const wineryLat = contract.iot.wineryCoordinates?.lat ?? tapLat ?? -33.0086;
  const wineryLng = contract.iot.wineryCoordinates?.lng ?? tapLng ?? -68.7794;
  const destinationLat = tapLat ?? wineryLat;
  const destinationLng = tapLng ?? wineryLng;
  const bbox = [
    Math.min(wineryLng, destinationLng) - 0.08,
    Math.min(wineryLat, destinationLat) - 0.05,
    Math.max(wineryLng, destinationLng) + 0.08,
    Math.max(wineryLat, destinationLat) + 0.05,
  ];
  const mapEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox[0]}%2C${bbox[1]}%2C${bbox[2]}%2C${bbox[3]}&layer=mapnik&marker=${destinationLat}%2C${destinationLng}`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>NexID Product Passport</title>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/logo-mark.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-icon" />
  <style>body{margin:0;background:radial-gradient(circle at top,#0b1e47 0%,#020617 55%);color:#e2e8f0;font-family:Inter,system-ui,sans-serif}.wrap{max-width:760px;margin:0 auto;padding:18px}.card{border:1px solid rgba(148,163,184,.22);border-radius:18px;background:linear-gradient(180deg,#0d1834 0%,#0a1228 100%);padding:16px;margin-top:12px;box-shadow:0 12px 36px rgba(2,6,23,.38)}.badge{display:inline-block;border-radius:999px;border:1px solid rgba(255,255,255,.25);padding:4px 10px;font-size:11px;font-weight:700;letter-spacing:.04em}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.chip{border:1px solid rgba(148,163,184,.35);border-radius:999px;padding:4px 10px;font-size:11px;color:#cbd5e1}details{margin-top:10px}button{border:1px solid rgba(148,163,184,.4);border-radius:10px;background:#071229;color:#dbeafe;padding:9px 8px;font-size:12px;font-weight:600}button:disabled{opacity:.45;cursor:not-allowed}.subtitle{margin:0;color:#9fb5d9;font-size:13px}</style></head><body><main class="wrap">
  <section class="card"><span class="badge" style="color:${tone};border-color:${tone}">${contract.status.label}</span><h1 style="margin:10px 0 4px;font-size:28px;line-height:1.1">Digital Product Passport</h1><p class="subtitle">${contract.status.summary}</p><div class="chips"><span class="chip">BID ${contract.identity.bid}</span><span class="chip">UID ${contract.identity.uid || 'N/A'}</span><span class="chip">Tap #${contract.identity.readCounter ?? 'N/A'}</span><span class="chip">Quality ${contract.quality.score}/100 · ${contract.quality.tier}</span></div></section>
  <section class="card"><h3 style="margin:0 0 6px">Qué hacer ahora</h3><p class="subtitle">${isReplay ? "1) No cerrar venta todavía. 2) Pedir nuevo tap físico (link fresco). 3) Revalidar y recién ahí activar ownership/garantía/tokenización." : "1) Validación consistente. 2) Activá ownership/garantía si aplica. 3) Opcional: tokenizá para anclaje on-chain."}</p><div class="chips"><span class="chip">${isReplay ? "Estado comercial: HOLD" : "Estado comercial: OK"}</span><span class="chip">${isReplay ? "Riesgo: replay sospechoso" : "Riesgo: controlado"}</span><span class="chip">Tenant view sync: Dashboard → Analytics/Events/Tags</span></div></section>
  <section class="card"><h3 style="margin:0 0 6px">Product identity</h3><p><b>${contract.product.name || 'Producto no perfilado'}</b></p><p>${contract.product.winery || '-'} · ${contract.product.region || '-'}</p><p>Varietal ${contract.product.varietal || '-'} · Vintage ${contract.product.vintage || '-'}</p><p>Cosecha ${contract.product.harvestYear || '-'} · Barrica ${contract.product.barrelMonths || '-'} meses</p></section>
  <section class="card"><h3 style="margin:0 0 6px">Provenance (honesto)</h3><p>Origen: <b>${contract.provenance.origin || '-'}</b></p><p>First verified: <b>${contract.provenance.firstVerified.at || 'N/A'} · ${contract.provenance.firstVerified.city || '-'}, ${contract.provenance.firstVerified.country || '-'}</b></p><p>Last verified location: <b>${contract.provenance.lastVerifiedLocation.at || 'N/A'} · ${contract.provenance.lastVerifiedLocation.city || '-'}, ${contract.provenance.lastVerifiedLocation.country || '-'}</b></p></section>
  <section class="card"><h3 style="margin:0 0 6px">IoT & cellar signals</h3><p>Bodega: <b>${contract.iot.wineryLocation || 'No disponible'}</b></p><p>Altitud: <b>${contract.iot.altitude || '-'}</b> · Barrica: <b>${contract.iot.oakType || '-'}</b></p><p>Temperatura bodega: <b>${contract.iot.sensorSnapshot.cellarTemperature || '-'}</b> · Humedad: <b>${contract.iot.sensorSnapshot.humidity || '-'}</b></p><p>Luz: <b>${contract.iot.sensorSnapshot.lightExposure || '-'}</b> · Transporte: <b>${contract.iot.sensorSnapshot.transitShock || '-'}</b></p></section>
  <section class="card"><h3 style="margin:0 0 6px">Sensor timeline (wine lifecycle)</h3><ul style="margin:0;padding-left:18px;display:grid;gap:6px">${contract.iot.sensorHistory.map((item) => `<li>${item.at || 'N/A'} · <b>${item.stage}</b> · ${item.temperatureC}°C · ${item.humidityPct}% HR · Barrica ${item.barrelAgeMonths ?? '-'} meses${item.alert ? ` · ⚠ ${item.alert}` : ''}</li>`).join('')}</ul></section>
  <section class="card"><h3 style="margin:0 0 6px">Tap device intelligence</h3><p>SO: <b>${contract.tapContext.os}</b> · Browser: <b>${contract.tapContext.browser}</b> · Device: <b>${contract.tapContext.deviceType}</b></p><p>Ubicación del tap: <b>${contract.tapContext.city || '-'}, ${contract.tapContext.country || '-'}</b>${contract.tapContext.lat != null && contract.tapContext.lng != null ? ` · (${contract.tapContext.lat}, ${contract.tapContext.lng})` : ''}</p>
  <div style="margin-top:10px;border:1px solid rgba(148,163,184,.28);border-radius:12px;overflow:hidden;background:#020617">
    <iframe title="sun-tap-map" src="${mapEmbed}" loading="lazy" style="display:block;width:100%;height:180px;border:0"></iframe>
  </div>
  <p style="margin:8px 0 0;font-size:11px;color:#94a3b8">Mapa de lectura: ${contract.iot.wineryLocation || 'Origen'} → punto de tap.</p></section>
  <section class="card"><h3 style="margin:0 0 6px">Timeline summary</h3><ul style="margin:0;padding-left:18px">${timelineHtml}</ul></section>
  <section class="card"><h3 style="margin:0 0 6px">Tokenization</h3><p>Status: <b>${contract.tokenization.status}</b> · Network: <b>${contract.tokenization.network || '-'}</b></p><p>Token ID: ${contract.tokenization.tokenId || '-'} · Tx: ${contract.tokenization.txHash || '-'}</p><p style="margin-top:8px;font-size:12px;color:${isReplay ? "#fca5a5" : "#a7f3d0"}">${isReplay ? "Replay detectado: la tokenización queda bloqueada hasta un nuevo tap físico válido." : "Podés solicitar tokenización opcional cuando la validación sea consistente."}</p></section>
  <section class="card"><h3 style="margin:0 0 6px">Acciones</h3><p class="subtitle" style="margin-bottom:10px">Flujos certificados para consumidor, postventa y trazabilidad digital.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button data-cta="claim-ownership" ${isReplay ? "disabled" : ""}>✓ Activar ownership</button><button data-cta="register-warranty" ${isReplay ? "disabled" : ""}>🛡 Registrar garantía</button><button data-cta="provenance">📍 Ver provenance</button><button data-cta="tokenize-request" ${isReplay ? "disabled" : ""}>⛓ Tokenización opcional</button></div><p id="cta-status" style="margin:10px 0 0;font-size:12px;color:#cbd5e1">${isReplay ? "Replay activo: acciones comerciales bloqueadas hasta nuevo tap." : "Listo para ejecutar acciones firmadas."}</p></section>
  <section class="card"><details><summary>Technical details</summary><p>BID: ${contract.identity.bid} · UID: ${contract.identity.uid || 'N/A'} · Read counter: ${contract.identity.readCounter ?? 'N/A'}</p><p>Raw: picc ${contract.technical.raw.piccDataPrefix} · enc ${contract.technical.raw.encPrefix} · cmac ${contract.technical.raw.cmacPrefix}</p><p>Troubleshooting: ${contract.troubleshooting.join(' | ') || 'Sin alertas'}</p></details></section>
<script>
(() => {
  const share = ${JSON.stringify(shareToken)};
  const bid = ${JSON.stringify(contract.identity.bid)};
  const uid = ${JSON.stringify(contract.identity.uid || '')};
  const ctaButtons = Array.from(document.querySelectorAll('[data-cta]'));
  ctaButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.getAttribute('data-cta');
      if (!action || !share || !uid || button.disabled) return;
      const statusNode = document.getElementById('cta-status');
      const originalLabel = button.textContent || action;
      button.disabled = true;
      button.textContent = 'Procesando...';
      if (statusNode) statusNode.textContent = 'Ejecutando ' + action + '...';
      const endpoint = action === 'provenance'
        ? '/public/cta/provenance?bid=' + encodeURIComponent(bid) + '&uid=' + encodeURIComponent(uid) + '&share=' + encodeURIComponent(share)
        : '/public/cta/' + action + '?share=' + encodeURIComponent(share);
      try {
        const res = await fetch(endpoint, action === 'provenance' ? { method: 'GET', cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bid, uid, source: 'sun_mobile_preview' }) });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.ok) {
          const reason = payload?.reason || ('HTTP ' + res.status);
          button.textContent = 'Error';
          if (statusNode) statusNode.textContent = action + ' falló: ' + reason;
          return;
        }
        button.textContent = 'Hecho ✓';
        if (statusNode) statusNode.textContent = action + ' ejecutado correctamente.';
        if (action === 'provenance') {
          const timeline = Array.isArray(payload?.timeline) ? payload.timeline.length : 0;
          if (statusNode) statusNode.textContent = 'Provenance actualizado (' + timeline + ' eventos).';
        }
      } catch {
        button.textContent = 'Error';
        if (statusNode) statusNode.textContent = 'Error de red en ' + action + '. Reintentá.';
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
  const traceId = req.headers.get("x-nexid-trace-id") || `sun_${Date.now().toString(36)}`;
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

  if (isRateLimited(ip)) return json({ ok: false, reason: 'rate_limited', limitPerMinute: RATE_LIMIT_MAX }, 429);
  if (!bid || !picc_data || !enc || !cmac) return json({ ok: false, reason: 'missing params', need: ['bid', 'picc_data', 'enc', 'cmac'] }, 400);
  if (!BID_RE.test(bid)) return json({ ok: false, reason: 'invalid bid format' }, 400);
  if (!HEX_RE.test(picc_data) || picc_data.length % 2 !== 0) return json({ ok: false, reason: 'invalid picc_data hex' }, 400);
  if (!HEX_RE.test(enc) || enc.length !== 32) return json({ ok: false, reason: 'invalid enc hex (expected 32 hex chars)' }, 400);
  if (!HEX_RE.test(cmac) || cmac.length !== 16) return json({ ok: false, reason: 'invalid cmac hex (expected 16 hex chars)' }, 400);

  let result: SunResult;
  try {
    result = await processSunScan({
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
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'sun_processing_error';
    result = { status: 200, body: { ok: false, reason: `sun_processing_error: ${reason}` } };
  }

  const uid = result.body.uid || null;
  const ctr = typeof result.body.ctr === 'number' ? result.body.ctr : null;
  const passport = await getPassportSnapshot(bid, uid || undefined).catch(() => null);
  const timeline = await getTimelineSummary(bid, uid || undefined).catch(() => [] as TimelineEvent[]);
  const ctaTimeline = await getCtaTimelineSummary(bid, uid || undefined).catch(() => [] as TimelineEvent[]);
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
          `Tokenización automática falló (${mintReason}).`,
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
    return new Response(renderSunHtml(contract, shareToken), {
      status: result.status,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  return json(contract, result.status);
}
