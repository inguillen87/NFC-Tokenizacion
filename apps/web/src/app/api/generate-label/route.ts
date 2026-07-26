import { NextResponse } from "next/server";
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

const HF_IMAGE_BASE_URL = "https://router.huggingface.co/hf-inference/models";
const MAX_PAYLOAD_BYTES = 16_384;
const MAX_PROMPT_CHARS = 2_000;
const MAX_CUSTOM_TOKEN_CHARS = 512;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX = 5;

function json(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function fallbackLabelImage(prompt: string) {
  const clean = String(prompt || "Etiqueta nexID").replace(/[<>&"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#0b1220"/><rect x="86" y="86" width="852" height="852" rx="36" fill="#111827" stroke="#22d3ee" stroke-width="6"/><text x="512" y="250" fill="#a7f3d0" font-family="Arial, sans-serif" font-size="44" font-weight="700" text-anchor="middle">nexID</text><text x="512" y="340" fill="#ffffff" font-family="Arial, sans-serif" font-size="36" font-weight="700" text-anchor="middle">Etiqueta generada localmente</text><foreignObject x="170" y="420" width="684" height="260"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:#cbd5e1;font-size:30px;line-height:1.35;text-align:center">${clean || "Identidad digital, evidencia NFC y trazabilidad declarada."}</div></foreignObject><text x="512" y="810" fill="#67e8f9" font-family="Arial, sans-serif" font-size="28" text-anchor="middle">Fallback seguro si Hugging Face no responde</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) return json({ error: "forbidden" }, 403);
    if (!isJsonRequest(req)) return json({ error: "unsupported_media_type" }, 415);

    const retryAfter = consumePublicApiRateLimit("generate-label", req, {
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (retryAfter > 0) return json({ error: "rate_limited" }, 429, { "retry-after": String(retryAfter) });

    const bounded = await readBoundedText(req, MAX_PAYLOAD_BYTES);
    if (!bounded.ok) return json({ error: bounded.reason }, bounded.status);
    const payload = parseJsonRecord(bounded.text);
    if (!payload) return json({ error: "invalid_json" }, 400);

    const prompt = clean(payload.prompt);
    const customToken = clean(payload.customToken);

    if (!prompt) {
      return json({ error: "Prompt is required" }, 400);
    }
    if (prompt.length > MAX_PROMPT_CHARS) return json({ error: "prompt_too_long" }, 413);
    if (customToken.length > MAX_CUSTOM_TOKEN_CHARS || /\s/.test(customToken)) {
      return json({ error: "invalid_custom_token" }, 400);
    }

    if (!allowLocalServerFundedProviderCalls()) {
      return json({
        imageUrl: fallbackLabelImage(prompt),
        fallback: true,
        reason: "provider_requires_distributed_authorization",
      });
    }

    // Local development only: deployed public routes never spend a server-owned
    // provider credential until distributed quota and signed caller auth exist.
    const hfToken = customToken || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
      return json({ imageUrl: fallbackLabelImage(prompt), fallback: true, reason: "hugging_face_token_missing" });
    }

    const configuredModel = process.env.HF_IMAGE_MODEL?.trim();
    const models = [
      configuredModel,
      "black-forest-labs/FLUX.1-schnell",
      "stabilityai/stable-diffusion-xl-base-1.0"
    ].filter(Boolean) as string[];

    let imageBuffer: ArrayBuffer | null = null;
    let successfulModel: string | null = null;
    let lastReason = "hugging_face_generation_failed";

    for (const model of models) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
        const response = await fetch(`${HF_IMAGE_BASE_URL}/${model}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: prompt }),
          cache: "no-store",
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        if (response.ok) {
          const contentType = response.headers.get("content-type") || "";
          const declaredBytes = Number(response.headers.get("content-length") || "0");
          if (contentType.startsWith("image/") && (!Number.isFinite(declaredBytes) || declaredBytes <= MAX_IMAGE_BYTES)) {
            const candidateBuffer = await response.arrayBuffer();
            if (candidateBuffer.byteLength > MAX_IMAGE_BYTES) {
              lastReason = "hugging_face_image_too_large";
              continue;
            }
            imageBuffer = candidateBuffer;
            successfulModel = model;
            break;
          } else {
            await response.body?.cancel().catch(() => undefined);
            lastReason = declaredBytes > MAX_IMAGE_BYTES ? "hugging_face_image_too_large" : "hugging_face_invalid_content_type";
          }
        } else {
          await response.body?.cancel().catch(() => undefined);
          lastReason = `hugging_face_${response.status}`;
          console.warn("[generate-label] provider request failed", { model, status: response.status });
        }
      } catch (error: unknown) {
        lastReason = error instanceof Error && error.name === "AbortError" ? "hugging_face_timeout" : "hugging_face_request_failed";
        console.warn("[generate-label] provider request failed", { model, reason: lastReason });
      }
    }

    if (!imageBuffer) {
      return json({ imageUrl: fallbackLabelImage(prompt), fallback: true, reason: lastReason });
    }

    // Convert binary buffer to base64 data URL
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    return json({
      imageUrl,
      fallback: false,
      provider: "huggingface-inference",
      model: successfulModel,
    });
  } catch (error: unknown) {
    console.error("[generate-label] request failed", error instanceof Error ? error.name : "unknown_error");
    return json({ imageUrl: fallbackLabelImage("Etiqueta nexID"), fallback: true, reason: "label_generation_error" });
  }
}
