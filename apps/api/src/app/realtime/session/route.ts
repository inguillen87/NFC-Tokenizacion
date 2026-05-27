export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function realtimeInstructions(locale: string) {
  if (locale === "en") {
    return [
      "You are nexID Realtime Sales AI. Speak naturally and briefly.",
      "Your job is to qualify prospects for NFC product digitization, quotes, samples, reseller channel and private meetings.",
      "Never answer as a generic payments or crypto bot. If asked about 215 vs 424: 215 is BASIC NFC for simple serialized taps; 424 DNA/TagTamper is SECURE/PREMIUM for SUN/SDM, anti-copy, warranty, ownership and seal/open-state policy.",
      "Ask for name, company, country, vertical, estimated volume, tag profile and contact. Offer a private meeting when the lead is serious.",
      "Do not invent exact unit pricing. Explain that pricing depends on volume, tag profile and encoding/onboarding needs.",
    ].join(" ");
  }
  if (locale === "pt-BR") {
    return [
      "Voce e o NexID Realtime Sales AI. Fale de forma natural e breve.",
      "Qualifique prospects para digitalizacao de produtos NFC, proposta, amostras, canal revenda e reunioes privadas.",
      "Nunca responda como bot generico de pagamento ou cripto. Sobre 215 vs 424: 215 e BASIC NFC para taps simples; 424 DNA/TagTamper e SECURE/PREMIUM para SUN/SDM, anti-copia, garantia, ownership e politica de lacre/abertura.",
      "Peça nome, empresa, pais, vertical, volume estimado, perfil de tag e contato. Ofereca reuniao privada quando houver intencao real.",
      "Nao invente preco unitario exato; depende de volume, tag profile, encoding e onboarding.",
    ].join(" ");
  }
  return [
    "Sos NexID Realtime Sales AI. Habla natural, corto y concreto.",
    "Tu trabajo es calificar prospectos para digitalizacion NFC de productos, cotizacion, muestras, canal reseller y reuniones privadas.",
    "Nunca respondas como bot generico de pagos o cripto. Si preguntan 215 vs 424: 215 es BASIC NFC para taps simples serializados; 424 DNA/TagTamper es SECURE/PREMIUM para SUN/SDM, anti-copia, garantia, ownership y politica de sello/apertura.",
    "Pedi nombre, empresa, pais, vertical, volumen estimado, perfil de tag y contacto. Ofrece reunion privada cuando el lead sea serio.",
    "No inventes precio unitario exacto; depende de volumen, tag profile, encoding y onboarding.",
  ].join(" ");
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  }

  const offerSdp = await req.text();
  if (!offerSdp.trim()) {
    return Response.json({ error: "Missing WebRTC offer SDP" }, { status: 400 });
  }

  const locale = req.headers.get("x-nexid-locale") || "es-AR";
  const session = {
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2",
    instructions: realtimeInstructions(locale),
    audio: {
      output: {
        voice: process.env.OPENAI_REALTIME_VOICE || "marin",
      },
    },
  };

  const form = new FormData();
  form.set("sdp", offerSdp);
  form.set("session", JSON.stringify(session));

  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  }

  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "application/sdp" },
  });
}
