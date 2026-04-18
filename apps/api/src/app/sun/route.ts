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

function buildTroubleshooting(reason: string, bid: string) {
  const normalized = reason.toLowerCase();
  if (normalized === "sun_ok" || normalized.includes("ok")) {
    return null;
  }
  if (normalized.includes("unknown batch")) {
    return {
      title: "Batch no registrado en este ambiente",
      bullets: [
        `El BID ${bid} no existe en la base conectada a este dominio.`,
        "Revisá si el lote fue creado en otro entorno (demo/local vs producción).",
        "Desde Dashboard: registrar batch → importar manifest → activar tags.",
      ],
    };
  }
  if (normalized.includes("replay")) {
    return {
      title: "URL copiada o reutilizada",
      bullets: [
        "El payload SUN ya fue usado anteriormente.",
        "El flujo válido es tocar nuevamente el NFC (nuevo contador).",
        "No reutilizar URLs pegadas para validar autenticidad.",
      ],
    };
  }
  if (normalized.includes("cmac") || normalized.includes("invalid")) {
    return {
      title: "Firma SUN inválida",
      bullets: [
        "Puede haber diferencia de llaves entre proveedor y backend.",
        "Verificá K_META/K_FILE del batch y que las tags sean del mismo lote.",
        "Usá una URL generada por tap real (no manual).",
      ],
    };
  }
  return {
    title: "Validación no concluyente",
    bullets: [
      "Revisá parámetros SUN y estado de onboarding del batch.",
      "Confirmá que el UID esté importado y activo.",
      "Si persiste, revisar eventos y llaves del lote.",
    ],
  };
}

function resolveTrustState(status: string, reason: string) {
  const normalizedStatus = status.toUpperCase();
  const normalizedReason = reason.toLowerCase();
  if (normalizedStatus === "REPLAY_SUSPECT" || normalizedReason.includes("replay")) {
    return { key: "REPLAY_SUSPECT", badge: "Replay detectado", title: "URL copiada o reutilizada", tone: "#f97316", summary: "Escaneá nuevamente la etiqueta física para validar autenticidad." };
  }
  if (normalizedStatus === "OPENED" || normalizedReason.includes("opened")) {
    return { key: "OPENED", badge: "Apertura detectada", title: "Producto abierto", tone: "#f59e0b", summary: "La cápsula o el estado de apertura indican uso previo." };
  }
  if (normalizedStatus === "CLAIMED" || normalizedReason.includes("claimed")) {
    return { key: "CLAIMED", badge: "Ownership activo", title: "Producto autenticado y reclamado", tone: "#22c55e", summary: "Este artículo ya tiene ownership registrado por un cliente." };
  }
  if (normalizedStatus === "TAMPER_RISK" || normalizedReason.includes("tamper")) {
    return { key: "TAMPER_RISK", badge: "Riesgo tamper", title: "Riesgo de manipulación", tone: "#ef4444", summary: "Se detectaron señales de posible manipulación en la etiqueta." };
  }
  if (normalizedStatus === "VALID") {
    return { key: "VALID", badge: "Producto auténtico", title: "Autenticidad confirmada", tone: "#22c55e", summary: "La etiqueta NFC y la firma SUN validaron correctamente." };
  }
  return { key: normalizedStatus || "INVALID", badge: `Estado ${normalizedStatus || "INVALID"}`, title: "Validación no concluyente", tone: "#f97316", summary: "No se pudo confirmar estado final. Revisá onboarding y parámetros SUN." };
}

async function getPassportSnapshot(bid: string, uid: string | undefined) {
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
      first_evt.created_at AS first_verified_at,
      first_evt.city AS first_city,
      first_evt.country_code AS first_country,
      last_evt.created_at AS last_verified_at,
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
  return rows[0] || null;
}

