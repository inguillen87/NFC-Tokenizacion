export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json } from '../../lib/http';
import { processSunScan } from '../../lib/sun-service';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.SUN_RATE_LIMIT_PER_MIN || 120);
const rateMap = new Map<string, { count: number; start: number }>();
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const HEX_RE = /^[0-9A-F]+$/i;

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
  const force = (url.searchParams.get("view") || "").toLowerCase();
  if (force === "json") return false;
  if (force === "html") return true;
  const accept = (req.headers.get("accept") || "").toLowerCase();
  return accept.includes("text/html");
}

function renderSunHtml(input: { bid: string; picc_data: string; enc: string; cmac: string; result: Awaited<ReturnType<typeof processSunScan>> }) {
  const status = input.result.body.result || (input.result.body.ok ? "VALID" : "INVALID");
  const tone = input.result.body.ok ? "#22c55e" : "#f97316";
  const trust = input.result.body.ok ? "Autenticidad confirmada" : `Estado: ${status}`;
  const reason = input.result.body.reason || "Sin observaciones adicionales";
  const uid = input.result.body.uid || "N/A";
  const ctr = typeof input.result.body.ctr === "number" ? String(input.result.body.ctr) : "N/A";
  const sensors = [
    { label: "Cadena térmica", value: input.result.body.ok ? "Estable" : "Revisar lote", score: input.result.body.ok ? 88 : 54 },
    { label: "Integridad tamper", value: status === "REPLAY_SUSPECT" ? "Alerta" : "Normal", score: status === "REPLAY_SUSPECT" ? 41 : 92 },
    { label: "Riesgo clonación", value: status === "VALID" ? "Bajo" : "Medio", score: status === "VALID" ? 91 : 63 },
  ];
  const sensorBars = sensors.map((sensor) => `<div class="sensor"><p><span>${sensor.label}</span><b>${sensor.value}</b></p><div class="bar"><span style="width:${sensor.score}%"></span></div></div>`).join("");
  const vintage = Number(input.bid.replace(/[^\d]/g, "").slice(0, 4)) || 2024;
  const yearAging = Math.max(1, new Date().getUTCFullYear() - vintage);

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>NexID · Wine Trust Passport</title>
<style>
body{margin:0;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif} .wrap{max-width:680px;margin:0 auto;padding:22px}
.hero{border:1px solid rgba(148,163,184,.25);border-radius:18px;padding:16px;background:radial-gradient(circle at top,#0f172a,#020617)}
.chip{display:inline-block;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:4px 10px;font-size:11px;letter-spacing:.08em}
.ok{background:rgba(34,197,94,.16);color:#bbf7d0;border-color:rgba(34,197,94,.35)} .warn{background:rgba(249,115,22,.16);color:#fdba74;border-color:rgba(249,115,22,.35)}
.kpi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.card{border:1px solid rgba(148,163,184,.2);border-radius:14px;padding:12px;background:#0b1224}
.section{margin-top:14px;border:1px solid rgba(148,163,184,.2);border-radius:14px;padding:12px;background:#0b1224}
.sensor p{display:flex;justify-content:space-between;font-size:12px}.bar{height:8px;background:#1e293b;border-radius:999px;overflow:hidden}.bar span{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#a78bfa)}
.timeline li{margin:7px 0;font-size:13px;color:#cbd5e1}
.foot{margin-top:12px;font-size:11px;color:#94a3b8}
</style></head><body><main class="wrap">
<section class="hero">
  <span class="chip ${input.result.body.ok ? "ok" : "warn"}">${trust}</span>
  <h1 style="margin:10px 0 6px;font-size:24px">NexID Wine Trust Passport</h1>
  <p style="margin:0;color:#93c5fd">Tokenización + trazabilidad antifraude + anti apertura por unidad.</p>
  <div class="kpi">
    <div class="card"><small>BID</small><div>${input.bid}</div></div>
    <div class="card"><small>UID</small><div>${uid}</div></div>
    <div class="card"><small>Read counter</small><div>${ctr}</div></div>
    <div class="card"><small>Años en barrica</small><div>${yearAging} años</div></div>
  </div>
</section>
<section class="section"><h3 style="margin:0 0 8px">Sensores & riesgo operativo</h3>${sensorBars}</section>
<section class="section"><h3 style="margin:0 0 8px">Historia del vino</h3>
<ul class="timeline">
<li>Varietal: Malbec/Cabernet premium · Altura controlada.</li>
<li>Cepa trazada por lote, vendimia ${vintage}, crianza en roble francés.</li>
<li>Control anti-falsificación con SUN/CMAC y serialización por UID.</li>
<li>Estado antifraude: <b style="color:${tone}">${status}</b> · ${reason}</li>
</ul></section>
<p class="foot">Raw params · picc_data=${input.picc_data.slice(0, 12)}... · enc=${input.enc.slice(0, 12)}... · cmac=${input.cmac.slice(0, 8)}...</p>
</main></body></html>`;
}

async function dispatchValidScanWebhook(payload: Record<string, unknown>) {
  const url = process.env.SCAN_WEBHOOK_URL;
  if (!url) return;
  const secret = process.env.SCAN_WEBHOOK_SECRET || '';
  await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { 'x-nexid-signature': secret } : {}),
    },
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

  if (isRateLimited(ip)) {
    return json({ ok: false, reason: 'rate_limited', limitPerMinute: RATE_LIMIT_MAX }, 429);
  }

  if (!bid || !picc_data || !enc || !cmac) {
    return json({ ok: false, reason: 'missing params', need: ['bid', 'picc_data', 'enc', 'cmac'] }, 400);
  }

  if (!BID_RE.test(bid)) {
    return json({ ok: false, reason: 'invalid bid format' }, 400);
  }
  if (!HEX_RE.test(picc_data) || picc_data.length % 2 !== 0) {
    return json({ ok: false, reason: 'invalid picc_data hex' }, 400);
  }
  if (!HEX_RE.test(enc) || enc.length !== 32) {
    return json({ ok: false, reason: 'invalid enc hex (expected 32 hex chars)' }, 400);
  }
  if (!HEX_RE.test(cmac) || cmac.length !== 16) {
    return json({ ok: false, reason: 'invalid cmac hex (expected 16 hex chars)' }, 400);
  }

  const result = await processSunScan({
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

  if (result.body.ok) {
    void dispatchValidScanWebhook({
      event: 'tag.scan.valid',
      bid,
      uid: result.body.uid,
      counter: result.body.ctr,
      ip,
      userAgent: ua,
      geoCity,
      geoCountry,
      geoLat: Number.isFinite(geoLat) ? geoLat : null,
      geoLng: Number.isFinite(geoLng) ? geoLng : null,
      ts: new Date().toISOString(),
    });
  }
  if (wantsHtml(req, url)) {
    return new Response(renderSunHtml({ bid, picc_data, enc, cmac, result }), {
      status: result.status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return json(result.body, result.status);
}
