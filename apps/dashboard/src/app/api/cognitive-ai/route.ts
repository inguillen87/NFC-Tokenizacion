import { NextResponse } from "next/server";
import { getDashboardSession } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_CHAT_MODEL = "zai-org/GLM-5.2:together";
const DEFAULT_FALLBACK_CHAT_MODEL = "google/gemma-4-26B-A4B-it:deepinfra";
const MAX_BODY_BYTES = 16_384;
const MAX_TEXT_CHARS = 6_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
const MAX_RATE_BUCKETS = 4_096;
const ALLOWED_TONES = new Set(["", "sommelier", "club-privado", "vip-club", "modern-web3", "executive-summary"]);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

function consumeRateLimit(key: string, now = Date.now()) {
  if (!rateBuckets.has(key) && rateBuckets.size >= MAX_RATE_BUCKETS) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
    while (rateBuckets.size >= MAX_RATE_BUCKETS) {
      const oldest = rateBuckets.keys().next().value as string | undefined;
      if (!oldest) break;
      rateBuckets.delete(oldest);
    }
  }
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return 0;
  }
  if (current.count >= RATE_MAX) return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  current.count += 1;
  return 0;
}

async function readBoundedJson(req: Request) {
  const declared = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { ok: false as const, reason: "payload_too_large" };
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return { ok: false as const, reason: "payload_too_large" };
  try {
    const body = JSON.parse(raw) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false as const, reason: "invalid_json" };
    return { ok: true as const, body: body as Record<string, unknown> };
  } catch {
    return { ok: false as const, reason: "invalid_json" };
  }
}

function isClubTone(tone?: string) {
  return tone === "club-privado" || tone === "vip-club";
}

function fallbackOptimizedText(text: string, tone?: string) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (tone === "sommelier") {
    return `Versión premium: ${clean || "descripción pendiente de datos del producto"}. Conserva únicamente la información declarada; origen, crianza, notas y premios requieren una ficha verificada.`;
  }
  if (isClubTone(tone)) {
    return `Invitacion cuidada: ${clean || "beneficio exclusivo"} con cupos limitados, acceso preferencial y trato directo de la marca.`;
  }
  if (tone === "modern-web3") {
    return `Experiencia phygital: ${clean || "producto con identidad digital pendiente de contexto"}. Puede vincular un pasaporte y evidencia técnica cuando estén confirmados; no implica autenticidad física ni ownership.`;
  }
  if (tone === "executive-summary") {
    return `Resumen determinístico local: ${clean || "no se recibieron KPIs suficientes"}. El proveedor de IA no confirmó un análisis. Revisá los valores del dataset antes de clasificar salud operativa, nivel de riesgo o desempeño, y definí la próxima acción con evidencia del scope activo.`;
  }
  return clean || "Texto premium generado localmente.";
}

function extractModelText(data: any) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.content === "string") return item.content;
        return "";
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (typeof data?.choices?.[0]?.text === "string") return data.choices[0].text.trim();
  if (typeof data?.output_text === "string") return data.output_text.trim();
  return "";
}

function buildPrompt(tone?: string) {
  if (tone === "sommelier") {
    return "Sos un sommelier enologo de lujo. Reescribi el texto en espanol para una bodega premium. Usa solo datos presentes en el texto: no inventes bodega, finca, terroir, premios, certificaciones, origen, proceso, anada ni propiedad. No uses garantizado, 100%, certificado o autentico si el input no lo afirma. Mejora tono, claridad y utilidad.";
  }
  if (isClubTone(tone)) {
    return "Sos estratega de fidelizacion premium. Reescribi el texto en espanol con exclusividad, cupos limitados y acceso preferencial, sin prometer propiedad ni beneficios no verificados.";
  }
  if (tone === "modern-web3") {
    return "Sos arquitecto de producto phygital. Reescribi el texto en espanol explicando pasaporte digital, trazabilidad, evidencia tecnica y tokenizacion opcional. No prometas ownership si no hay prueba de compra.";
  }
  if (tone === "executive-summary") {
    return "Sos un consultor de negocios y analista estratégico experto en retail, trazabilidad y Web3. Analizá los KPIs y métricas proporcionados del sistema de autenticación de tags NFC de la bodega. Proporcioná un resumen ejecutivo sumamente claro, ejecutivo y conciso de 2 o 3 párrafos en español rioplatense. Detallá la salud operativa (taps totales, tasa de lecturas válidas), el nivel de alertas de riesgo (duplicados, tamper, dispersión geográfica) y una recomendación de acción estratégica concreta y proactiva para el negocio (ej. cómo fidelizar mejor o dónde ajustar la seguridad). No inventes datos que no estén presentes en las métricas de entrada.";
  }
  return "Reescribi el texto en espanol para una marca premium. Debe sonar claro, sofisticado y util. No inventes datos, certificaciones, premios, origen, proceso, beneficios, propiedad ni claims no incluidos. No uses garantizado, 100%, certificado o autentico si el input no lo afirma.";
}