function renderSunHtml(input: { bid: string; picc_data: string; enc: string; cmac: string; result: Awaited<ReturnType<typeof processSunScan>> }) {
  const status = input.result.body.result || (input.result.body.ok ? "VALID" : "INVALID");
  const reason = input.result.body.reason || "Sin observaciones adicionales";
  const trustState = resolveTrustState(status, reason);
  const tone = trustState.tone;
  const trust = trustState.badge;
  const troubleshooting = buildTroubleshooting(reason, input.bid);
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
  const eventUid = input.result.body.uid || "";
  const eventCtr = typeof input.result.body.ctr === "number" ? input.result.body.ctr : null;
  const shareToken = eventUid
    ? (() => {
        try {
          const now = Math.floor(Date.now() / 1000);
          return createDemoShareToken({ bid: input.bid, uid: eventUid, exp: now + 60 * 30 });
        } catch {
          return null;
        }
      })()
    : null;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>NexID · Wine Trust Passport</title>
<style>
body{margin:0;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif} .wrap{max-width:680px;margin:0 auto;padding:22px}
.device{max-width:420px;margin:0 auto;border:1px solid rgba(148,163,184,.28);border-radius:28px;padding:14px;background:linear-gradient(180deg,#020617,#020617 36%,#030b1e)}
.hero{border:1px solid rgba(148,163,184,.25);border-radius:18px;padding:16px;background:radial-gradient(circle at top,#0f172a,#020617)}
.chip{display:inline-block;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:4px 10px;font-size:11px;letter-spacing:.08em}
.ok{background:rgba(34,197,94,.16);color:#bbf7d0;border-color:rgba(34,197,94,.35)} .warn{background:rgba(249,115,22,.16);color:#fdba74;border-color:rgba(249,115,22,.35)}
.kpi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.card{border:1px solid rgba(148,163,184,.2);border-radius:14px;padding:12px;background:#0b1224}
.section{margin-top:14px;border:1px solid rgba(148,163,184,.2);border-radius:14px;padding:12px;background:#0b1224}
.sensor p{display:flex;justify-content:space-between;font-size:12px}.bar{height:8px;background:#1e293b;border-radius:999px;overflow:hidden}.bar span{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#a78bfa)}
.timeline li{margin:7px 0;font-size:13px;color:#cbd5e1}
.foot{margin-top:12px;font-size:11px;color:#94a3b8}
.hint{margin-top:12px;border:1px solid rgba(251,191,36,.35);border-radius:14px;padding:12px;background:rgba(251,191,36,.08)}
.hint li{margin:6px 0;font-size:12px;color:#fef3c7}
.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
.actions button{border:1px solid rgba(148,163,184,.3);border-radius:10px;background:#071229;color:#dbeafe;padding:10px 8px;font-size:12px}
.actions button.primary{border-color:rgba(34,211,238,.5);background:rgba(6,182,212,.16);color:#a5f3fc}
</style></head><body><main class="wrap">
<div class="device">
<section class="hero">
  <span class="chip ${input.result.body.ok ? "ok" : "warn"}">${trust}</span>
  <h1 style="margin:10px 0 6px;font-size:24px">NexID Wine Trust Passport</h1>
  <p style="margin:0;color:#93c5fd">${trustState.title}. ${trustState.summary}</p>
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
${troubleshooting ? `<section class="hint">
  <h3 style="margin:0 0 6px;color:#fde68a">${troubleshooting.title}</h3>
  <ul style="margin:0;padding-left:18px">
    ${troubleshooting.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}
  </ul>
</section>` : ""}
<section class="section">
  <h3 style="margin:0 0 8px">Acciones de confianza</h3>
  <div class="actions">
    <button class="primary" data-cta="claim-ownership">Activar ownership</button>
    <button data-cta="register-warranty">Registrar garantía</button>
    <button data-cta="provenance">Ver provenance</button>
    <button data-cta="tokenize-request">Tokenización opcional</button>
  </div>
</section>
<p class="foot">Raw params · picc_data=${input.picc_data.slice(0, 12)}... · enc=${input.enc.slice(0, 12)}... · cmac=${input.cmac.slice(0, 8)}...</p>
<script>
(() => {
  const payload = {
    bid: ${JSON.stringify(input.bid)},
    uid: ${JSON.stringify(eventUid)},
    share: ${JSON.stringify(shareToken)},
    ctr: ${eventCtr === null ? "null" : String(eventCtr)},
    scannedAt: new Date().toISOString(),
    client: {
      ua: navigator.userAgent || null,
      language: navigator.language || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      platform: navigator.platform || null,
      screen: { w: window.screen?.width || null, h: window.screen?.height || null, dpr: window.devicePixelRatio || null },
      mobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || ""),
    },
  };

  const send = (extra) => {
    fetch("/sun/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, ...extra }),
      keepalive: true,
      cache: "no-store",
    }).catch(() => null);
  };

  if (!payload.uid || payload.ctr === null) {
    send({ contextStatus: "no_uid_or_ctr" });
    return;
  }

  if (!navigator.geolocation) {
    send({ contextStatus: "geolocation_not_supported" });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      send({
        contextStatus: "ok",
        geo: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? null,
          speed: position.coords.speed ?? null,
        },
      });
    },
    (error) => {
      send({ contextStatus: "geolocation_denied", geoError: error?.message || "denied" });
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 },
  );

  const ctaButtons = Array.from(document.querySelectorAll("[data-cta]"));
  ctaButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.getAttribute("data-cta");
      if (!action) return;
      if (!payload.share) {
        button.textContent = "CTA no disponible";
        return;
      }
      button.setAttribute("disabled", "true");
      try {
        const isProvenance = action === "provenance";
        const endpoint = isProvenance
          ? "/public/cta/provenance?bid=" + encodeURIComponent(payload.bid) + "&uid=" + encodeURIComponent(payload.uid) + "&share=" + encodeURIComponent(payload.share)
          : "/public/cta/" + action + "?share=" + encodeURIComponent(payload.share);
        const response = await fetch(endpoint, isProvenance
          ? { method: "GET", cache: "no-store" }
          : {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                bid: ${JSON.stringify(input.bid)},
                uid: ${JSON.stringify(eventUid || "")},
                status: ${JSON.stringify(status)},
                source: "sun_mobile_preview",
              }),
            });
        const data = await response.json().catch(() => ({}));
        button.textContent = data?.ok ? "Hecho ✓" : "Intentar de nuevo";
      } catch {
        button.textContent = "Intentar de nuevo";
      } finally {
        setTimeout(() => button.removeAttribute("disabled"), 900);
      }
    });
  });
})();
</script>
</div></main></body></html>`;
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

  let result: Awaited<ReturnType<typeof processSunScan>>;
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
    result = {
      status: 200,
      body: {
        ok: false,
        reason: `sun_processing_error: ${reason}`,
      },
    };
  }

  const passport = await getPassportSnapshot(bid, result.body.uid).catch(() => null);
  const enrichedBody = {
    ...result.body,
    passport: passport
      ? {
          identity: {
            bid,
            uid: result.body.uid || null,
            readCounter: typeof result.body.ctr === "number" ? result.body.ctr : null,
          },
          product: {
            name: passport.product_name || passport.sku || null,
            winery: passport.winery || null,
            region: passport.region || null,
            varietal: passport.grape_varietal || null,
            vintage: passport.vintage || null,
            harvestYear: passport.harvest_year || null,
            barrelMonths: passport.barrel_months || null,
            storage: passport.temperature_storage || null,
          },
          provenance: {
            origin: passport.region || passport.winery || null,
            firstVerified: {
              at: passport.first_verified_at || null,
              city: passport.first_city || null,
              country: passport.first_country || null,
            },
            lastVerifiedLocation: {
              at: passport.last_verified_at || null,
              city: passport.last_city || null,
              country: passport.last_country || null,
              result: passport.last_result || null,
            },
          },
          tokenization: {
            status: passport.tokenization_status || "none",
            network: passport.tokenization_network || null,
            txHash: passport.tokenization_tx_hash || null,
            tokenId: passport.tokenization_token_id || null,
          },
        }
      : null,
  };

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
  return json(enrichedBody, result.status);
}
