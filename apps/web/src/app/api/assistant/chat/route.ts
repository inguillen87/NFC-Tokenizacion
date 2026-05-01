export const runtime = "nodejs";

import { NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.nexid.lat";

const ASSISTANT_TIMEOUT_MS = Number(process.env.ASSISTANT_TIMEOUT_MS || 6500);

function safeParseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function detectIntent(question: string) {
  const q = question.toLowerCase();
  if (q.includes("424") || q.includes("215") || q.includes("ntag") || q.includes("qr") || q.includes("sun")) return "tag_stack";
  if (q.includes("reseller") || q.includes("revendedor") || q.includes("revenda") || q.includes("white-label")) return "reseller";
  if (q.includes("precio") || q.includes("pricing") || q.includes("cotiz") || q.includes("orcamento") || q.includes("quote")) return "quote";
  if (q.includes("metamask") || q.includes("polygon") || q.includes("token") || q.includes("blockchain")) return "tokenization";
  if (q.includes("demo") || q.includes("muestra") || q.includes("sample") || q.includes("amostra")) return "demo";
  if (q.includes("api") || q.includes("webhook") || q.includes("integr")) return "integration";
  return "general";
}

function detectVertical(question: string) {
  const q = question.toLowerCase();
  if (q.includes("vino") || q.includes("wine") || q.includes("bodega") || q.includes("garrafa")) return "wine";
  if (q.includes("cosmetic") || q.includes("cosmet")) return "cosmetics";
  if (q.includes("evento") || q.includes("event") || q.includes("pulsera") || q.includes("pulseira")) return "events";
  if (q.includes("pharma") || q.includes("farma") || q.includes("medic")) return "pharma";
  if (q.includes("agro") || q.includes("semilla") || q.includes("semente")) return "agro";
  return "other";
}

function localAnswer(locale: string, question: string, leadSaved: boolean) {
  const intent = detectIntent(question);
  const leadLine = leadSaved
    ? locale === "en"
      ? "\n\nI also saved this as a new CRM lead so the team can follow up."
      : locale === "pt-BR"
      ? "\n\nTambem salvei isso como lead novo no CRM para follow-up."
      : "\n\nTambien guarde esto como lead nuevo en el CRM para seguimiento."
    : "";

  if (locale === "en") {
    const answers: Record<string, string> = {
      tag_stack: "Short version: QR is best for low-risk content and campaigns. NTAG215 is great for fast tap UX, wristbands and serialized operations. NTAG 424 DNA adds dynamic SUN/SDM so every tap is cryptographically different. NTAG 424 DNA TagTamper is the premium option for seals, caps and bottles because opening the product can change the passport state.",
      reseller: "For resellers we package hardware + encoding + SaaS + onboarding. The value story is recurring revenue, CRM leads, analytics exports, tenant dashboards and a white-label rollout model. Start with DemoBodega, show live taps, then quote volume and tag profile.",
      quote: "To quote cleanly I need vertical, yearly volume, target tag profile (QR/NTAG215/424 DNA/424 TT), country and whether you are buying as brand or reseller. The calculator can model enterprise client vs reseller margin in the same flow.",
      tokenization: "Tokenization is premium and optional. We keep NFC/SUN authentication as the core trust layer, then add a sandbox Polygon-style ownership passport for warranty, lifecycle, vouchers or resale. MetaMask is useful for demos, but the consumer flow should not depend on wallet complexity.",
      demo: "For a strong demo, show three moments: product born in origin, customer tap in destination with route/distance, and post-tap action: warranty, club, voucher, marketplace or ownership claim.",
      integration: "Integration usually needs API keys, webhook destinations, tenant roles, batch import and a SUN/UID validation contract. We can start with public lead capture, admin analytics and exportable reports, then add private API keys.",
      general: "I can help you decide tag profile, estimate rollout, explain Basic vs Secure vs Premium, plan reseller margins or prepare a demo flow. Tell me vertical, volume and risk level.",
    };
    return `${answers[intent]}${leadLine}`;
  }

  if (locale === "pt-BR") {
    const answers: Record<string, string> = {
      tag_stack: "Resumo: QR serve para conteudo e campanhas de baixo risco. NTAG215 e otimo para tap rapido, pulseiras e operacao serializada. NTAG 424 DNA adiciona SUN/SDM dinamico para que cada toque seja criptograficamente diferente. NTAG 424 DNA TagTamper e premium para lacres, tampas e garrafas porque a abertura muda o estado do passport.",
      reseller: "Para revendedores, empacotamos hardware + encoding + SaaS + onboarding. A historia de valor e receita recorrente, CRM de leads, exports de analytics, dashboards por tenant e rollout white-label.",
      quote: "Para cotar bem preciso de vertical, volume anual, perfil de tag (QR/NTAG215/424 DNA/424 TT), pais e se voce compra como marca ou reseller. A calculadora modela cliente empresa vs margem reseller.",
      tokenization: "Tokenizacao e premium e opcional. Mantemos NFC/SUN como camada principal de confianca e adicionamos um ownership passport sandbox estilo Polygon para garantia, lifecycle, vouchers ou revenda.",
      demo: "Para uma demo forte, mostre tres momentos: produto nasce na origem, cliente toca no destino com rota/distancia e acao pos-toque: garantia, clube, voucher, marketplace ou ownership.",
      integration: "Integracao normalmente precisa de API keys, webhooks, papeis por tenant, import de batch e contrato de validacao SUN/UID.",
      general: "Posso ajudar a escolher tag profile, estimar rollout, explicar Basic vs Secure vs Premium, planejar margem reseller ou montar uma demo.",
    };
    return `${answers[intent]}${leadLine}`;
  }

  const answers: Record<string, string> = {
    tag_stack: "Version corta: QR sirve para contenido y campañas de bajo riesgo. NTAG215 es ideal para tap rapido, pulseras y operaciones serializadas. NTAG 424 DNA suma SUN/SDM dinamico para que cada tap sea criptograficamente distinto. NTAG 424 DNA TagTamper es la opcion premium para sellos, tapas y botellas porque la apertura fisica cambia el estado del passport.",
    reseller: "Para revendedores, el paquete es hardware + encoding + SaaS + onboarding. La historia de valor es margen inicial, MRR, CRM de leads, exportaciones, dashboard por tenant y rollout white-label. Arranca con DemoBodega, mostra taps en vivo y despues cotiza volumen + perfil de tag.",
    quote: "Para cotizar bien necesito vertical, volumen anual, perfil de tag (QR/NTAG215/424 DNA/424 TT), pais y si compras como marca o reseller. La calculadora ya separa cliente empresa vs margen reseller para que sea facil de explicar.",
    tokenization: "La tokenizacion es premium y opcional. La confianza principal queda en NFC/SUN; despues agregamos ownership passport sandbox tipo Polygon para garantia, lifecycle, vouchers o reventa. MetaMask sirve para demo, pero el consumidor no deberia sufrir complejidad wallet.",
    demo: "Para una demo fuerte, mostra tres momentos: producto nacido en origen, tap del cliente en destino con ruta/distancia y accion post-tap: garantia, club, voucher, marketplace u ownership.",
    integration: "La integracion normalmente pide API keys, webhooks, roles por tenant, importacion de batches y contrato de validacion SUN/UID. Podemos empezar con lead capture, analytics y exports, y luego API privada.",
    general: "Puedo ayudarte a elegir tag profile, estimar rollout, explicar Basic vs Secure vs Premium, planear margen reseller o preparar una demo. Pasame vertical, volumen y nivel de riesgo.",
  };
  return `${answers[intent]}${leadLine}`;
}

async function saveLead(req: Request, input: Record<string, unknown>, question: string) {
  const fullName = clean(input.fullName || input.name);
  const email = clean(input.email);
  const whatsapp = clean(input.whatsapp || input.phone);
  if (!fullName && !email && !whatsapp) return false;

  const leadPayload = {
    locale: clean(input.locale) || "es-AR",
    name: fullName,
    email,
    whatsapp,
    contact: [fullName, email, whatsapp].filter(Boolean).join(" | "),
    company: clean(input.company),
    country: clean(input.country),
    vertical: detectVertical(question),
    role_interest: detectIntent(question),
    tag_type: question.toLowerCase().includes("215") ? "ntag215" : question.toLowerCase().includes("qr") ? "qr" : "secure",
    source: "sales_chat_widget",
    message: question,
    notes: `assistant_mode=${clean(input.mode) || "web_widget"}`,
  };

  const url = new URL("/api/leads", req.url);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(leadPayload),
    cache: "no-store",
  }).catch(() => null);

  return Boolean(response?.ok);
}

export async function POST(req: Request) {
  const body = await req.text();
  const parsed = (safeParseJson(body) || {}) as Record<string, unknown>;
  const question = clean(parsed.question);
  const locale = clean(parsed.locale) || "es-AR";
  const shouldCaptureLead = clean(parsed.mode) === "lead_capture" || Boolean(clean(parsed.email) || clean(parsed.whatsapp));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await response.text();
    const data = safeParseJson(text);
    if (response.ok && data && typeof data === "object" && clean((data as Record<string, unknown>).answer)) {
      const leadSaved = shouldCaptureLead ? Boolean((data as Record<string, unknown>).leadSaved) || await saveLead(req, parsed, question) : Boolean((data as Record<string, unknown>).leadSaved);
      return NextResponse.json({ ...(data as Record<string, unknown>), leadSaved, fallback: false });
    }
  } catch {
    clearTimeout(timeout);
  }

  const leadSaved = shouldCaptureLead ? await saveLead(req, parsed, question) : false;
  return NextResponse.json({
    answer: localAnswer(locale, question, leadSaved),
    intent: detectIntent(question),
    leadSaved,
    fallback: true,
    citations: [],
  });
}
