import { NextResponse } from "next/server";
import {
  containsUnverifiedSommelierClaim,
  normalizeSommelierProductContext,
  safeSommelierGuidance,
  type SommelierProductContext,
} from "../../../lib/sommelier-guidance";
import {
  allowLocalServerFundedProviderCalls,
  consumePublicApiRateLimit,
  isJsonRequest,
  isSameOriginRequest,
  parseJsonRecord,
  readBoundedText,
} from "../../../lib/public-api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_CHAT_MODEL = "zai-org/GLM-5.2:together";
const DEFAULT_FAST_CHAT_MODEL = "deepseek-ai/DeepSeek-V4-Flash:deepinfra";
const DEFAULT_FALLBACK_CHAT_MODEL = "google/gemma-4-26B-A4B-it:deepinfra";
const MAX_PAYLOAD_BYTES = 16_384;
const MAX_INPUT_CHARS = 6_000;
const MAX_CUSTOM_TOKEN_CHARS = 512;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX = 20;
const ALLOWED_TONES = new Set(["", "sommelier", "sommelier-chat", "club-privado", "vip-club", "modern-web3"]);

function json(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function allowedModels() {
  return new Set([
    DEFAULT_CHAT_MODEL,
    DEFAULT_FAST_CHAT_MODEL,
    DEFAULT_FALLBACK_CHAT_MODEL,
    clean(process.env.HF_CHAT_MODEL),
    clean(process.env.HF_FAST_CHAT_MODEL),
    clean(process.env.HF_FALLBACK_CHAT_MODEL),
  ].filter(Boolean));
}

function isClubTone(tone?: string) {
  return tone === "club-privado" || tone === "vip-club";
}

function fallbackOptimizedText(text: string, tone?: string, productContext: SommelierProductContext = {}) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (tone === "sommelier-chat") {
    return safeSommelierGuidance(clean, productContext);
  }
  if (tone === "sommelier") {
    return `Propuesta premium: ${clean || "descripción pendiente de datos del producto"}. Conserva únicamente la información declarada; origen, crianza, terroir, notas y premios requieren una ficha verificada.`;
  }
  if (isClubTone(tone)) {
    return `Invitacion cuidada: ${clean || "beneficio exclusivo"} con cupos limitados, acceso preferencial y trato directo de la marca.`;
  }
  if (tone === "modern-web3") {
    return `Experiencia phygital: ${clean || "producto con identidad digital pendiente de contexto"}. Puede vincular un pasaporte y evidencia técnica cuando estén confirmados; no implica autenticidad física ni ownership.`;
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
  if (tone === "sommelier-chat") {
    return "Sos un asistente de orientación enológica. El contexto de producto incluido en el mensaje fue declarado por el cliente y no prueba autenticidad ni aporta una ficha técnica. Respondé en español rioplatense y limita la respuesta a 450 caracteres. No inventes ni afirmes origen, bodega, añada, terroir, premios, puntajes, certificaciones, crianza, barrica, notas de cata, temperatura exacta, potencial de guarda o composición. Si el dato no fue suministrado en una ficha verificada, decí que no está verificado y brinda sólo orientación general.";
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
  const providerCallsEnabled = allowLocalServerFundedProviderCalls();
  const configured = providerCallsEnabled && Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY);
  return NextResponse.json({
    ok: true,
    provider: "huggingface-router",
    configured,
    providerCallsEnabled,
    authorization: providerCallsEnabled ? "local_opt_in" : "production_fallback_only",
    defaultModel: process.env.HF_CHAT_MODEL || DEFAULT_CHAT_MODEL,
    fastModel: process.env.HF_FAST_CHAT_MODEL || DEFAULT_FAST_CHAT_MODEL,
    fallbackModel: process.env.HF_FALLBACK_CHAT_MODEL || DEFAULT_FALLBACK_CHAT_MODEL,
  });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  let sommelierContext: SommelierProductContext = {};
  try {
    if (!isSameOriginRequest(req)) return json({ error: "forbidden" }, 403);
    if (!isJsonRequest(req)) return json({ error: "unsupported_media_type" }, 415);

    const retryAfter = consumePublicApiRateLimit("cognitive-ai", req, {
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (retryAfter > 0) return json({ error: "rate_limited" }, 429, { "retry-after": String(retryAfter) });

    const bounded = await readBoundedText(req, MAX_PAYLOAD_BYTES);
    if (!bounded.ok) return json({ error: bounded.reason }, bounded.status);
    const payload = parseJsonRecord(bounded.text);
    if (!payload) return json({ error: "invalid_json" }, 400);

    const text = clean(payload.text);
    const tone = clean(payload.tone);
    const customToken = clean(payload.customToken);
    const reqModel = clean(payload.model);
    const productContext = payload.productContext;

    if (!ALLOWED_TONES.has(tone)) return json({ error: "unsupported_tone" }, 400);
    if (text.length > MAX_INPUT_CHARS) return json({ error: "text_too_long" }, 413);
    if (customToken.length > MAX_CUSTOM_TOKEN_CHARS || /\s/.test(customToken)) {
      return json({ error: "invalid_custom_token" }, 400);
    }
    if (reqModel && !allowedModels().has(reqModel)) return json({ error: "unsupported_model" }, 400);

    sommelierContext = normalizeSommelierProductContext(productContext);

    if (!text) {
      return json({ error: "Text is required" }, 400);
    }

    if (!allowLocalServerFundedProviderCalls()) {
      console.info("[cognitive_ai]", JSON.stringify({ event: "fallback", reason: "provider_requires_distributed_authorization", tone, durationMs: Date.now() - startedAt }));
      return json({
        optimizedText: fallbackOptimizedText(text, tone, sommelierContext),
        fallback: true,
        reason: "provider_requires_distributed_authorization",
      });
    }

    const hfToken = customToken || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
      console.info("[cognitive_ai]", JSON.stringify({ event: "fallback", reason: "hugging_face_token_missing", tone, durationMs: Date.now() - startedAt }));
      return json({ optimizedText: fallbackOptimizedText(text, tone, sommelierContext), fallback: true, reason: "hugging_face_token_missing" });
    }

    const model = reqModel || (tone === "sommelier-chat"
      ? process.env.HF_FAST_CHAT_MODEL || DEFAULT_FAST_CHAT_MODEL
      : process.env.HF_CHAT_MODEL || DEFAULT_CHAT_MODEL);
    const fallbackModel = process.env.HF_FALLBACK_CHAT_MODEL || DEFAULT_FALLBACK_CHAT_MODEL;
    const candidateModels = Array.from(new Set([model, fallbackModel].filter(Boolean)));

    let lastReason = "hugging_face_empty_response";
    for (const candidateModel of candidateModels) {
      const response = await postHuggingFaceChat(hfToken, {
        model: candidateModel,
        messages: [
          { role: "system", content: buildPrompt(tone) },
          {
            role: "user",
            content: tone === "sommelier-chat"
              ? JSON.stringify({ question: String(text), declaredProductContext: sommelierContext })
              : String(text),
          },
        ],
        max_tokens: tokenBudgetFor(candidateModel),
        temperature: tone === "sommelier-chat" ? 0.45 : 0.65,
      });

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        lastReason = `hugging_face_${response.status}`;
        console.error("[cognitive_ai] provider request failed", { model: candidateModel, status: response.status });
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

      if (tone === "sommelier-chat" && containsUnverifiedSommelierClaim(cleanText)) {
        console.info("[cognitive_ai]", JSON.stringify({ event: "fallback", reason: "unverified_product_claim_blocked", model: candidateModel, tone, durationMs: Date.now() - startedAt }));
        return json({
          optimizedText: safeSommelierGuidance(String(text), sommelierContext),
          fallback: true,
          reason: "unverified_product_claim_blocked",
          model: candidateModel,
        });
      }

      console.info("[cognitive_ai]", JSON.stringify({ event: "success", provider: "huggingface-router", model: candidateModel, tone, modelFallback: candidateModel !== model, durationMs: Date.now() - startedAt }));
      return json({
        optimizedText: cleanText,
        fallback: false,
        provider: "huggingface-router",
        model: candidateModel,
        modelFallback: candidateModel !== model,
      });
    }

    console.info("[cognitive_ai]", JSON.stringify({ event: "fallback", reason: lastReason, model, tone, durationMs: Date.now() - startedAt }));
    return json({ optimizedText: fallbackOptimizedText(text, tone, sommelierContext), fallback: true, reason: lastReason, model });
  } catch (error: unknown) {
    console.error("[cognitive_ai] request failed", error instanceof Error ? error.name : "unknown_error");
    return json({ optimizedText: fallbackOptimizedText("", "sommelier-chat", sommelierContext), fallback: true, reason: "cognitive_ai_error" });
  }
}
