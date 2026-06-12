import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { prompt, customToken } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Prioritize the custom token provided by the user in the UI, then environment variables
    const hfToken = customToken || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
      return NextResponse.json({ error: "Hugging Face token not configured" }, { status: 500 });
    }

    // List of models to try. We prioritize FLUX.1-schnell for fast preview generation,
    // falling back to Stable Diffusion XL if there's any rate limit or loading issue.
    const models = [
      "black-forest-labs/FLUX.1-schnell",
      "stabilityai/stable-diffusion-xl-base-1.0"
    ];

    let imageBuffer: ArrayBuffer | null = null;
    let errorMsg = "";

    for (const model of models) {
      try {
        console.log(`Calling Hugging Face Inference API with model: ${model}`);
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: prompt }),
          cache: "no-store",
        });

        if (response.ok) {
          imageBuffer = await response.arrayBuffer();
          console.log(`Successfully generated image using model: ${model}`);
          break;
        } else {
          const errText = await response.text();
          console.warn(`Hugging Face model ${model} returned error status ${response.status}:`, errText);
          errorMsg = errText || response.statusText;
        }
      } catch (err: any) {
        console.warn(`Exception during Hugging Face call for model ${model}:`, err);
        errorMsg = err.message || "Unknown exception";
      }
    }

    if (!imageBuffer) {
      return NextResponse.json({ error: `Hugging Face Image Generation failed: ${errorMsg}` }, { status: 500 });
    }

    // Convert binary buffer to base64 data URL
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error("Error in generate-label API route:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
