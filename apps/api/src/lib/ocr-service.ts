export type OcrProvenance = {
  mode: "live_confirmed" | "demo_mock" | "unavailable";
  confirmed: boolean;
  provider: "huggingface-router" | null;
  model: string | null;
};

export type OcrResult = {
  establishment: string | null;
  date: string | null;
  time: string | null;
  price: number | null;
  products: string[];
  is_invoice: boolean;
  compliance_score: number;
  product_matched: boolean;
  reason: string;
  review_required: boolean;
  provenance: OcrProvenance;
};

export type ReceiptOcrOwnershipDecision =
  {
      ok: false;
      reason:
        | "receipt_verification_unavailable"
        | "receipt_demo_only_not_claimable"
        | "receipt_not_valid"
        | "receipt_product_mismatch"
        | "receipt_manual_review_required";
      status: 400 | 409 | 422 | 503;
      message: string;
      reviewRequired: boolean;
    };

type ReceiptOcrOptions = {
  allowDemoMock?: boolean;
};

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_VISION_MODEL = "Qwen/Qwen2-VL-7B-Instruct";
const FALLBACK_VISION_MODEL = "meta-llama/Llama-3.2-11B-Vision-Instruct";
export const MIN_RECEIPT_OWNERSHIP_SCORE = 75;
export const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;
const RECEIPT_IMAGE_DATA_URL_RE = /^data:(image\/(?:png|jpeg|webp|heic|heif));base64,([A-Za-z0-9+/]*={0,2})$/i;

export function validateReceiptImageDataUrl(value: unknown) {
  if (typeof value !== "string") {
    return { ok: false as const, reason: "receipt_file_data_required", status: 400 as const };
  }
  const match = value.match(RECEIPT_IMAGE_DATA_URL_RE);
  if (!match) {
    return { ok: false as const, reason: "receipt_image_format_invalid", status: 415 as const };
  }
  const payload = match[2];
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((payload.length * 3) / 4) - padding;
  if (decodedBytes < 1) {
    return { ok: false as const, reason: "receipt_image_empty", status: 400 as const };
  }
  if (decodedBytes > MAX_RECEIPT_IMAGE_BYTES) {
    return { ok: false as const, reason: "receipt_image_too_large", status: 413 as const };
  }
  return {
    ok: true as const,
    dataUrl: value,
    mimeType: match[1].toLowerCase(),
    decodedBytes,
  };
}

function cleanOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean ? clean.slice(0, 500) : null;
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production"
    || String(process.env.VERCEL_ENV || "").trim().toLowerCase() === "production";
}

function demoMockAllowed(options: ReceiptOcrOptions) {
  return options.allowDemoMock === true
    && process.env.OCR_ALLOW_DEMO_MOCK === "true"
    && !isProductionRuntime();
}

function unavailableOcrResult(reason: string): OcrResult {
  return {
    establishment: null,
    date: null,
    time: null,
    price: null,
    products: [],
    is_invoice: false,
    compliance_score: 0,
    product_matched: false,
    reason,
    review_required: true,
    provenance: {
      mode: "unavailable",
      confirmed: false,
      provider: null,
      model: null,
    },
  };
}

function demoMockOcrResult(reason: string): OcrResult {
  return {
    establishment: "Vinoteca Mendoza (Simulado)",
    date: new Date().toISOString().split("T")[0],
    time: "20:15",
    price: 34500,
    products: ["Gran Reserva Malbec", "Vino Tinto"],
    is_invoice: true,
    compliance_score: 95,
    product_matched: true,
    reason,
    review_required: true,
    provenance: {
      mode: "demo_mock",
      confirmed: false,
      provider: null,
      model: null,
    },
  };
}

function parseConfirmedProviderResult(value: unknown, model: string): OcrResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = value as Record<string, unknown>;
  if (typeof parsed.is_invoice !== "boolean") return null;
  if (typeof parsed.product_matched !== "boolean") return null;
  if (typeof parsed.compliance_score !== "number"
    || !Number.isFinite(parsed.compliance_score)
    || parsed.compliance_score < 0
    || parsed.compliance_score > 100) return null;
  if (!Array.isArray(parsed.products) || parsed.products.some((item) => typeof item !== "string")) return null;
  if (parsed.price !== null && parsed.price !== undefined
    && (typeof parsed.price !== "number" || !Number.isFinite(parsed.price))) return null;

  return {
    establishment: cleanOptionalString(parsed.establishment),
    date: cleanOptionalString(parsed.date),
    time: cleanOptionalString(parsed.time),
    price: typeof parsed.price === "number" ? parsed.price : null,
    products: parsed.products.map((item) => item.trim().slice(0, 500)).filter(Boolean).slice(0, 100),
    is_invoice: parsed.is_invoice,
    product_matched: parsed.product_matched,
    compliance_score: parsed.compliance_score,
    reason: `hugging_face_vlm:${model}`,
    review_required: false,
    provenance: {
      mode: "live_confirmed",
      confirmed: true,
      provider: "huggingface-router",
      model,
    },
  };
}

