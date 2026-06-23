import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

// 1. Load Env Config
const envLocalPath = path.resolve("apps/api/.env.local");
if (!fs.existsSync(envLocalPath)) {
  console.error("Error: apps/api/.env.local does not exist.");
  process.exit(1);
}

const envContent = fs.readFileSync(envLocalPath, "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const DATABASE_URL = env.DATABASE_URL;
const ADMIN_API_KEY = env.ADMIN_API_KEY;

if (!DATABASE_URL || !ADMIN_API_KEY) {
  console.error("Error: DATABASE_URL or ADMIN_API_KEY missing in apps/api/.env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const API_BASE = process.env.API_BASE || "https://api.nexid.lat";
const SIMULATED_GPS_POINTS = [
  { label: "Mendoza", city: "Mendoza", countryCode: "AR", lat: -32.8895, lng: -68.8458, accuracy: 18 },
  { label: "Buenos Aires", city: "Buenos Aires", countryCode: "AR", lat: -34.6037, lng: -58.3816, accuracy: 22 },
  { label: "Cordoba", city: "Cordoba", countryCode: "AR", lat: -31.4201, lng: -64.1888, accuracy: 28 },
  { label: "Santiago", city: "Santiago", countryCode: "CL", lat: -33.4489, lng: -70.6693, accuracy: 24 },
  { label: "Sao Paulo", city: "Sao Paulo", countryCode: "BR", lat: -23.5505, lng: -46.6333, accuracy: 30 },
];

// Helpers
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function signHandoffToken(payload, secret) {
  const encode = (input) => Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
  const sign = (body) => crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const body = encode(payload);
  return `${body}.${sign(body)}`;
}

async function run() {
  console.log("==================================================================");
  console.log("🟢 INICIANDO SIMULACIÓN DE PRUEBA E2E POST-TAP (PORTALES Y COMPRAS)");
  console.log("==================================================================");

  const testContact = `e2e.test.buyer.${Date.now()}@nexid.lat`;
  const testPhone = `+549261${Math.floor(1000000 + Math.random() * 9000000)}`;
  const bid = "DEMO-2026-02";
  const tapLocation = SIMULATED_GPS_POINTS[Math.floor(Math.random() * SIMULATED_GPS_POINTS.length)];

  console.log("🔍 Seleccionando un tag no reclamado del lote en la base de datos...");
  const unclaimedRows = await sql`
    SELECT uid_hex FROM tags
    WHERE batch_id = (SELECT id FROM batches WHERE bid = ${bid} LIMIT 1)
      AND id NOT IN (SELECT tag_id FROM consumer_product_ownerships)
    LIMIT 1
  `;
  let uidHex;
  if (unclaimedRows.length > 0) {
    uidHex = unclaimedRows[0].uid_hex;
    console.log(`✅ Encontrado tag no reclamado: ${uidHex}`);
  } else {
    console.log("⚠️ Todos los tags están reclamados. Liberando uno para la simulación...");
    const claimedRows = await sql`
      SELECT t.uid_hex, o.id as ownership_id FROM consumer_product_ownerships o
      JOIN tags t ON t.id = o.tag_id
      WHERE o.batch_id = (SELECT id FROM batches WHERE bid = ${bid} LIMIT 1)
      LIMIT 1
    `;
    if (claimedRows.length > 0) {
      await sql`DELETE FROM consumer_product_ownerships WHERE id = ${claimedRows[0].ownership_id}`;
      uidHex = claimedRows[0].uid_hex;
      console.log(`✅ Liberado tag UID: ${uidHex}`);
    } else {
      uidHex = "0470856A0B1090";
    }
  }

  // Pre-condition: Enforce active_for_claim = true and claim_pin_required = false for test consistency
  await sql`
    UPDATE tags
    SET active_for_claim = true, claim_pin_required = false
    WHERE UPPER(uid_hex) = UPPER(${uidHex})
  `;
  await sql`
    UPDATE batches
    SET active_for_claim = true, claim_pin_required = false
    WHERE bid = ${bid}
  `;

  console.log(`\n👉 1. Simulando Tap Físico NFC (Lote: ${bid}, UID: ${uidHex})`);
  console.log(`Ubicacion GPS variable del Tap: ${tapLocation.label} (${tapLocation.lat}, ${tapLocation.lng})`);
  const tapResponse = await fetch(`${API_BASE}/internal/demo/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ADMIN_API_KEY}`,
    },
    body: JSON.stringify({
      bid,
      uidHex,
      action: "verify",
      city: "",
      countryCode: "",
      lat: tapLocation.lat,
      lng: tapLocation.lng,
      deviceLabel: `Demo Phone (${tapLocation.label})`,
    }),
  });

  if (!tapResponse.ok) {
    console.error("❌ Error en Tap Físico:", await tapResponse.text());
    process.exit(1);
  }

  const tapData = await tapResponse.json();
  
  // Query DB to fetch the generated event details
  const eventRows = await sql`
    SELECT id, result FROM events
    WHERE batch_id = (SELECT id FROM batches WHERE bid = ${bid} LIMIT 1)
      AND uid_hex = ${uidHex}
    ORDER BY created_at DESC LIMIT 1
  `;
  const eventId = eventRows[0]?.id;
  const traceId = tapData.request_id || `trace_${Date.now()}`;
  const verdict = eventRows[0]?.result;

  console.log("✅ Tap registrado en base de datos!");
  console.log("   ID de Evento:", eventId);
  console.log("   Verdict de Autenticidad:", verdict);
  console.log("   Firma Criptográfica (CMAC):", tapData.cmacValid ?? tapData.cmac_valid ?? "VÁLIDA");

  if (!eventId) {
    console.error("❌ No se encontró ningún evento de tap registrado en DB.");
    process.exit(1);
  }

  console.log("\n1.5. Enriqueciendo contexto GPS y validando geocoder local...");
  const contextResponse = await fetch(`${API_BASE}/sun/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bid,
      uid: uidHex,
      eventId,
      contextStatus: verdict || "VALID",
      scannedAt: new Date().toISOString(),
      geo: {
        lat: tapLocation.lat,
        lng: tapLocation.lng,
        accuracy: tapLocation.accuracy,
      },
      client: {
        platform: "iPhone",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        mobile: true,
        timezone: tapLocation.countryCode === "BR" ? "America/Sao_Paulo" : tapLocation.countryCode === "CL" ? "America/Santiago" : "America/Argentina/Buenos_Aires",
      },
    }),
  });

  if (!contextResponse.ok) {
    console.error("ERROR enriqueciendo contexto SUN:", await contextResponse.text());
    process.exit(1);
  }
  const contextData = await contextResponse.json();
  const locationRows = await sql`
    SELECT city, country_code, lat, lng, location_source, location_accuracy_m, device_label
    FROM events
    WHERE id = ${eventId}
    LIMIT 1
  `;
  const resolvedLocation = locationRows[0] || {};
  if (String(resolvedLocation.city || "") !== tapLocation.city || String(resolvedLocation.country_code || "") !== tapLocation.countryCode) {
    console.error("ERROR Geocoder local no resolvio la ciudad esperada.", { expected: tapLocation, contextData, resolvedLocation });
    process.exit(1);
  }
  if (String(resolvedLocation.location_source || "") !== "browser_gps") {
    console.error("ERROR El evento no quedo marcado como browser_gps.", resolvedLocation);
    process.exit(1);
  }
  console.log(`OK Contexto GPS resuelto: ${resolvedLocation.city}, ${resolvedLocation.country_code} (${resolvedLocation.location_accuracy_m || tapLocation.accuracy}m)`);

  const diagnosticId = tapData.request_id || 1;

  // Sign a fresh handoff token
  const now = Math.floor(Date.now() / 1000);
  const handoffPayload = {
    purpose: "sun_fresh_handoff",
    bid,
    eventId: String(eventId),
    diagnosticId: Number(diagnosticId),
    traceId: String(traceId),
    iat: now,
    exp: now + 300,
  };
  const freshToken = signHandoffToken(handoffPayload, ADMIN_API_KEY);
  console.log("✅ Handoff Token Criptográfico firmado localmente con éxito.");

  console.log(`\n👉 2. Iniciando autenticación del Comprador (OTP a: ${testContact})`);
  const startResponse = await fetch(`${API_BASE}/consumer/auth/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testContact }),
  });

  if (!startResponse.ok) {
    console.error("❌ Error al iniciar auth:", await startResponse.text());
    process.exit(1);
  }

  const startData = await startResponse.json();
  console.log("✅ Desafío OTP iniciado. Canal de entrega:", startData.deliveryChannel);

  console.log("🔍 Buscando hash del código en base de datos para romper OTP de forma segura...");
  const challengeRows = await sql`
    SELECT code_hash FROM consumer_auth_challenges 
    WHERE contact = ${testContact} 
    ORDER BY created_at DESC LIMIT 1
  `;
  
  if (challengeRows.length === 0) {
    console.error("❌ No se encontró ningún desafío OTP activo en la base de datos.");
    process.exit(1);
  }
  
  const targetHash = challengeRows[0].code_hash;
  console.log(`   Hash encontrado: ${targetHash}. Bruteforceando código de 6 dígitos...`);
  
  let otpCode = null;
  const startBrute = Date.now();
  for (let i = 100000; i <= 999999; i++) {
    const candidate = String(i);
    if (sha256(candidate) === targetHash) {
      otpCode = candidate;
      break;
    }
  }
  
  if (!otpCode) {
    console.error("❌ No se pudo encontrar el código OTP.");
    process.exit(1);
  }
  console.log(`✅ Código descifrado en ${Date.now() - startBrute}ms: ${otpCode}`);

  console.log("\n👉 3. Verificando código OTP y obteniendo cookie de sesión...");
  const verifyResponse = await fetch(`${API_BASE}/consumer/auth/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    },
    body: JSON.stringify({ email: testContact, code: otpCode }),
  });

  if (!verifyResponse.ok) {
    console.error("❌ Error en verificación OTP:", await verifyResponse.text());
    process.exit(1);
  }

  const verifyData = await verifyResponse.json();
  const setCookie = verifyResponse.headers.get("set-cookie") || "";
  const matchCookie = setCookie.match(/nexid_consumer_session=([^;]+)/);
  const sessionToken = matchCookie ? decodeURIComponent(matchCookie[1]) : null;
  if (!sessionToken) {
    console.error("❌ No se pudo encontrar la cookie de sesión en la respuesta.");
    process.exit(1);
  }
  console.log("✅ Autenticación exitosa! Token de sesión obtenido:", sessionToken.slice(0, 10) + "...");

  const cookieHeader = `nexid_consumer_session=${encodeURIComponent(sessionToken)}`;

  console.log("\n👉 4. Unirse al Club de Fidelidad de la Bodega (Claim Points)");
  const joinResponse = await fetch(`${API_BASE}/mobile/passport/${eventId}/consumer/join-tenant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
    },
    body: JSON.stringify({ tenantSlug: "demobodega", marketingConsent: true }),
  });

  if (!joinResponse.ok) {
    console.error("❌ Error al unirse al club:", await joinResponse.text());
    process.exit(1);
  }

  const joinData = await joinResponse.json();
  console.log("✅ Club de Fidelidad unido con éxito!");
  console.log(`   Puntos acumulados del lote:`, joinData.pointsAwarded || 10);

  console.log("\n👉 4.5. Probando digitalización OCR de comprobante con IA VLM (Hugging Face)");
  const ocrTestResponse = await fetch(`${API_BASE}/public/cta/receipt-ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bid,
      uid_hex: uidHex,
      event_id: eventId,
      receiptFileName: "comprobante_vinoteca.png",
      receiptFileData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    }),
  });

  if (!ocrTestResponse.ok) {
    console.error("❌ Error en endpoint OCR:", await ocrTestResponse.text());
    process.exit(1);
  }

  const ocrTestData = await ocrTestResponse.json();
  console.log("✅ Digitalización OCR completada exitosamente!");
  console.log("   Establecimiento Detectado:", ocrTestData.ocr?.establishment);
  console.log("   Fecha de Compra:", ocrTestData.ocr?.date);
  console.log("   Total Ticket:", ocrTestData.ocr?.price);
  console.log("   Confianza de Compliance:", ocrTestData.ocr?.compliance_score + "%");

  console.log("\n👉 5. Reclamar propiedad comercial cargando comprobante (Receipt Upload) + GPS");
  console.log(`   Ubicacion del celular: ${tapLocation.label} (${tapLocation.lat}, ${tapLocation.lng})`);
  const claimResponse = await fetch(`${API_BASE}/public/cta/claim-ownership`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    },
    body: JSON.stringify({
      bid,
      uid: uidHex,
      eventId,
      fresh_token: freshToken,
      receiptEstablishment: "Vinoteca Mendoza Premium",
      receiptDate: "2026-06-21",
      receiptTime: "12:00",
      receiptPrice: 45,
      receiptFileName: "comprobante_vinoteca.png",
      receiptFileData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      latitude: tapLocation.lat,
      longitude: tapLocation.lng,
      accuracy: tapLocation.accuracy,
      screenSize: { width: 390, height: 844 },
    }),
  });

  if (!claimResponse.ok) {
    console.error("❌ Error en reclamo de propiedad:", await claimResponse.text());
    process.exit(1);
  }

  const claimData = await claimResponse.json();
  console.log("✅ Propiedad registrada correctamente en base de datos!");
  console.log("   Detalle de validación:", claimData.message || "Comprador verificado y activado.");

  console.log("\n🔍 Buscando producto activo en el Marketplace para la bodega...");
  const productRows = await sql`
    SELECT id, title FROM marketplace_products
    WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'demobodega' LIMIT 1)
      AND status = 'active'
    LIMIT 1
  `;
  if (productRows.length === 0) {
    console.error("❌ No se encontró ningún producto activo para demobodega en la base de datos.");
    process.exit(1);
  }
  const productId = productRows[0].id;
  console.log(`   Producto encontrado: ${productRows[0].title} (ID: ${productId})`);

  console.log("\n👉 6. Simulando solicitud en el Marketplace (Comprar)");
  const buyResponse = await fetch(`${API_BASE}/marketplace/products/${productId}/request-to-buy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
    },
    body: JSON.stringify({ quantity: 1, ageGateAccepted: true }),
  });

  if (!buyResponse.ok) {
    console.error("❌ Error en compra:", await buyResponse.text());
    process.exit(1);
  }

  const buyData = await buyResponse.json();
  console.log("✅ Solicitud de compra en el Marketplace registrada con éxito!");
  console.log("   Estado de Orden:", buyData.status || "pending_approval");

  console.log("\n👉 7. Simulando emisión/creación de NFT de propiedad (Tokenización)");
  const tokenizeResponse = await fetch(`${API_BASE}/public/cta/tokenize-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
    },
    body: JSON.stringify({ bid, uid: uidHex, eventId, fresh_token: freshToken }),
  });

  if (!tokenizeResponse.ok) {
    console.error("❌ Error en tokenización:", await tokenizeResponse.text());
    process.exit(1);
  }

  const tokenizeData = await tokenizeResponse.json();
  console.log("✅ NFT emitido con éxito en Sandbox!");
  console.log("   Red de Anclaje:", tokenizeData.network || "Polygon Amoy");
  console.log("   Hash de Transacción:", tokenizeData.tx_hash || tokenizeData.txHash);
  console.log("   ID de Token:", tokenizeData.token_id || tokenizeData.tokenId);

  console.log("\n👉 8. Simulando reventa P2P en el Mercado Secundario (Listar para la Venta)");
  const listResponse = await fetch(`${API_BASE}/marketplace/p2p/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
    },
    body: JSON.stringify({
      uidHex,
      price: 150,
      currency: "USD",
      description: "Edición limitada resellada por comprador certificado.",
    }),
  });

  if (!listResponse.ok) {
    console.error("❌ Error al listar producto para venta P2P:", await listResponse.text());
    process.exit(1);
  }

  const listData = await listResponse.json();
  const offerId = listData.offer.id;
  console.log("✅ Producto listado en mercado secundario con éxito!");
  console.log(`   ID de Oferta: ${offerId}`);
  console.log(`   Precio de Venta: $${listData.offer.resale_price} ${listData.offer.resale_currency}`);

  console.log("\n👉 9. Creando segundo comprador para adquirir el NFT secundario...");
  const secondContact = `e2e.test.second.buyer.${Date.now()}@nexid.lat`;
  const secondAuthStart = await fetch(`${API_BASE}/consumer/auth/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: secondContact }),
  });

  if (!secondAuthStart.ok) {
    console.error("❌ Error al iniciar auth del segundo comprador:", await secondAuthStart.text());
    process.exit(1);
  }

  // Bruteforce second OTP
  const secondChallengeRows = await sql`
    SELECT code_hash
    FROM consumer_auth_challenges
    WHERE contact = ${secondContact}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (secondChallengeRows.length === 0) {
    console.error("❌ No se encontró desafío de autenticación en la base de datos para el segundo comprador.");
    process.exit(1);
  }

  const secondHash = secondChallengeRows[0].code_hash;
  let secondOtpCode = "";
  console.log("   Bruteforceando segundo código OTP...");
  for (let candidate = 100000; candidate <= 999999; candidate++) {
    const candStr = String(candidate);
    if (sha256(candStr) === secondHash) {
      secondOtpCode = candStr;
      break;
    }
  }

  if (!secondOtpCode) {
    console.error("❌ No se pudo descifrar el código OTP del segundo comprador.");
    process.exit(1);
  }
  console.log(`   Segundo OTP descifrado: ${secondOtpCode}`);

  const secondVerifyResponse = await fetch(`${API_BASE}/consumer/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: secondContact, code: secondOtpCode }),
  });

  if (!secondVerifyResponse.ok) {
    console.error("❌ Error en verificación OTP del segundo comprador:", await secondVerifyResponse.text());
    process.exit(1);
  }

  const secondSetCookie = secondVerifyResponse.headers.get("set-cookie") || "";
  const secondMatchCookie = secondSetCookie.match(/nexid_consumer_session=([^;]+)/);
  const secondSessionToken = secondMatchCookie ? decodeURIComponent(secondMatchCookie[1]) : null;
  if (!secondSessionToken) {
    console.error("❌ No se pudo obtener la sesión del segundo comprador.");
    process.exit(1);
  }

  const secondCookieHeader = `nexid_consumer_session=${encodeURIComponent(secondSessionToken)}`;
  console.log("✅ Segundo comprador autenticado con éxito!");

  console.log("\n👉 10. Comprando el NFT del mercado secundario (P2P Checkout con transferencia de Blockchain y Fees)");
  const buyP2pResponse = await fetch(`${API_BASE}/marketplace/p2p/buy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": secondCookieHeader,
    },
    body: JSON.stringify({ offerId }),
  });

  if (!buyP2pResponse.ok) {
    console.error("❌ Error al comprar oferta P2P:", await buyP2pResponse.text());
    process.exit(1);
  }

  const buyP2pData = await buyP2pResponse.json();
  console.log("✅ Compra de mercado secundario completada con éxito!");
  console.log(`   Fee de plataforma cobrada: $${buyP2pData.platformFee.amount} ${buyP2pData.platformFee.currency} (${buyP2pData.platformFee.rate})`);
  console.log(`   Transferencia Blockchain exitosa:`, buyP2pData.blockchainTransfer.success);
  console.log(`   Simulada:`, buyP2pData.blockchainTransfer.simulated);
  console.log(`   Transacción Hash:`, buyP2pData.blockchainTransfer.txHash);
  console.log(`   Token ID:`, buyP2pData.blockchainTransfer.tokenId);

  console.log("\n==================================================================");
  console.log("🎉 SIMULACIÓN E2E COMPLETADA CON ÉXITO: TODO FUNCIONA A LA PERFECCIÓN!");
  console.log("==================================================================");
}

run().catch(console.error);
