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
      tag_stack: "Short version: in nexID, 215 and 424 are NFC tag profiles, not payment codes. NTAG215 is BASIC: lower cost, fast tap UX, wristbands/events, serialized assets and low-risk QR/NFC campaigns. NTAG 424 DNA is SECURE: dynamic SUN/SDM, where each tap generates fresh cryptographic evidence of physical presence. NTAG 424 DNA TagTamper adds open/closed seal evidence when the tamper loop is physically integrated. Recommendation: use 215 for simple scale; use 424 DNA/TT when the brand must prove authentic physical presence first, then let nexID policy attach route, ownership, warranty, certificate or resale workflows.",
      offline_validation: "Yes, NFC reading works without internet, and NTAG 424 DNA can generate a fresh SUN/SDM cryptographic response offline because the chip computes it internally when powered by the phone or reader. The important limit: a normal browser still needs internet to load the passport and ask nexID for the final trust verdict. For remote areas, use deferred validation: store/retry the tap and finalize when connectivity returns. For industrial offline use, use a controlled app or reader with securely provisioned validation keys. Do not promise wallet, warranty, ownership, NFT or CRM writes as fully offline browser actions.",
      offline_verifier: "Yes, an offline verifier is buildable, but it is a controlled system, not a normal web browser flow. Route one is an Android/iOS field app using native NFC APIs (Android NfcAdapter/IsoDep, iOS Core NFC/ISO 7816 where allowed) or NXP TapLinx on Android. Route two is a dedicated Type 4/APDU-capable reader for warehouses, rural depots or production lines. The security rule is non-negotiable: never embed tenant master keys in the app and do not use the same master key forever for every tag. Use device-scoped, batch-scoped, time-limited derived validation keys, encrypted local queues, revocation and backend sync. Offline verdicts should be labeled provisional until nexID confirms replay, policy, warranty, ownership and audit server-side.",
      reseller: "For resellers we package hardware + encoding + SaaS + onboarding. The value story is recurring revenue, CRM leads, analytics exports, tenant dashboards and a white-label rollout model. Start with Bodega Balmec, show live taps, then quote volume and tag profile.",
      quote: "To quote cleanly I need vertical, yearly volume, target tag profile (QR/NTAG215/424 DNA/424 TT), country and whether you are buying as brand or reseller. The calculator can model enterprise client vs reseller margin in the same flow.",
      tokenization: "Tokenization is premium and optional. We keep NFC/SUN authentication as the core trust layer, then add Polygon-based ownership, certificates, warranty transfer or resale only after a fresh tap, buyer validation and tenant policy approval. MetaMask is useful for demos, but the consumer flow should not depend on wallet complexity.",
      iota_proof: "IOTA fits as an optional proof/audit layer, not as the primary consumer tap flow. The platform can anchor hashes or Merkle roots for DPP, batch lifecycle and logistics evidence, while private data and individual taps remain off-chain.",
      industrial_trace: "For industrial traceability, use UHF/IoT for pallets, cartons and sensor events, then connect that evidence to the same product passport. Consumer QR/NFC stays simple; operations get route, temperature, custody and audit views.",
      gs1_qr: "GS1 Digital Link and QR are the low-cost identity and resolver layer: GTIN, lot, serial, recall, content and retailer compatibility. They are useful as visible fallback, but should not unlock premium ownership or high-value claims without stronger proof.",
      partnership_risk: "Careful wording: Polygon and IOTA are technologies we can integrate with, not official partnerships unless a signed public agreement exists. The safe claim is architecture support or integration path, not endorsement.",
      demo: "For a strong demo, show three moments: product born in origin, customer tap in destination with route/distance, and post-tap action: warranty, club, voucher, marketplace or ownership claim.",
      integration: "Integration usually needs API keys, webhook destinations, tenant roles, batch import and a SUN/UID validation contract. We can start with public lead capture, admin analytics and exportable reports, then add private API keys.",
      general: "I can help you decide tag profile, estimate rollout, explain Basic vs Secure vs Premium, plan reseller margins or prepare a demo flow. Tell me vertical, volume and risk level.",
    };
    return `${answers[intent]}${leadLine}`;
  }

  if (locale === "pt-BR") {
    const answers: Record<string, string> = {
      tag_stack: "Resumo: em nexID, 215 e 424 sao perfis de tag NFC, nao codigos de pagamento. NTAG215 e BASIC: menor custo, tap rapido, pulseiras/eventos, ativos serializados e campanhas QR/NFC de baixo risco. NTAG 424 DNA e SECURE: SUN/SDM dinamico, cada toque gera evidencia criptografica fresca de presenca fisica. NTAG 424 DNA TagTamper adiciona evidencia de lacre aberto/fechado quando o circuito de tamper esta fisicamente integrado. Recomendacao: 215 para escala simples; 424 DNA/TT quando a marca precisa provar presenca fisica autentica primeiro, e depois aplicar politicas nexID para rota, titularidade, garantia, certificado ou revenda.",
      offline_validation: "Sim, a leitura NFC funciona sem internet, e o NTAG 424 DNA pode gerar uma resposta criptografica SUN/SDM fresca offline porque o chip calcula isso internamente quando recebe energia do celular ou leitor. O limite importante: um navegador comum ainda precisa de internet para carregar o passport e pedir o veredito final ao backend nexID. Para areas remotas, use validacao diferida: guardar/retry do tap e finalizar quando a conexao voltar. Para uso industrial offline, use app ou leitor controlado com chaves de validacao provisionadas com seguranca. Nao prometa wallet, garantia, ownership, NFT ou CRM 100% offline no browser.",
      offline_verifier: "Sim, um verificador offline e possivel, mas precisa ser um sistema controlado, nao um browser comum. Caminho um: app de campo Android/iOS com APIs nativas de NFC (Android NfcAdapter/IsoDep, iOS Core NFC/ISO 7816 quando permitido) ou NXP TapLinx no Android. Caminho dois: leitor dedicado Type 4/APDU para armazens, zonas rurais ou linha de producao. Regra de seguranca: nunca colocar master keys do tenant dentro do app e nao usar a mesma master key para todas as tags para sempre. Use chaves derivadas por device, batch e prazo, fila local cifrada, revogacao e sync com backend. O veredito offline deve ser provisional ate nexID confirmar replay, politica, garantia, ownership e auditoria no servidor.",
      reseller: "Para revendedores, empacotamos hardware + encoding + SaaS + onboarding. A historia de valor e receita recorrente, CRM de leads, exports de analytics, dashboards por tenant e rollout white-label.",
      quote: "Para cotar bem preciso de vertical, volume anual, perfil de tag (QR/NTAG215/424 DNA/424 TT), pais e se voce compra como marca ou reseller. A calculadora modela cliente empresa vs margem reseller.",
      tokenization: "Tokenizacao e premium e opcional. Mantemos NFC/SUN como camada principal de confianca e adicionamos ownership, certificados, garantia transferivel ou revenda em Polygon somente com toque fresco, comprador validado e politica do tenant aprovada.",
      iota_proof: "IOTA entra como camada opcional de prova/auditoria, nao como fluxo principal de toque do consumidor. A plataforma pode ancorar hashes ou Merkle roots para DPP, ciclo de lote e logistica, mantendo dados privados e taps individuais off-chain.",
      industrial_trace: "Para rastreabilidade industrial, use UHF/IoT em pallets, caixas e sensores, conectando essa evidencia ao mesmo passport. QR/NFC do consumidor fica simples; operacoes ganham rota, temperatura, custodia e auditoria.",
      gs1_qr: "GS1 Digital Link e QR sao a camada economica de identidade e resolver: GTIN, lote, serie, recall, conteudo e compatibilidade retail. Sao fallback visivel, mas nao liberam ownership premium sozinhos.",
      partnership_risk: "Cuidado no wording: Polygon e IOTA sao tecnologias integraveis, nao parcerias oficiais salvo acordo publico assinado. O claim seguro e suporte arquitetural ou caminho de integracao, nao endorsement.",
      demo: "Para uma demo forte, mostre tres momentos: produto nasce na origem, cliente toca no destino com rota/distancia e acao pos-toque: garantia, clube, voucher, marketplace ou ownership.",
      integration: "Integracao normalmente precisa de API keys, webhooks, papeis por tenant, import de batch e contrato de validacao SUN/UID.",
      general: "Posso ajudar a escolher tag profile, estimar rollout, explicar Basic vs Secure vs Premium, planejar margem reseller ou montar uma demo.",
    };
    return `${answers[intent]}${leadLine}`;
  }

  const answers: Record<string, string> = {
    tag_stack: "Version corta: en nexID, 215 y 424 son perfiles de tag NFC, no codigos de pago. NTAG215 es BASIC: menor costo, tap rapido, brazaletes/eventos, activos serializados y campanas QR/NFC de bajo riesgo. NTAG 424 DNA es SECURE: SUN/SDM dinamico, cada tap genera evidencia criptografica fresca de presencia fisica. NTAG 424 DNA TagTamper agrega evidencia de sello abierto/cerrado cuando el circuito tamper esta fisicamente integrado. Recomendacion: 215 para escala simple; 424 DNA/TT cuando hay que probar presencia fisica autentica primero, y despues aplicar politica nexID para ruta, ownership, garantia, certificado o reventa.",
    offline_validation: "Si, NFC se puede leer sin internet, y NTAG 424 DNA puede generar una respuesta criptografica SUN/SDM fresca offline porque el chip la calcula internamente cuando recibe energia del celular o lector. El limite importante: un navegador comun igual necesita internet para cargar el pasaporte y pedirle a nexID el veredicto final. Para zonas remotas, usamos validacion diferida: guardar/reintentar el tap y finalizar cuando vuelve la conexion. Para uso industrial offline, se necesita app o lector controlado con claves de validacion provisionadas de forma segura. No prometemos wallet, garantia, ownership, NFT ni CRM 100% offline en browser.",
    offline_verifier: "Si, un verificador offline se puede construir, pero tiene que ser un sistema controlado, no un navegador comun. Camino uno: app de campo Android/iOS con APIs NFC nativas (Android NfcAdapter/IsoDep, iOS Core NFC/ISO 7816 cuando aplique) o NXP TapLinx en Android. Camino dos: lector dedicado Type 4/APDU para deposito, campo, fabrica o QA. La regla de seguridad es clave: nunca meter master keys del tenant dentro de la app y no usar la misma master key para todas las tags para siempre. Usar claves derivadas por dispositivo, batch y vencimiento, cola local cifrada, revocacion y sync con backend. El veredicto offline debe mostrarse como provisional hasta que nexID confirme replay, politica, garantia, ownership y auditoria en servidor.",
    reseller: "Para revendedores, el paquete es hardware + encoding + SaaS + onboarding. La historia de valor es margen inicial, MRR, CRM de leads, exportaciones, dashboard por tenant y rollout white-label. Arranca con Bodega Balmec, mostra taps en vivo y despues cotiza volumen + perfil de tag.",
    quote: "Para cotizar bien necesito vertical, volumen anual, perfil de tag (QR/NTAG215/424 DNA/424 TT), pais y si compras como marca o reseller. La calculadora separa cliente empresa vs margen reseller para que sea facil de explicar.",
    tokenization: "La tokenizacion es premium y opcional. La confianza principal queda en NFC/SUN; despues agregamos ownership, certificados, garantia transferible o reventa sobre Polygon solo con tap fresco, comprador validado y politica del tenant aprobada. MetaMask sirve para demo, pero el consumidor no deberia sufrir complejidad wallet.",
    iota_proof: "IOTA encaja como capa opcional de prueba/auditoria, no como flujo principal del tap del consumidor. La plataforma puede anclar hashes o Merkle roots para DPP, ciclo de lote y evidencia logistica, manteniendo datos privados y taps individuales off-chain.",
    industrial_trace: "Para trazabilidad industrial, UHF/IoT cubre pallets, cajas y eventos de sensores, conectado al mismo pasaporte del producto. El consumidor ve QR/NFC simple; operaciones ve ruta, temperatura, custodia y auditoria.",
    gs1_qr: "GS1 Digital Link y QR son la capa economica de identidad y resolver: GTIN, lote, serie, recall, contenido y compatibilidad retail. Son un fallback visible, pero no deberian habilitar ownership premium solos.",
    partnership_risk: "Cuidado con el wording: Polygon e IOTA son tecnologias integrables, no partnerships oficiales salvo acuerdo publico firmado. El claim seguro es soporte arquitectural o camino de integracion, no endorsement.",
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

  if (["tag_stack", "offline_validation", "offline_verifier", "iota_proof", "industrial_trace", "gs1_qr", "partnership_risk"].includes(localIntent)) {
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