export function evaluateReceiptOcrForOwnership(
  result: OcrResult | null | undefined,
): ReceiptOcrOwnershipDecision {
  if (!result || result.provenance.mode === "unavailable") {
    return {
      ok: false,
      reason: "receipt_verification_unavailable",
      status: 503,
      message: "No pudimos confirmar el comprobante con el proveedor. No se creó la propiedad. Reintentá o envialo a revisión manual.",
      reviewRequired: true,
    };
  }
  if (result.provenance.mode === "demo_mock") {
    return {
      ok: false,
      reason: "receipt_demo_only_not_claimable",
      status: 409,
      message: "El resultado pertenece a una demostración y no puede habilitar propiedad real.",
      reviewRequired: true,
    };
  }
  if (!result.provenance.confirmed || !result.provenance.provider || !result.provenance.model) {
    return {
      ok: false,
      reason: "receipt_verification_unavailable",
      status: 503,
      message: "El proveedor o modelo no quedaron confirmados. No se creó la propiedad. Reintentá o envialo a revisión manual.",
      reviewRequired: true,
    };
  }
  return {
    ok: false,
    reason: "receipt_manual_review_required",
    status: 422,
    message: "El OCR extrajo datos para asistir la revisión, pero no valida el pago, el comercio ni la custodia. Ownership requiere POS firmado, PIN o aprobación manual del tenant.",
    reviewRequired: true,
  };
}

export async function performReceiptOcr(
  base64DataUrl: string,
  expectedProduct?: string | null,
  expectedWinery?: string | null,
  fileName?: string | null,
  options: ReceiptOcrOptions = {},
): Promise<OcrResult> {
  const allowDemoMock = demoMockAllowed(options);
  const isKnownTestAsset = fileName === "comprobante_vinoteca.png"
    || base64DataUrl.includes("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
  if (isKnownTestAsset && allowDemoMock) {
    return demoMockOcrResult("explicit_demo_test_asset");
  }

  const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
  if (!hfToken) {
    return allowDemoMock
      ? demoMockOcrResult("explicit_demo_provider_unavailable")
      : unavailableOcrResult("hugging_face_token_missing");
  }

  const match = base64DataUrl.match(/^data:([^;]+);base64,(.*)$/);
  let mimeType = "image/jpeg";
  let base64Data = base64DataUrl;
  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  const prompt = `Act as an expert compliance audit OCR assistant.
Analyze the uploaded purchase receipt/ticket image.
Your goal is to extract key data and check compliance for:
- Scanned product: "${expectedProduct || "Gran Reserva Malbec"}"
- Winery/Brand: "${expectedWinery || "Bodega Demo"}"

Extract:
1. "establishment": Retailer or shop name (string or null).
2. "date": Date of purchase in YYYY-MM-DD format (string or null).
3. "time": Time of purchase in HH:MM format (string or null).
4. "price": Total amount paid (number/float or null).
5. "products": List of items printed on the receipt (array of strings).
6. "is_invoice": True if the image is a valid purchase ticket, invoice, or receipt (boolean).
7. "product_matched": True if the scanned product or winery brand is detected/mentioned in the products (boolean).
8. "compliance_score": Model-reported extraction confidence from 0 to 100 (number). This is not payment, retailer, custody or ownership validation.

Return ONLY a raw JSON object matching this structure. Do not use markdown wrappers, code blocks, or triple backticks. If you cannot parse every required verification field, return false values and score 0.
JSON:`;

  const candidateModels = [DEFAULT_VISION_MODEL, FALLBACK_VISION_MODEL];
  let providerFailureReason = "hugging_face_provider_failed";

  for (const model of candidateModels) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(HF_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
              ],
            },
          ],
          max_tokens: 800,
          temperature: 0.1,
        }),
        signal: controller.signal,
        cache: "no-store",
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        providerFailureReason = `hugging_face_http_${response.status}`;
        await response.body?.cancel().catch(() => undefined);
        continue;
      }

      const rawData = await response.json() as Record<string, unknown>;
      const choices = Array.isArray(rawData.choices) ? rawData.choices : [];
      const firstChoice = choices[0] as Record<string, unknown> | undefined;
      const message = firstChoice?.message as Record<string, unknown> | undefined;
      const rawContent = typeof message?.content === "string" ? message.content.trim() : "";
      if (!rawContent) {
        providerFailureReason = "hugging_face_empty_response";
        continue;
      }

      let cleaned = rawContent;
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      const confirmed = parseConfirmedProviderResult(JSON.parse(cleaned), model);
      if (confirmed) return confirmed;
      providerFailureReason = "hugging_face_invalid_schema";
    } catch (error) {
      providerFailureReason = error instanceof Error && error.name === "AbortError"
        ? "hugging_face_timeout"
        : "hugging_face_invalid_response";
    }
  }

  return allowDemoMock
    ? demoMockOcrResult(`explicit_demo_${providerFailureReason}`)
    : unavailableOcrResult(providerFailureReason);
}
