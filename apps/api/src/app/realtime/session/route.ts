export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readRequestTextBounded } from "../../../lib/bounded-request-body";

const MAX_SDP_BYTES = 64 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 128 * 1024;
const SUPPORTED_LOCALES = new Set(["es-AR", "pt-BR", "en"]);

function productionRuntime() {
  return process.env.NODE_ENV === "production"
    || String(process.env.VERCEL_ENV || "").trim().toLowerCase() === "production";
}

function allowedBrowserOrigins() {
  const configured = [
    process.env.NEXID_PUBLIC_WEB_URL,
    process.env.NEXT_PUBLIC_WEB_URL,
    process.env.NEXT_PUBLIC_WEB_BASE_URL,
    process.env.WEB_BASE_URL,
    "https://nexid.lat",
    "https://www.nexid.lat",
  ];
  const origins = new Set<string>();
  for (const value of configured) {
    try {
      if (value) origins.add(new URL(String(value).trim()).origin);
    } catch {
      // Invalid configured origins are ignored rather than weakening the check.
    }
  }
  if (!productionRuntime()) {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return origins;
}

function authorizedRealtimeCaller(req: Request) {
  if (req.headers.get("x-nexid-edge-verified") === "1") return true;
  const origin = String(req.headers.get("origin") || "").trim();
  if (!origin) return false;
  try {
    return allowedBrowserOrigins().has(new URL(origin).origin);
  } catch {
    return false;
  }
}

function errorResponse(reason: string, status: number) {
  return Response.json({ ok: false, error: reason }, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function realtimeInstructions(locale: string) {
  if (locale === "en") {
    return [
      "You are nexID Realtime Sales AI. Speak naturally and briefly.",
      "Your job is to qualify prospects for NFC product digitization, quotes, samples, reseller channel and private meetings.",
      "Never answer as a generic payments or crypto bot. If asked about 215 vs 424: 215 is BASIC NFC for simple serialized taps; 424 DNA/TagTamper adds dynamic SUN/SDM message evidence, copy/replay resistance and a reported TT state. It does not by itself certify the physical product, seal or contents; warranty and ownership still require policy and supporting evidence.",
      "Ask for name, company, country, vertical, estimated volume, tag profile and contact. Offer a private meeting when the lead is serious.",
      "Do not invent exact unit pricing. Explain that pricing depends on volume, tag profile and encoding/onboarding needs.",
    ].join(" ");
  }
  if (locale === "pt-BR") {
    return [
      "Voce e o NexID Realtime Sales AI. Fale de forma natural e breve.",
      "Qualifique prospects para digitalizacao de produtos NFC, proposta, amostras, canal revenda e reunioes privadas.",
      "Nunca responda como bot generico de pagamento ou cripto. Sobre 215 vs 424: 215 e BASIC NFC para taps simples; 424 DNA/TagTamper adiciona evidencia dinamica de mensagem SUN/SDM, resistencia a copia/replay e estado TT reportado. Nao certifica sozinho o produto fisico, o lacre ou o conteudo; garantia e ownership ainda exigem politica e evidencia adicional.",
      "Peça nome, empresa, pais, vertical, volume estimado, perfil de tag e contato. Ofereca reuniao privada quando houver intencao real.",
      "Nao invente preco unitario exato; depende de volume, tag profile, encoding e onboarding.",
    ].join(" ");
  }
  return [
    "Sos NexID Realtime Sales AI. Habla natural, corto y concreto.",
    "Tu trabajo es calificar prospectos para digitalizacion NFC de productos, cotizacion, muestras, canal reseller y reuniones privadas.",
    "Nunca respondas como bot generico de pagos o cripto. Si preguntan 215 vs 424: 215 es BASIC NFC para taps simples serializados; 424 DNA/TagTamper agrega evidencia dinamica de mensaje SUN/SDM, resistencia a copia/replay y estado TT reportado. No certifica por si solo el producto fisico, el sello ni el contenido; garantia y ownership requieren politica y evidencia adicional.",
    "Pedi nombre, empresa, pais, vertical, volumen estimado, perfil de tag y contacto. Ofrece reunion privada cuando el lead sea serio.",
    "No inventes precio unitario exacto; depende de volumen, tag profile, encoding y onboarding.",
  ].join(" ");
}

export async function POST(req: Request) {
  if (productionRuntime() && process.env.NEXID_REALTIME_PUBLIC_ENABLED !== "true") {
    return errorResponse("realtime_public_not_enabled", 503);
  }
  if (!authorizedRealtimeCaller(req)) return errorResponse("realtime_origin_not_allowed", 403);
  if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/sdp")) {
    return errorResponse("unsupported_media_type", 415);
  }

  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "ai_expensive",
    tenantId: "platform",
    subjectId: "realtime-session:public",
  });
  if (rateLimited) return rateLimited;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return errorResponse("realtime_provider_not_configured", 503);
  }

  let offerSdp = "";
  try {
    offerSdp = await readRequestTextBounded(req, MAX_SDP_BYTES);
  } catch (error) {
    return errorResponse(error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_sdp_encoding", error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  if (!offerSdp.trim()) {
    return errorResponse("missing_sdp", 400);
  }
  if (!offerSdp.trimStart().startsWith("v=0") || offerSdp.includes("\0")) {
    return errorResponse("invalid_sdp", 400);
  }

  const requestedLocale = String(req.headers.get("x-nexid-locale") || "es-AR").trim();
  if (!SUPPORTED_LOCALES.has(requestedLocale)) return errorResponse("unsupported_locale", 400);
  const locale = requestedLocale;
  const session = {
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2",
    instructions: realtimeInstructions(locale),
    audio: {
      output: {
        voice: process.env.OPENAI_REALTIME_VOICE || "marin",
      },
    },
  };

  const form = new FormData();
  form.set("sdp", offerSdp);
  form.set("session", JSON.stringify(session));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      cache: "no-store",
      signal: controller.signal,
    });

    const declaredLength = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      return errorResponse("realtime_provider_response_too_large", 502);
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
      return errorResponse("realtime_provider_response_too_large", 502);
    }
    if (!response.ok) {
      return errorResponse(response.status === 429 ? "realtime_provider_rate_limited" : "realtime_provider_failed", response.status === 429 ? 429 : 502);
    }

    return new Response(text, {
      status: 200,
      headers: { "cache-control": "no-store", "Content-Type": "application/sdp" },
    });
  } catch (error) {
    return errorResponse(error instanceof Error && error.name === "AbortError" ? "realtime_provider_timeout" : "realtime_provider_unavailable", 503);
  } finally {
    clearTimeout(timeout);
  }
}
