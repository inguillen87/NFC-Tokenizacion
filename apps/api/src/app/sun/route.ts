export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json } from '../../lib/http';
import { processSunScan } from '../../lib/sun-service';
import { createDemoShareToken } from '../../lib/demo-share';
import { sql } from '../../lib/db';

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
    SELECT e.created_at::text AS at, e.result, e.city, e.country_code AS country, e.device_label AS device
    FROM events e
    JOIN batches b ON b.id = e.batch_id
    WHERE b.bid = ${bid} AND e.uid_hex = ${uid}
    ORDER BY e.created_at DESC
    LIMIT 6
  `;
  return rows as TimelineEvent[];
}

function buildPublicContract(params: {
  bid: string;
  uid: string | null;
  ctr: number | null;
  result: SunResult['body'];
  passport: PassportSnapshot;
  timeline: TimelineEvent[];
  raw: { picc_data: string; enc: string; cmac: string };
}) {
  const status = params.result.result || (params.result.ok ? 'VALID' : 'INVALID');
  const reason = params.result.reason || 'sin_observaciones';
  const trust = resolveTrustState(status, reason);
  const troubleshooting = buildTroubleshooting(reason, params.bid);

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
      name: params.passport?.product_name || params.passport?.sku || null,
      winery: params.passport?.winery || null,
      region: params.passport?.region || null,
      varietal: params.passport?.grape_varietal || null,
      vintage: params.passport?.vintage || null,
      harvestYear: params.passport?.harvest_year || null,
      barrelMonths: params.passport?.barrel_months || null,
      storage: params.passport?.temperature_storage || null,
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
  const timeline = contract.provenance.timelineSummary;
  const timelineHtml = timeline.length
    ? timeline.map((item) => `<li>${item.at || 'N/A'} · ${item.result || '-'} · ${item.city || '-'}, ${item.country || '-'}</li>`).join('')
    : '<li>Sin eventos de timeline disponibles.</li>';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>NexID Product Passport</title>
  <style>body{margin:0;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif}.wrap{max-width:640px;margin:0 auto;padding:16px}.card{border:1px solid rgba(148,163,184,.22);border-radius:16px;background:#0b1224;padding:14px;margin-top:10px}.badge{display:inline-block;border-radius:999px;border:1px solid rgba(255,255,255,.25);padding:4px 10px;font-size:11px}details{margin-top:10px}button{border:1px solid rgba(148,163,184,.4);border-radius:10px;background:#071229;color:#dbeafe;padding:9px 8px;font-size:12px}</style></head><body><main class="wrap">
  <section class="card"><span class="badge" style="color:${tone};border-color:${tone}">${contract.status.label}</span><h1 style="margin:10px 0 4px;font-size:22px">Digital Product Passport</h1><p style="margin:0;color:#cbd5e1">${contract.status.summary}</p></section>
  <section class="card"><h3 style="margin:0 0 6px">Product identity</h3><p><b>${contract.product.name || 'Producto no perfilado'}</b></p><p>${contract.product.winery || '-'} · ${contract.product.region || '-'}</p><p>Varietal ${contract.product.varietal || '-'} · Vintage ${contract.product.vintage || '-'}</p></section>
  <section class="card"><h3 style="margin:0 0 6px">Provenance (honesto)</h3><p>Origen: <b>${contract.provenance.origin || '-'}</b></p><p>First verified: <b>${contract.provenance.firstVerified.at || 'N/A'} · ${contract.provenance.firstVerified.city || '-'}, ${contract.provenance.firstVerified.country || '-'}</b></p><p>Last verified location: <b>${contract.provenance.lastVerifiedLocation.at || 'N/A'} · ${contract.provenance.lastVerifiedLocation.city || '-'}, ${contract.provenance.lastVerifiedLocation.country || '-'}</b></p></section>
  <section class="card"><h3 style="margin:0 0 6px">Timeline summary</h3><ul style="margin:0;padding-left:18px">${timelineHtml}</ul></section>
  <section class="card"><h3 style="margin:0 0 6px">Tokenization</h3><p>Status: <b>${contract.tokenization.status}</b> · Network: <b>${contract.tokenization.network || '-'}</b></p><p>Token ID: ${contract.tokenization.tokenId || '-'} · Tx: ${contract.tokenization.txHash || '-'}</p></section>
  <section class="card"><h3 style="margin:0 0 6px">Acciones</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button data-cta="claim-ownership">Activar ownership</button><button data-cta="register-warranty">Registrar garantía</button><button data-cta="provenance">Ver provenance</button><button data-cta="tokenize-request">Tokenización opcional</button></div></section>
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
      if (!action || !share || !uid) return;
      const endpoint = action === 'provenance'
        ? '/public/cta/provenance?bid=' + encodeURIComponent(bid) + '&uid=' + encodeURIComponent(uid) + '&share=' + encodeURIComponent(share)
        : '/public/cta/' + action + '?share=' + encodeURIComponent(share);
      await fetch(endpoint, action === 'provenance' ? { method: 'GET', cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bid, uid, source: 'sun_mobile_preview' }) }).catch(() => null);
      button.textContent = 'Hecho ✓';
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

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const bid = url.searchParams.get('bid') || '';
  const picc_data = url.searchParams.get('picc_data') || '';
  const enc = url.searchParams.get('enc') || '';
  const cmac = url.searchParams.get('cmac') || '';

  const ua = req.headers.get('user-agent') || '';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const geoCity = req.headers.get('x-vercel-ip-city') || null;
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
  const contract = buildPublicContract({ bid, uid, ctr, result: result.body, passport, timeline, raw: { picc_data, enc, cmac } });

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
