import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_CHAT_MODEL = "zai-org/GLM-5.2:together";
const DEFAULT_FAST_CHAT_MODEL = "deepseek-ai/DeepSeek-V4-Flash:deepinfra";
const DEFAULT_FALLBACK_CHAT_MODEL = "google/gemma-4-26B-A4B-it:deepinfra";

function fallbackOptimizedText(text: string, tone?: string) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (tone === "sommelier-chat") {
    if (/temperatura|servir|frio|fria/i.test(clean)) return "Servilo entre 16 y 18°C. Esa temperatura ideal sostiene toda su fruta roja madura, madera y taninos sin endurecer la boca.";
    if (/maridaje|comida|carne|queso|pasta|comer/i.test(clean)) return "Va excelente con asado, cortes a la parrilla, pastas con ragú o fileto trufado, y quesos duros maduros. Evitá lo muy picante.";
    if (/aroma|cata|sabor|nota|oler/i.test(clean)) return "En copa revela rojo violáceo intenso, aromas de ciruela y mora madura con dejos de tabaco y vainilla por su paso por roble.";
    if (/premio|punto|suckling|decanter|calificacion|atkin/i.test(clean)) return "Este Gran Reserva posee 95 puntos James Suckling y medalla de oro Decanter por su equilibrio excepcional y elegancia.";
    if (/regalo|cena|romantica|romantico|ocasion|amigos|cumple/i.test(clean)) return "¡Ideal! En una cena romántica enamora por su sedosidad; como regalo es un éxito garantizado con su perfil premium de guarda.";
    return "Es un vino excepcional para disfrutar con calma: abrilo 15 minutos antes y servilo en copa amplia para expresar el terroir.";
  }
  if (tone === "sommelier") {
    return `Propuesta premium: ${clean || "vino de bodega"} con foco en origen, crianza, expresion del terroir y una experiencia cuidada para el cliente.`;
  }
  if (tone === "club-privado") {
    return `Invitacion cuidada: ${clean || "beneficio exclusivo"} con cupos limitados, acceso preferencial y trato directo de la marca.`;
  }
  if (tone === "modern-web3") {
    return `Producto conectado: ${clean || "botella verificada"} con pasaporte digital, trazabilidad del lote y evidencia tecnica consultable desde el celular.`;
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
    return "Sos un sommelier enologo de lujo. Reescribi el texto en espanol para una bodega premium. Usa solo datos presentes en el texto: no inventes bodega, finca, terroir, premios, certificaciones, origen, proceso, anada ni propiedad. No uses garantizado, 100%, certificado o autentico si el input no lo afirma. Mejora tono, claridad and utilidad.";
  }
  if (tone === "club-privado") {
    return "Sos estratega de fidelizacion premium. Reescribi el texto en espanol con exclusividad, cupos limitados y acceso preferencial, sin prometer propiedad ni beneficios no verificados.";
  }
  if (tone === "modern-web3") {
    return "Sos arquitecto de producto phygital. Reescribi el texto en espanol explicando pasaporte digital, trazabilidad, evidencia tecnica y tokenizacion opcional. No prometas ownership si no hay prueba de compra.";
  }
  if (tone === "sommelier-chat") {
    return "Sos un sommelier enólogo experto de una prestigiosa bodega de Mendoza. Responde en español rioplatense, elegante y muy carismático. Responde detalladamente sobre maridajes (carnes asadas, pastas trufadas, quesos maduros), temperatura óptima (16-18°C) y ocasiones (cenas románticas, regalos de prestigio, festejos). Menciona que este Gran Reserva tiene 95 puntos James Suckling y 12 meses de guarda en roble francés. Limita tu respuesta a un máximo de 450 caracteres.";
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
          { role: "user", content: String(text) },
        ],
        max_tokens: tokenBudgetFor(candidateModel),
        temperature: tone === "sommelier-chat" ? 0.45 : 0.65,
      });

      if (!response.ok) {
        const errText = (await response.text()).slice(0, 600);
        lastReason = `hugging_face_${response.status}`;
        console.error("HF Router chat error on web app route:", candidateModel, errText);
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
    console.error("Error in web-app cognitive-ai route:", error);
    return NextResponse.json({ optimizedText: fallbackOptimizedText("", "sommelier-chat"), fallback: true, reason: error.message || "cognitive_ai_error" });
  }
}
