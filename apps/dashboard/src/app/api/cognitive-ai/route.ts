import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { text, tone } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
      return NextResponse.json({ error: "Hugging Face token not configured" }, { status: 500 });
    }

    // Prompts according to selected tone
    let systemPrompt = "";
    if (tone === "sommelier") {
      systemPrompt = "Eres un sommelier enólogo de lujo. Reescribe el texto del usuario en español para una bodega de vinos premium. Usa terminología de cata sofisticada, notas aromáticas, taninos persistentes, maderas nobles y exclusividad de terroir. El mensaje debe ser sumamente elegante y cautivador.";
    } else if (tone === "club-privado") {
      systemPrompt = "Eres un anfitrión de un club privado VIP. Reescribe el texto en español para evocar triggers de exclusividad absoluta, cupos limitados, invitaciones de etiqueta, estatus superior y acceso selecto.";
    } else if (tone === "modern-web3") {
      systemPrompt = "Eres un enólogo tecnológico experto en gemelos digitales y Web3. Reescribe el texto en español para destacar la tokenización de activos físicos en el ledger, la procedencia inmutable on-chain de la botella, el pasaporte digital en el celular y los beneficios Web3 del chip nexID NFC.";
    } else {
      systemPrompt = "Reescribe el siguiente texto para una marca de lujo premium en español. Hazlo sonar sofisticado, exclusivo y profesional.";
    }

    // We call the Hugging Face Inference API using a fast chat model
    const model = "Qwen/Qwen2.5-7B-Instruct";
    const response = await fetch(`https://api-inference.huggingface.co/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Reescribe el siguiente borrador manteniendo la intención original pero elevando su nivel a premium:\n\n"${text}"` }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("HF Inference API error:", errText);
      return NextResponse.json({ error: "Hugging Face API error" }, { status: response.status });
    }

    const data = await response.json();
    const optimizedText = data.choices?.[0]?.message?.content?.trim() || "";

    // Clean any leading/trailing quotes that LLMs sometimes output
    let cleanText = optimizedText;
    if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
      cleanText = cleanText.slice(1, -1);
    }

    return NextResponse.json({ optimizedText: cleanText });
  } catch (error: any) {
    console.error("Error in cognitive-ai route:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