async function postHuggingFaceChat(hfToken: string, payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    return await fetch(HF_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function tokenBudgetFor(model: string) {
  return /glm-5\.2/i.test(model) ? 1024 : 512;
}

export async function GET() {
  const session = await getDashboardSession();
  if (!session) return NextResponse.json({ ok: false, reason: "dashboard_session_required" }, { status: 401 });
  const configured = Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY);
  return NextResponse.json({
    ok: true,
    provider: "huggingface-router",
    configured: configured && !session.isDemo,
    defaultModel: process.env.HF_CHAT_MODEL || DEFAULT_CHAT_MODEL,
    fallbackModel: process.env.HF_FALLBACK_CHAT_MODEL || DEFAULT_FALLBACK_CHAT_MODEL,
  });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "same_origin_required" }, { status: 403 });
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ error: "dashboard_session_required" }, { status: 401 });
    const retryAfter = consumeRateLimit(session.id);
    if (retryAfter > 0) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(retryAfter) } });
    }
    const parsed = await readBoundedJson(req);
    if (!parsed.ok) return NextResponse.json({ error: parsed.reason }, { status: parsed.reason === "payload_too_large" ? 413 : 400 });
    const text = String(parsed.body.text || "").trim();
    const tone = String(parsed.body.tone || "").trim();

    if (!text) return NextResponse.json({ error: "text_required" }, { status: 400 });
    if (text.length > MAX_TEXT_CHARS) return NextResponse.json({ error: "text_too_long" }, { status: 413 });
    if (!ALLOWED_TONES.has(tone)) return NextResponse.json({ error: "unsupported_tone" }, { status: 400 });

    if (session.isDemo) {
      return NextResponse.json({ optimizedText: fallbackOptimizedText(text, tone), fallback: true, reason: "demo_session_local_only" });
    }

    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
      console.info("[cognitive_ai]", JSON.stringify({ event: "fallback", reason: "hugging_face_token_missing", tone, durationMs: Date.now() - startedAt }));
      return NextResponse.json({ optimizedText: fallbackOptimizedText(text, tone), fallback: true, reason: "hugging_face_token_missing" });
    }

    const model = process.env.HF_CHAT_MODEL || DEFAULT_CHAT_MODEL;
    const fallbackModel = process.env.HF_FALLBACK_CHAT_MODEL || DEFAULT_FALLBACK_CHAT_MODEL;
    const candidateModels = Array.from(new Set([model, fallbackModel].filter(Boolean)));

    let lastReason = "hugging_face_empty_response";
    for (const candidateModel of candidateModels) {
      const response = await postHuggingFaceChat(hfToken, {
        model: candidateModel,
        messages: [
          { role: "system", content: buildPrompt(tone) },
          { role: "user", content: `Reescribi este borrador manteniendo la intencion original, pero elevando su nivel a premium:\n\n"${String(text)}"` },
        ],
        max_tokens: tokenBudgetFor(candidateModel),
        temperature: 0.65,
      });

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        lastReason = `hugging_face_${response.status}`;
        const attemptLog = JSON.stringify({
          event: "provider_attempt_failed",
          provider: "huggingface-router",
          model: candidateModel,
          status: response.status,
          retryable: response.status === 429 || response.status >= 500,
        });
        if (response.status === 402 || response.status === 429) console.info("[cognitive_ai]", attemptLog);
        else console.warn("[cognitive_ai]", attemptLog);
        continue;
      }

      const data = await response.json();
      const optimizedText = extractModelText(data);
      if (!optimizedText) {
        lastReason = "hugging_face_empty_response";
        continue;
      }

      let cleanText = optimizedText;
      if (cleanText.startsWith("\"") && cleanText.endsWith("\"")) {
        cleanText = cleanText.slice(1, -1);
      }

      console.info("[cognitive_ai]", JSON.stringify({ event: "success", provider: "huggingface-router", model: candidateModel, tone, modelFallback: candidateModel !== model, durationMs: Date.now() - startedAt }));
      return NextResponse.json({ optimizedText: cleanText, provider: "huggingface-router", model: candidateModel, modelFallback: candidateModel !== model, fallback: false });
    }

    console.info("[cognitive_ai]", JSON.stringify({ event: "fallback", reason: lastReason, model, tone, durationMs: Date.now() - startedAt }));
    return NextResponse.json({ optimizedText: fallbackOptimizedText(text, tone), fallback: true, reason: lastReason, model });
  } catch (error: any) {
    console.warn("[cognitive_ai]", JSON.stringify({ event: "fallback", reason: "route_exception", errorType: error instanceof Error ? error.name : "unknown" }));
    return NextResponse.json({ optimizedText: fallbackOptimizedText("", "sommelier"), fallback: true, reason: "cognitive_ai_error" });
  }
}
