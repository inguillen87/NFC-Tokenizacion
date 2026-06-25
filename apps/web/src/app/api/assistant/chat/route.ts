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
  if (q.includes("424") || q.includes("215") || q.includes("ntag") || q.includes("qr") || q.includes("sun") || q.includes("sdm")) return "tag_stack";
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
  if (q.includes("cosmetic") || q.includes("cosmet") || q.includes("crema") || q.includes("perfume")) return "cosmetics";
  if (q.includes("evento") || q.includes("event") || q.includes("pulsera") || q.includes("pulseira") || q.includes("brazalete")) return "events";
  if (q.includes("pharma") || q.includes("farma") || q.includes("medic")) return "pharma";
  if (q.includes("agro") || q.includes("semilla") || q.includes("semente")) return "agro";
  if (q.includes("zapat") || q.includes("sneaker") || q.includes("ropa") || q.includes("moda")) return "luxury";
  return "other";
}

function localAnswer(locale: string, question: string, leadSaved: boolean) {
  const intent = detectIntent(question);
  const leadLine = leadSaved
    ? locale === "en"
      ? "\n\nI also saved this as a new CRM lead/ticket so the team can follow up."
      : locale === "pt-BR"
        ? "\n\nTambem salvei isso como lead/ticket novo no CRM para follow-up."
        : "\n\nTambien guarde esto como lead/ticket nuevo en el CRM para seguimiento."
    : "";

  if (locale === "en") {
    const answers: Record<string, string> = {
      tag_stack: "Short version: in nexID, 215 and 424 are NFC tag profiles, not payment codes. NTAG215 is BASIC: lower cost, fast tap UX, wristbands/events, serialized assets and low-risk QR/NFC campaigns. NTAG 424 DNA is SECURE: dynamic SUN/SDM, where each tap generates different cryptographic evidence. NTAG 424 DNA TagTamper is PREMIUM: best for bottles, seals, caps, warranty, ownership, anti-copy and open-state policy. Recommendation: use 215 for simple scale and 424 DNA/TT when the brand must prove authenticity, route, owner, warranty or resale.",
      reseller: "For resellers we package hardware + encoding + SaaS + onboarding. The value story is recurring revenue, CRM leads, analytics exports, tenant dashboards and a white-label rollout model. Start with Bodega Balmec, show live taps, then quote volume and tag profile.",
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
      tag_stack: "Resumo: em nexID, 215 e 424 sao perfis de tag NFC, nao codigos de pagamento. NTAG215 e BASIC: menor custo, tap rapido, pulseiras/eventos, ativos serializados e campanhas QR/NFC de baixo risco. NTAG 424 DNA e SECURE: SUN/SDM dinamico, cada toque gera evidencia criptografica diferente. NTAG 424 DNA TagTamper e PREMIUM: ideal para garrafas, lacres, tampas, garantia, ownership, anti-copia e politica de abertura. Recomendacao: 215 para escala simples; 424 DNA/TT quando a marca precisa provar autenticidade, rota, dono, garantia ou revenda.",
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
    tag_stack: "Version corta: en nexID, 215 y 424 son perfiles de tag NFC, no codigos de pago. NTAG215 es BASIC: menor costo, tap rapido, brazaletes/eventos, activos serializados y campanas QR/NFC de bajo riesgo. NTAG 424 DNA es SECURE: SUN/SDM dinamico, cada tap genera evidencia criptografica distinta. NTAG 424 DNA TagTamper es PREMIUM: ideal para botellas, sellos, capsulas, garantia, ownership, anti-copia y apertura/manipulacion. Recomendacion: 215 para escala simple; 424 DNA/TT cuando hay que probar autenticidad, ruta, dueno, garantia o reventa.",
    reseller: "Para revendedores, el paquete es hardware + encoding + SaaS + onboarding. La historia de valor es margen inicial, MRR, CRM de leads, exportaciones, dashboard por tenant y rollout white-label. Arranca con Bodega Balmec, mostra taps en vivo y despues cotiza volumen + perfil de tag.",
    quote: "Para cotizar bien necesito vertical, volumen anual, perfil de tag (QR/NTAG215/424 DNA/424 TT), pais y si compras como marca o reseller. La calculadora separa cliente empresa vs margen reseller para que sea facil de explicar.",
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
  const question = clean(parsed.question || parsed.message);
  const locale = clean(parsed.locale) || "es-AR";
  const shouldCaptureLead = clean(parsed.mode) === "lead_capture" || Boolean(clean(parsed.email) || clean(parsed.whatsapp));
  const forwardedBody = JSON.stringify({ ...parsed, question });
  const localIntent = detectIntent(question);

  if (localIntent === "tag_stack") {
    const leadSaved = shouldCaptureLead ? await saveLead(req, parsed, question) : false;
    return NextResponse.json({
      answer: localAnswer(locale, question, leadSaved),
      intent: localIntent,
      leadSaved,
      fallback: false,
      citations: [],
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: forwardedBody,
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
    intent: localIntent,
    leadSaved,
    fallback: true,
    citations: [],
  });
}
