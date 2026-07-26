export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  consumePublicApiRateLimit,
  isJsonRequest,
  isSameOriginRequest,
  parseJsonRecord,
  readBoundedText,
} from "../../../../lib/public-api-guard";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.nexid.lat";

const ASSISTANT_TIMEOUT_MS = Math.min(15_000, Math.max(1_000, Number(process.env.ASSISTANT_TIMEOUT_MS || 6500) || 6_500));
const MAX_PAYLOAD_BYTES = 24_576;
const MAX_QUESTION_CHARS = 2_000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_MESSAGE_CHARS = 1_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX = 30;
const ALLOWED_LOCALES = new Set(["es-AR", "pt-BR", "en"]);
const ALLOWED_MODES = new Set(["web_widget", "lead_capture"]);

function json(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

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

function boundedField(value: unknown, maxChars: number) {
  return clean(value).slice(0, maxChars);
}

function safeHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_HISTORY_MESSAGES).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const role = clean(record.role);
    const text = boundedField(record.text || record.content, MAX_HISTORY_MESSAGE_CHARS);
    if ((role !== "user" && role !== "assistant") || !text) return [];
    return [{ role, text }];
  });
}

function normalizeQuery(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectIntent(question: string) {
  const q = normalizeQuery(question);
  if (["lector offline", "offline reader", "app offline", "offline app", "taplinx", "core nfc", "corenfc", "nfcadapter", "isodep", "iso-dep", "apdu", "dmk", "clave maestra derivada", "clave derivada"].some((term) => q.includes(term))) return "offline_verifier";
  if (["offline", "sin internet", "sin senal", "no hay senal", "sin cobertura", "sin conexion", "no hay conexion", "no hay internet", "sem internet", "sem sinal", "sem conexao", "sem rede", "no internet", "without internet", "no connectivity", "no signal", "out of coverage"].some((term) => q.includes(term))) return "offline_validation";
  if (q.includes("partner") || q.includes("partnership") || q.includes("alianza") || q.includes("socio oficial") || q.includes("parceria") || q.includes("oficial")) return "partnership_risk";
  if (q.includes("iota") || q.includes("merkle") || q.includes("audit") || q.includes("auditoria") || q.includes("dpp")) return "iota_proof";
  if (q.includes("uhf") || q.includes("iot") || q.includes("sensor") || q.includes("pallet") || q.includes("logistica") || q.includes("industrial")) return "industrial_trace";
  if (q.includes("gs1") || q.includes("digital link") || q.includes("gtin")) return "gs1_qr";
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
      tag_stack: "Short version: in nexID, 215 and 424 are NFC tag profiles, not payment codes. NTAG215 is BASIC: lower cost, fast tap UX, wristbands/events, serialized references and low-risk QR/NFC campaigns. NTAG 424 DNA is SECURE: dynamic SUN/SDM, so each read can provide fresh cryptographic evidence from the tag message and support replay controls. NTAG 424 DNA TagTamper reports the tamper-circuit state when correctly integrated; it does not by itself prove the physical seal, contents or origin. Recommendation: use 215 for simple scale; use 424 DNA/TT when the brand needs stronger message evidence, then apply separate nexID policies for declared route data, digital ownership, warranty, certificates or resale.",
      offline_validation: "Yes, NFC reading works without internet, and NTAG 424 DNA can generate a fresh SUN/SDM cryptographic response offline because the chip computes it internally when powered by the phone or reader. A normal browser still needs connectivity for the backend verdict on the message, replay and policy. For remote areas, store/retry the tap and finalize those checks when connectivity returns. Industrial offline use needs a controlled app or reader with scoped validation keys. Do not promise wallet, warranty, ownership, NFT or CRM writes as fully offline browser actions.",
      offline_verifier: "Yes, an offline verifier is buildable, but it is a controlled system, not a normal web browser flow. Use a native NFC field app or a Type 4/APDU-capable reader, never tenant master keys in a consumer app. Provision device-scoped, batch-scoped, time-limited derived keys, encrypted local queues, revocation and backend sync. Label the local message result provisional until nexID confirms replay and policy server-side; ownership and warranty require separate evidence and approval.",
      reseller: "For resellers we package hardware + encoding + SaaS + onboarding. The value story is recurring revenue, CRM leads, analytics exports, tenant dashboards and a white-label rollout model. Start with Bodega Balmec, show live taps, then quote volume and tag profile.",
      quote: "To quote cleanly I need vertical, yearly volume, target tag profile (QR/NTAG215/424 DNA/424 TT), country and whether you are buying as brand or reseller. The calculator can model enterprise client vs reseller margin in the same flow.",
      tokenization: "Tokenization is premium and optional. NFC/SUN message evidence remains the primary digital signal; Polygon-based ownership, certificates, warranty transfer or resale require a fresh accepted read, buyer validation, purchase evidence and tenant policy approval. The digital record does not prove physical ownership or authenticity. MetaMask is useful for demos, but the consumer flow should not depend on wallet complexity.",
      iota_proof: "IOTA fits as an optional proof/audit layer, not as the primary consumer tap flow. The platform can anchor hashes or Merkle roots for DPP, batch lifecycle and logistics evidence, while private data and individual taps remain off-chain.",
      industrial_trace: "For industrial traceability, use UHF/IoT for pallets, cartons and sensor events, then connect that evidence to the same product passport. Consumer QR/NFC stays simple; operations get route, temperature, custody and audit views.",
      gs1_qr: "GS1 Digital Link and QR are the low-cost identity and resolver layer: GTIN, lot, serial, recall, content and retailer compatibility. They are useful as visible fallback, but should not unlock premium ownership or high-value claims without stronger proof.",
      partnership_risk: "Careful wording: Polygon and IOTA are technologies we can integrate with, not official partnerships unless a signed public agreement exists. The safe claim is architecture support or integration path, not endorsement.",
      demo: "For a strong demo, show three clearly labeled moments: declared product and origin data, a simulated or recorded destination tap with reported location, and a governed post-tap action such as warranty, club, voucher, marketplace or digital ownership request.",
      integration: "Integration usually needs API keys, webhook destinations, tenant roles, batch import and a SUN/UID validation contract. We can start with public lead capture, admin analytics and exportable reports, then add private API keys.",
      general: "I can help you decide tag profile, estimate rollout, explain Basic vs Secure vs Premium, plan reseller margins or prepare a demo flow. Tell me vertical, volume and risk level.",
    };
    return `${answers[intent]}${leadLine}`;
  }

  if (locale === "pt-BR") {
    const answers: Record<string, string> = {
      tag_stack: "Resumo: em nexID, 215 e 424 sao perfis de tag NFC, nao codigos de pagamento. NTAG215 e BASIC: menor custo, tap rapido, pulseiras/eventos, referencias serializadas e campanhas QR/NFC de baixo risco. NTAG 424 DNA e SECURE: SUN/SDM dinamico, portanto cada leitura pode fornecer evidencia criptografica fresca da mensagem do tag e apoiar controles anti-replay. NTAG 424 DNA TagTamper informa o estado do circuito quando integrado corretamente; sozinho nao comprova lacre fisico, conteudo ou origem. Recomendacao: 215 para escala simples; 424 DNA/TT para evidencia de mensagem mais forte, seguida de politicas separadas da nexID para rota declarada, titularidade digital, garantia, certificado ou revenda.",
      offline_validation: "Sim, a leitura NFC funciona sem internet, e o NTAG 424 DNA pode gerar uma resposta criptografica SUN/SDM fresca offline porque o chip calcula isso internamente. Um navegador comum ainda precisa de internet para o veredito do backend sobre mensagem, replay e politica. Em areas remotas, guardar e reenviar o tap quando a conexao voltar. Uso industrial offline exige app ou leitor controlado com chaves limitadas. Nao prometa wallet, garantia, ownership, NFT ou CRM 100% offline no browser.",
      offline_verifier: "Sim, um verificador offline e possivel, mas precisa ser controlado, nao um browser comum. Use app NFC nativo ou leitor Type 4/APDU e nunca coloque master keys do tenant em app consumidor. Provisione chaves por device, batch e prazo, fila local cifrada, revogacao e sync. O resultado local da mensagem e provisório ate replay e politica no backend; ownership e garantia exigem evidencia e aprovacao separadas.",
      reseller: "Para revendedores, empacotamos hardware + encoding + SaaS + onboarding. A historia de valor e receita recorrente, CRM de leads, exports de analytics, dashboards por tenant e rollout white-label.",
      quote: "Para cotar bem preciso de vertical, volume anual, perfil de tag (QR/NTAG215/424 DNA/424 TT), pais e se voce compra como marca ou reseller. A calculadora modela cliente empresa vs margem reseller.",
      tokenization: "Tokenizacao e premium e opcional. A evidencia da mensagem NFC/SUN e o sinal digital principal; ownership, certificados, garantia transferivel ou revenda em Polygon exigem leitura recente aceita, comprador validado, evidencia de compra e politica aprovada. O registro digital nao prova ownership ou autenticidade fisica.",
      iota_proof: "IOTA entra como camada opcional de prova/auditoria, nao como fluxo principal de toque do consumidor. A plataforma pode ancorar hashes ou Merkle roots para DPP, ciclo de lote e logistica, mantendo dados privados e taps individuais off-chain.",
      industrial_trace: "Para rastreabilidade industrial, use UHF/IoT em pallets, caixas e sensores, conectando essa evidencia ao mesmo passport. QR/NFC do consumidor fica simples; operacoes ganham rota, temperatura, custodia e auditoria.",
      gs1_qr: "GS1 Digital Link e QR sao a camada economica de identidade e resolver: GTIN, lote, serie, recall, conteudo e compatibilidade retail. Sao fallback visivel, mas nao liberam ownership premium sozinhos.",
      partnership_risk: "Cuidado no wording: Polygon e IOTA sao tecnologias integraveis, nao parcerias oficiais salvo acordo publico assinado. O claim seguro e suporte arquitetural ou caminho de integracao, nao endorsement.",
      demo: "Para uma demo forte, mostre tres momentos rotulados: dados declarados de produto e origem, toque simulado ou registrado no destino com local informado e acao governada pos-toque como garantia, clube, voucher, marketplace ou pedido de ownership digital.",
      integration: "Integracao normalmente precisa de API keys, webhooks, papeis por tenant, import de batch e contrato de validacao SUN/UID.",
      general: "Posso ajudar a escolher tag profile, estimar rollout, explicar Basic vs Secure vs Premium, planejar margem reseller ou montar uma demo.",
    };
    return `${answers[intent]}${leadLine}`;
  }

  const answers: Record<string, string> = {
    tag_stack: "Version corta: en nexID, 215 y 424 son perfiles de tag NFC, no codigos de pago. NTAG215 es BASIC: menor costo, tap rapido, brazaletes/eventos, referencias serializadas y campanas QR/NFC de bajo riesgo. NTAG 424 DNA es SECURE: SUN/SDM dinamico, por lo que cada lectura puede aportar evidencia criptografica fresca del mensaje del tag y controles anti-replay. NTAG 424 DNA TagTamper reporta el estado del circuito cuando esta bien integrado; por si solo no prueba el sello fisico, el contenido ni el origen. Recomendacion: 215 para escala simple; 424 DNA/TT para evidencia de mensaje mas fuerte y luego politicas separadas de nexID para ruta declarada, ownership digital, garantia, certificado o reventa.",
    offline_validation: "Si, NFC se puede leer sin internet, y NTAG 424 DNA puede generar una respuesta criptografica SUN/SDM fresca offline porque el chip la calcula internamente. Un navegador comun necesita internet para el veredicto backend del mensaje, replay y politica. En zonas remotas, se guarda y reintenta el tap cuando vuelve la conexion. El uso industrial offline exige app o lector controlado con claves acotadas. No prometemos wallet, garantia, ownership, NFT ni CRM 100% offline en browser.",
    offline_verifier: "Si, un verificador offline se puede construir, pero tiene que ser controlado, no un navegador comun. Se usa una app NFC nativa o lector Type 4/APDU y nunca master keys del tenant en una app consumer. Se provisionan claves por dispositivo, batch y vencimiento, cola local cifrada, revocacion y sync. El resultado local del mensaje es provisional hasta confirmar replay y politica en backend; ownership y garantia requieren evidencia y aprobacion separadas.",
    reseller: "Para revendedores, el paquete es hardware + encoding + SaaS + onboarding. La historia de valor es margen inicial, MRR, CRM de leads, exportaciones, dashboard por tenant y rollout white-label. Arranca con Bodega Balmec, mostra taps en vivo y despues cotiza volumen + perfil de tag.",
    quote: "Para cotizar bien necesito vertical, volumen anual, perfil de tag (QR/NTAG215/424 DNA/424 TT), pais y si compras como marca o reseller. La calculadora separa cliente empresa vs margen reseller para que sea facil de explicar.",
    tokenization: "La tokenizacion es premium y opcional. La evidencia del mensaje NFC/SUN es la senal digital principal; ownership, certificados, garantia transferible o reventa en Polygon exigen lectura reciente aceptada, comprador validado, evidencia de compra y politica aprobada. El registro digital no prueba ownership ni autenticidad fisica. MetaMask sirve para demo, sin imponer complejidad wallet.",
    iota_proof: "IOTA encaja como capa opcional de prueba/auditoria, no como flujo principal del tap del consumidor. La plataforma puede anclar hashes o Merkle roots para DPP, ciclo de lote y evidencia logistica, manteniendo datos privados y taps individuales off-chain.",
    industrial_trace: "Para trazabilidad industrial, UHF/IoT cubre pallets, cajas y eventos de sensores, conectado al mismo pasaporte del producto. El consumidor ve QR/NFC simple; operaciones ve ruta, temperatura, custodia y auditoria.",
    gs1_qr: "GS1 Digital Link y QR son la capa economica de identidad y resolver: GTIN, lote, serie, recall, contenido y compatibilidad retail. Son un fallback visible, pero no deberian habilitar ownership premium solos.",
    partnership_risk: "Cuidado con el wording: Polygon e IOTA son tecnologias integrables, no partnerships oficiales salvo acuerdo publico firmado. El claim seguro es soporte arquitectural o camino de integracion, no endorsement.",
    demo: "Para una demo fuerte, mostra tres momentos rotulados: datos declarados de producto y origen, tap simulado o registrado en destino con ubicacion reportada y una accion gobernada post-tap como garantia, club, voucher, marketplace o solicitud de ownership digital.",
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
    headers: {
      "Content-Type": "application/json",
      Origin: url.origin,
      ...(clean(req.headers.get("x-forwarded-for")) ? { "x-forwarded-for": clean(req.headers.get("x-forwarded-for")) } : {}),
    },
    body: JSON.stringify(leadPayload),
    cache: "no-store",
  }).catch(() => null);

  return Boolean(response?.ok);
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return json({ ok: false, reason: "forbidden" }, 403);
  if (!isJsonRequest(req)) return json({ ok: false, reason: "unsupported_media_type" }, 415);

  const retryAfter = consumePublicApiRateLimit("assistant-chat", req, {
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (retryAfter > 0) return json({ ok: false, reason: "rate_limited" }, 429, { "retry-after": String(retryAfter) });

  const bounded = await readBoundedText(req, MAX_PAYLOAD_BYTES);
  if (!bounded.ok) return json({ ok: false, reason: bounded.reason }, bounded.status);
  const parsed = parseJsonRecord(bounded.text);
  if (!parsed) return json({ ok: false, reason: "invalid_json" }, 400);

  const question = clean(parsed.question || parsed.message);
  if (!question) return json({ ok: false, reason: "question_required" }, 400);
  if (question.length > MAX_QUESTION_CHARS) return json({ ok: false, reason: "question_too_long" }, 413);

  const requestedLocale = clean(parsed.locale) || "es-AR";
  const locale = ALLOWED_LOCALES.has(requestedLocale) ? requestedLocale : "es-AR";
  const requestedMode = clean(parsed.mode) || "web_widget";
  if (!ALLOWED_MODES.has(requestedMode)) return json({ ok: false, reason: "unsupported_mode" }, 400);

  const sanitized = {
    locale,
    question,
    fullName: boundedField(parsed.fullName || parsed.name, 120),
    email: boundedField(parsed.email, 254),
    whatsapp: boundedField(parsed.whatsapp || parsed.phone, 40),
    company: boundedField(parsed.company, 160),
    country: boundedField(parsed.country, 80),
    mode: requestedMode,
    history: safeHistory(parsed.history),
  };
  const shouldCaptureLead = requestedMode === "lead_capture" || Boolean(sanitized.email || sanitized.whatsapp);
  const forwardedBody = JSON.stringify(sanitized);
  const localIntent = detectIntent(question);

  if (["tag_stack", "offline_validation", "offline_verifier", "iota_proof", "industrial_trace", "gs1_qr", "partnership_risk"].includes(localIntent)) {
    const leadSaved = shouldCaptureLead ? await saveLead(req, sanitized, question) : false;
    return json({
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
      const leadSaved = shouldCaptureLead ? Boolean((data as Record<string, unknown>).leadSaved) || await saveLead(req, sanitized, question) : Boolean((data as Record<string, unknown>).leadSaved);
      return json({ ...(data as Record<string, unknown>), leadSaved, fallback: false });
    }
  } catch {
    clearTimeout(timeout);
  }

  const leadSaved = shouldCaptureLead ? await saveLead(req, sanitized, question) : false;
  return json({
    answer: localAnswer(locale, question, leadSaved),
    intent: localIntent,
    leadSaved,
    fallback: true,
    citations: [],
  });
}
