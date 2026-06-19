import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HF_IMAGE_BASE_URL = "https://router.huggingface.co/hf-inference/models";

function fallbackLabelImage(prompt: string) {
  const clean = String(prompt || "Etiqueta nexID").replace(/[<>&"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#0b1220"/><rect x="86" y="86" width="852" height="852" rx="36" fill="#111827" stroke="#22d3ee" stroke-width="6"/><text x="512" y="250" fill="#a7f3d0" font-family="Arial, sans-serif" font-size="44" font-weight="700" text-anchor="middle">nexID</text><text x="512" y="340" fill="#ffffff" font-family="Arial, sans-serif" font-size="36" font-weight="700" text-anchor="middle">Etiqueta generada localmente</text><foreignObject x="170" y="420" width="684" height="260"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:#cbd5e1;font-size:30px;line-height:1.35;text-align:center">${clean || "Producto conectado, trazabilidad y autenticidad."}</div></foreignObject><text x="512" y="810" fill="#67e8f9" font-family="Arial, sans-serif" font-size="28" text-anchor="middle">Fallback seguro si Hugging Face no responde</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function POST(req: Request) {
  try {
    const { prompt, customToken } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Prioritize the custom token provided by the user in the UI, then environment variables
    const hfToken = customToken || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
      return NextResponse.json({ imageUrl: fallbackLabelImage(prompt), fallback: true, reason: "hugging_face_token_missing" });
    }

    const configuredModel = process.env.HF_IMAGE_MODEL?.trim();
    const models = [
      configuredModel,
      "black-forest-labs/FLUX.1-schnell",
      "stabilityai/stable-diffusion-xl-base-1.0"
    ].filter(Boolean) as string[];

    let imageBuffer: ArrayBuffer | null = null;
    let errorMsg = "";

    for (const model of models) {
      try {
        console.log(`Calling Hugging Face Router image endpoint with model: ${model}`);
        const response = await fetch(`${HF_IMAGE_BASE_URL}/${model}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: prompt }),
          cache: "no-store",
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const json = await response.json().catch(() => null);
            errorMsg = JSON.stringify(json || {}).slice(0, 500);
          } else {
            imageBuffer = await response.arrayBuffer();
            console.log(`Successfully generated image using model: ${model}`);
            break;
          }
        } else {
          const errText = (await response.text()).slice(0, 600);
          console.warn(`Hugging Face model ${model} returned error status ${response.status}:`, errText);
          errorMsg = errText || response.statusText;
        }
      } catch (err: any) {
        console.warn(`Exception during Hugging Face call for model ${model}:`, err);
        errorMsg = err.message || "Unknown exception";
      }
    }

    if (!imageBuffer) {
      return NextResponse.json({ imageUrl: fallbackLabelImage(prompt), fallback: true, reason: errorMsg || "hugging_face_generation_failed" });
    }

    // Convert binary buffer to base64 data URL
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error("Error in generate-label API route:", error);
    return NextResponse.json({ imageUrl: fallbackLabelImage("Etiqueta nexID"), fallback: true, reason: error.message || "label_generation_error" });
  }
}
