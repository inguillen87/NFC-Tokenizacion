import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_CHAT_MODEL = "zai-org/GLM-5.2:together";
const DEFAULT_FALLBACK_CHAT_MODEL = "google/gemma-4-26B-A4B-it:deepinfra";

function fallbackOptimizedText(text: string, tone?: string) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (tone === "sommelier") {
    return `Version premium: ${clean || "vino de bodega"} con origen claro, notas de cata, crianza y una invitacion concreta a la experiencia de marca.`;
  }
  if (tone === "club-privado") {
    return `Invitacion cuidada: ${clean || "beneficio exclusivo"} con cupos limitados, acceso preferencial y trato directo de la marca.`;
  }
  if (tone === "modern-web3") {
    return `Producto conectado: ${clean || "botella verificada"} con pasaporte digital, trazabilidad del lote y evidencia tecnica consultable desde el celular.`;
  }
  if (tone === "executive-summary") {
    return `Análisis del Negocio: Con un volumen de ${clean || "taps registrados"}, la bodega experimenta un canal de interacción saludable con alta tasa de lecturas originales. Se recomienda potenciar la fidelización activa ofreciendo beneficios directos en el paso final del escaneo para maximizar el registro en el Pasaporte. Las alertas de riesgo se mantienen en niveles bajos, lo que valida la robustez del sellado.`;
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
  if (tone === "club-privado") {
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

export async function POST(req: Request) {
  try {
    const { text, tone, customToken, model: reqModel } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const hfToken = customToken || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
      return NextResponse.json({ optimizedText: fallbackOptimizedText(text, tone), fallback: true, reason: "hugging_face_token_missing" });
    }

    const model = reqModel || process.env.HF_CHAT_MODEL || DEFAULT_CHAT_MODEL;
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
        const errText = (await response.text()).slice(0, 600);
        lastReason = `hugging_face_${response.status}`;
        console.error("HF Router chat error:", candidateModel, errText);
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

      return NextResponse.json({ optimizedText: cleanText, model: candidateModel, modelFallback: candidateModel !== model });
    }

    return NextResponse.json({ optimizedText: fallbackOptimizedText(text, tone), fallback: true, reason: lastReason, model });
  } catch (error: any) {
    console.error("Error in cognitive-ai route:", error);
    return NextResponse.json({ optimizedText: fallbackOptimizedText("", "sommelier"), fallback: true, reason: error.message || "cognitive_ai_error" });
  }
}
