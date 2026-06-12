import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { text, tone, customToken, model: reqModel } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Prioritize the custom token provided by the user in the UI, then environment variables
    const hfToken = customToken || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
      return NextResponse.json({ error: "Hugging Face token not configured" }, { status: 500 });
    }

    let systemPrompt = "";
    let model = reqModel || "Qwen/Qwen2.5-7B-Instruct"; // standard instruct model

    if (tone === "sommelier") {
      systemPrompt = "Eres un sommelier enólogo de lujo. Reescribe el texto del usuario en español para una bodega de vinos premium. Usa terminología de cata sofisticada, notas aromáticas, taninos persistentes, maderas nobles y exclusividad de terroir. El mensaje debe ser sumamente elegante y cautivador.";
    } else if (tone === "club-privado") {
      systemPrompt = "Eres un anfitrión de un club privado VIP. Reescribe el texto en español para evocar triggers de exclusividad absoluta, cupos limitados, invitaciones de etiqueta, estatus superior y acceso selecto.";
    } else if (tone === "modern-web3") {
      systemPrompt = "Eres un enólogo tecnológico experto en gemelos digitales y Web3. Reescribe el texto en español para destacar la tokenización de activos físicos en el ledger, la procedencia inmutable on-chain de la botella, el pasaporte digital en el celular y los beneficios Web3 del chip nexID NFC.";
    } else if (tone === "sommelier-chat") {
      model = "Qwen/Qwen2.5-1.5B-Instruct"; // use a lighter model for fast chat response
      systemPrompt = "Eres un sommelier enólogo experto de Bodega Gran Blend en Mendoza, Argentina. Responde de forma muy concisa, cordial, elegante y profesional. Usa jerga enológica argentina (terroir, crianza, notas de ciruela, madera). Mantén tu respuesta extremadamente corta, menor a 230 caracteres, para que quepan en la pequeña pantalla de chat de un celular. No agregues saludos largos.";
    } else {
      systemPrompt = "Reescribe el siguiente texto para una marca de lujo premium en español. Hazlo sonar sofisticado, exclusivo y profesional.";
    }

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
          { role: "user", content: text }
        ],
        max_tokens: tone === "sommelier-chat" ? 120 : 300,
        temperature: 0.6,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("HF Inference API error on web app route:", errText);
      return NextResponse.json({ error: "Hugging Face API error" }, { status: response.status });
    }

    const data = await response.json();
    const optimizedText = data.choices?.[0]?.message?.content?.trim() || "";

    // Clean any leading/trailing quotes
    let cleanText = optimizedText;
    if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
      cleanText = cleanText.slice(1, -1);
    }

    return NextResponse.json({ optimizedText: cleanText });
  } catch (error: any) {
    console.error("Error in web-app cognitive-ai route:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
