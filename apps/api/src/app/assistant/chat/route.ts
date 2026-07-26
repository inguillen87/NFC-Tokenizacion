export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { ensureCrmOpsSchema } from "../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";

const MAX_ASSISTANT_BODY_BYTES = 32 * 1024;
const MAX_QUESTION_CHARS = 4_000;
const MAX_HISTORY_ITEMS = 12;
const MAX_HISTORY_ITEM_CHARS = 1_000;
const MAX_HISTORY_TOTAL_CHARS = 8_000;
const SUPPORTED_LOCALES = new Set(["es-AR", "pt-BR", "en"]);
const SUPPORTED_MODES = new Set(["assistant", "lead_capture", "realtime_ai"]);
const HISTORY_ROLES = new Set(["user", "assistant"]);

type Body = {
  locale?: string;
  role?: string;
  tenant?: string;
  question?: string;
  message?: string;
  contact?: string;
  fullName?: string;
  email?: string;
  whatsapp?: string;
  mode?: string;
  history?: Array<{ role?: string; text?: string }>;
};

type ExtractedLead = {
  company: string | null;
  country: string | null;
  vertical: string | null;
  tagType: string | null;
  volume: number | null;
};

type OpenAILeadPayload = {
  answer?: string;
  company?: string | null;
  country?: string | null;
  vertical?: string | null;
  tagType?: string | null;
  volume?: number | null;
  buyingIntent?: "low" | "medium" | "high";
  nextStep?: string;
};

const fallbackByLocale: Record<string, string[]> = {
  "es-AR": [
    "nexID conecta identidad digital de producto, evidencia de mensajes NFC, pasaporte movil, CRM y acciones post-compra.",
    "BASIC sirve para activaciones simples. SECURE y PREMIUM agregan evidencia SUN/SDM, senales contra replay o URLs copiadas y estado TT reportado. Eso no certifica por si solo el producto fisico, su contenido, origen, ruta ni propietario.",
    "Si me pasas volumen, pais, vertical y contacto, dejo el lead listo para cotizacion o reunion privada.",
  ],
  "pt-BR": [
    "nexID conecta identidade digital do produto, evidencia de mensagens NFC, passport mobile, CRM e acoes pos-compra.",
    "BASIC serve para ativacoes simples. SECURE e PREMIUM adicionam evidencia SUN/SDM, sinais contra replay ou URLs copiadas e estado TT reportado. Isso nao certifica sozinho o produto fisico, o conteudo, a origem, a rota nem o proprietario.",
    "Com volume, pais, vertical e contato eu registro o lead para proposta ou reuniao privada.",
  ],
  en: [
    "nexID connects digital product identity, NFC message evidence, mobile passports, CRM and post-purchase actions.",
    "BASIC supports simple activations. SECURE and PREMIUM add SUN/SDM evidence, replay or copied-URL signals and reported TT state. That does not by itself certify the physical product, contents, origin, route or owner.",
    "Share volume, country, vertical and contact and I can create the quote/private-meeting lead.",
  ],
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function limited(value: unknown, maximum: number) {
  return clean(value).slice(0, maximum);
}

function validEmail(value: string) {
  return /^[^\s@]{1,64}@[^\s@]{1,255}$/.test(value) && value.length <= 320;
}

function validPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function detectIntent(question: string) {
  const q = question.toLowerCase();
  if (/\b(215|213|424|ntag|tagtamper|sun|sdm|qr)\b/i.test(q)) return "tag_comparison";
  if (q.includes("batch") || q.includes("manifest")) return "ops";
  if (q.includes("precio") || q.includes("cost") || q.includes("quote") || q.includes("cot") || q.includes("presupuesto") || q.includes("pricing")) return "pricing";
  if (q.includes("reseller") || q.includes("revendedor") || q.includes("revenda") || q.includes("white-label") || q.includes("canal")) return "reseller";
  if (q.includes("ticket") || q.includes("soporte") || q.includes("support")) return "ticket";
  if (q.includes("pedido") || q.includes("order") || q.includes("chips") || q.includes("comprar") || q.includes("muestra") || q.includes("sample")) return "order";
  if (q.includes("demo") || q.includes("reunion") || q.includes("meeting") || q.includes("llamada") || q.includes("videollamada")) return "meeting";
  if (q.includes("api") || q.includes("webhook") || q.includes("integr")) return "integration";
  return "general";
}

function parseVolume(text: string) {
  const normalized = text.toLowerCase().replace(/\./g, "");
  const compact = normalized.match(/(\d+)\s*k\b/);
  if (compact?.[1]) return Number(compact[1]) * 1000;
  const exact = normalized.match(/\b(\d{4,9})\b/);
  return exact ? Number(exact[1]) : null;
}

function extractEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.trim() || "";
}

function extractWhatsApp(text: string) {
  const match = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return match?.[0]?.replace(/\s+/g, " ").trim() || "";
}

function detectCountry(text: string) {
  const q = text.toLowerCase();
  const countries = [
    ["argentina", "Argentina"],
    ["chile", "Chile"],
    ["uruguay", "Uruguay"],
    ["colombia", "Colombia"],
    ["mexico", "Mexico"],
    ["brasil", "Brasil"],
    ["brazil", "Brasil"],
    ["peru", "Peru"],
    ["usa", "United States"],
    ["estados unidos", "United States"],
    ["united states", "United States"],
    ["spain", "Spain"],
    ["espana", "Spain"],
  ] as const;
  return countries.find(([needle]) => q.includes(needle))?.[1] || null;
}

function extractLeadData(question: string): ExtractedLead {
  const q = question.toLowerCase();
  const volume = parseVolume(question);
  const tagType = q.includes("424") || q.includes("secure") || q.includes("tagtamper")
    ? "ntag424-dna"
    : q.includes("215")
      ? "ntag215"
      : q.includes("213") || q.includes("basic")
        ? "ntag213-basic"
        : q.includes("qr")
          ? "qr"
          : null;
  const vertical = q.includes("wine") || q.includes("vino") || q.includes("bodega") || q.includes("botella")
    ? "wine"
    : q.includes("cosmetic") || q.includes("cosm") || q.includes("crema") || q.includes("perfume")
      ? "cosmetics"
      : q.includes("pharma") || q.includes("farma")
        ? "pharma"
        : q.includes("event") || q.includes("fiesta") || q.includes("brazalete") || q.includes("entrada")
          ? "events"
          : q.includes("agro") || q.includes("semilla")
            ? "agro"
            : q.includes("zapat") || q.includes("sneaker") || q.includes("ropa") || q.includes("moda")
              ? "luxury"
              : null;

  const companyMatch = question.match(/(?:empresa|company|compania|marca)\s*[:\-]\s*([^,\n]+)/i);

  return {
    company: companyMatch?.[1]?.trim() || null,
    country: detectCountry(question),
    vertical,
    tagType,
    volume,
  };
}

function buildTagComparisonAnswer(locale: string) {
  if (locale === "en") {
    return [
      "For nexID, 215 and 424 are not payment codes. They are NFC tag profiles.",
      "NTAG 215: lower-cost NFC for simple identity, event wristbands, serialized assets, basic tap UX and QR/NFC campaigns. Good when the risk is low and the goal is speed.",
      "NTAG 424 DNA: secure NFC with dynamic SUN/SDM message evidence and controls against replay or copied URLs. It is useful for bottles, cosmetics, luxury goods, warranty review, ownership workflows and post-purchase actions.",
      "NTAG 424 DNA TagTamper: adds a configured TT state reported as closed, open or tamper. That signal does not by itself certify the physical seal, contents or product.",
      "My recommendation: use 215 for low-risk scale and 424 DNA/TT when the brand needs stronger tag-message evidence for warranty or ownership review. Origin, route and physical ownership require additional records, policy and approval.",
    ].join("\n");
  }

  if (locale === "pt-BR") {
    return [
      "Para nexID, 215 e 424 nao sao codigos de pagamento. Sao perfis de tag NFC.",
      "NTAG 215: NFC de menor custo para identidade simples, pulseiras, ativos serializados, tap rapido e campanhas QR/NFC. Serve quando o risco e baixo e a meta e velocidade.",
      "NTAG 424 DNA: NFC seguro com evidencia dinamica de mensagem SUN/SDM e controles contra replay ou URLs copiadas. Serve para garantia, revisao de ownership e acoes pos-compra.",
      "NTAG 424 DNA TagTamper: acrescenta um estado TT configurado e reportado como fechado, aberto ou tamper. Esse sinal nao certifica sozinho o lacre fisico, o conteudo nem o produto.",
      "Recomendacao: 215 para escala de baixo risco; 424 DNA/TT quando a marca precisa de evidencia mais forte da mensagem do tag para revisar garantia ou ownership. Origem, rota e propriedade fisica exigem registros, politica e aprovacao adicionais.",
    ].join("\n");
  }

  return [
    "Para nexID, 215 y 424 no son codigos de pago. Son perfiles de tag NFC.",
    "NTAG 215: NFC de menor costo para identidad simple, brazaletes/eventos, activos serializados, tap rapido y campanas QR/NFC. Sirve cuando el riesgo es bajo y la prioridad es escala.",
    "NTAG 424 DNA: NFC seguro con evidencia dinamica de mensaje SUN/SDM y controles contra replay o URLs copiadas. Sirve para garantia, revision de ownership y acciones post-compra.",
    "NTAG 424 DNA TagTamper: agrega un estado TT configurado y reportado como cerrado, abierto o tamper. Esa senal no certifica por si sola el sello fisico, el contenido ni el producto.",
    "Recomendacion: 215 para escala de bajo riesgo; 424 DNA/TT cuando la marca necesita evidencia mas fuerte del mensaje del tag para revisar garantia u ownership. Origen, ruta y propiedad fisica requieren registros, politica y aprobacion adicionales.",
  ].join("\n");
}

function buildFallbackAnswer(locale: string, intent: string, extracted: ExtractedLead, missing: string[]) {
  if (intent === "tag_comparison") return buildTagComparisonAnswer(locale);

  const base = fallbackByLocale[locale] || fallbackByLocale["es-AR"];
  const extraByLocale = {
    "es-AR": {
      pricing: "Para cotizar sin humo necesito: volumen, vertical, pais, tag objetivo y contacto.",
      reseller: "Para reseller necesito: pais/territorio, volumen estimado, capacidad comercial y contacto.",
      ticket: "Abro ticket comercial para que no se pierda la conversacion.",
      meeting: "Puedo dejar pedido de reunion privada con contexto comercial, muestra y vertical.",
      integration: "La integracion se arma con API keys, webhooks, batches, roles y contrato SUN/UID.",
      done: "Ya tengo base suficiente para registrar oportunidad comercial.",
      missingPrefix: "Falta:",
    },
    "pt-BR": {
      pricing: "Para cotar bem preciso: volume, vertical, pais, perfil de tag e contato.",
      reseller: "Para revenda preciso: pais/territorio, volume estimado, capacidade comercial e contato.",
      ticket: "Abro ticket comercial para nao perder a conversa.",
      meeting: "Posso registrar pedido de reuniao privada com contexto comercial, amostra e vertical.",
      integration: "A integracao usa API keys, webhooks, batches, roles e contrato SUN/UID.",
      done: "Ja tenho base suficiente para registrar a oportunidade comercial.",
      missingPrefix: "Falta:",
    },
    en: {
      pricing: "To quote properly I need volume, vertical, country, target tag profile and contact.",
      reseller: "For reseller onboarding I need country/territory, estimated volume, commercial capacity and contact.",
      ticket: "I can open a commercial ticket so the conversation is not lost.",
      meeting: "I can create a private-meeting request with commercial context, samples and vertical.",
      integration: "Integration is built around API keys, webhooks, batches, roles and the SUN/UID contract.",
      done: "I have enough context to create a commercial opportunity.",
      missingPrefix: "Missing:",
    },
  } as const;
  const localeExtra = extraByLocale[locale as keyof typeof extraByLocale] || extraByLocale["es-AR"];

  const intentLine =
    intent === "pricing" ? localeExtra.pricing :
    intent === "reseller" ? localeExtra.reseller :
    intent === "ticket" ? localeExtra.ticket :
    intent === "meeting" ? localeExtra.meeting :
    intent === "integration" ? localeExtra.integration :
    "";
  const missingLine = missing.length > 0 ? `${localeExtra.missingPrefix} ${missing.join(", ")}.` : localeExtra.done;
  const extractedLine = extracted.volume || extracted.tagType || extracted.vertical
    ? `Contexto detectado: ${extracted.volume ? `volumen=${extracted.volume}` : ""} ${extracted.tagType ? `tag=${extracted.tagType}` : ""} ${extracted.vertical ? `vertical=${extracted.vertical}` : ""}`.trim()
    : "";

  return [base[0], base[1], intentLine, missingLine, extractedLine].filter(Boolean).join("\n");
}

async function buildOpenAiAnswer({ locale, question, intent, kb }: { locale: string; question: string; intent: string; kb: Array<Record<string, string>> }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const context = kb.map((item) => `- ${item.title}: ${item.body.slice(0, 450)}`).join("\n");
  const system = [
    "You are the nexID commercial AI for NFC product digitization.",
    "Never answer as a generic payments, banking, crypto or support chatbot.",
    "The buyer is evaluating NFC/QR tags, product passports, SUN/SDM message validation, replay or copied-URL signals, warranty, CRM, reseller channel or private demo.",
    "Core domain facts: NTAG213/215 are BASIC low-cost tags for simple serialized taps, events and campaigns. NTAG 424 DNA is SECURE and provides dynamic SUN/SDM message evidence. NTAG 424 DNA TagTamper adds a configured TT state reported by the tag for policy workflows.",
    "A tag message, QR scan, reported TT state or blockchain hash does not by itself certify the physical product, seal, contents, origin, route, payment, custody or owner. Those claims require independent records and tenant authorization.",
    "Answer in the requested locale. Be concrete, sales-useful and short. Ask only for missing lead fields.",
    "If there is buying intent, push toward samples, quote or private meeting. Do not invent exact unit prices.",
    "Return JSON with keys: answer, company, country, vertical, tagType, volume, buyingIntent, nextStep.",
  ].join(" ");

  const preferredModel = process.env.OPENAI_CHAT_MODEL || "gpt-5-mini";
  const fallbacks = [preferredModel, "gpt-5-nano", "gpt-4o-mini"].filter((m, i, arr) => arr.indexOf(m) === i);

  for (const model of fallbacks) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.18,
          max_completion_tokens: 650,
          messages: [
            { role: "system", content: system },
            { role: "user", content: `Locale: ${locale}\nIntent: ${intent}\nQuestion: ${question}\nKnowledge base:\n${context}` },
          ],
          response_format: { type: "json_object" },
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) continue;
      return JSON.parse(text) as OpenAILeadPayload;
    } catch {
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

async function upsertLeadCompat(params: {
  locale: string;
  contact: string;
  fullName: string;
  email: string;
  whatsapp: string;
  company: string;
  country: string;
  vertical: string;
  tagType: string;
  volume: number;
  roleInterest: string;
  source: string;
  status: string;
  question: string;
}) {
  const recent = await sql/*sql*/`
    SELECT id FROM leads WHERE contact = ${params.contact} ORDER BY created_at DESC LIMIT 1
  `.catch(() => [] as Array<{ id: string }>);

  const notes = `${params.fullName ? `name=${params.fullName}; ` : ""}${params.question}`.slice(0, 900);

  const updateExtended = async (id: string) => sql/*sql*/`
    UPDATE leads
    SET locale = ${params.locale}, company = ${params.company}, country = ${params.country},
      vertical = ${params.vertical}, tag_type = ${params.tagType}, volume = ${params.volume},
      source = ${params.source}, status = ${params.status}, name = ${params.fullName}, email = ${params.email},
      phone = ${params.whatsapp}, role_interest = ${params.roleInterest}, estimated_volume = ${String(params.volume || "")},
      message = ${params.question}, notes = ${notes}
    WHERE id = ${id}
  `;

  const updateBasic = async (id: string) => sql/*sql*/`
    UPDATE leads
    SET locale = ${params.locale}, company = ${params.company}, country = ${params.country},
      vertical = ${params.vertical}, tag_type = ${params.tagType}, volume = ${params.volume},
      source = ${params.source}, status = ${params.status}, notes = ${notes}
    WHERE id = ${id}
  `;

  const insertExtended = async () => sql/*sql*/`
    INSERT INTO leads (locale, contact, name, email, phone, company, country, vertical, role_interest, estimated_volume, tag_type, volume, source, status, message, notes)
    VALUES (${params.locale}, ${params.contact}, ${params.fullName}, ${params.email}, ${params.whatsapp}, ${params.company}, ${params.country}, ${params.vertical}, ${params.roleInterest}, ${String(params.volume || "")}, ${params.tagType}, ${params.volume}, ${params.source}, ${params.status}, ${params.question}, ${notes})
  `;

  const insertBasic = async () => sql/*sql*/`
    INSERT INTO leads (locale, contact, company, country, vertical, tag_type, volume, source, status, notes)
    VALUES (${params.locale}, ${params.contact}, ${params.company}, ${params.country}, ${params.vertical}, ${params.tagType}, ${params.volume}, ${params.source}, ${params.status}, ${notes})
  `;

  if (recent[0]?.id) {
    try {
      await updateExtended(recent[0].id);
      return true;
    } catch {
      try {
        await updateBasic(recent[0].id);
        return true;
      } catch {
        return false;
      }
    }
  }

  try {
    await insertExtended();
    return true;
  } catch {
    try {
      await insertBasic();
      return true;
    } catch {
      return false;
    }
  }
}

async function createCommercialTicket(params: {
  locale: string;
  contact: string;
  title: string;
  detail: string;
  source: string;
}) {
  try {
    await sql/*sql*/`
      INSERT INTO tickets (locale, contact, title, detail, status, source)
      VALUES (${params.locale}, ${params.contact}, ${params.title}, ${params.detail.slice(0, 1200)}, 'open', ${params.source})
    `;
    return true;
  } catch {
    return false;
  }
}

function titleForTicket(locale: string, intent: string) {
  if (locale === "en") return intent === "meeting" ? "Private meeting request" : "Commercial lead from AI assistant";
  if (locale === "pt-BR") return intent === "meeting" ? "Pedido de reuniao privada" : "Lead comercial desde assistente AI";
  return intent === "meeting" ? "Pedido de reunion privada" : "Lead comercial desde asistente AI";
}

export async function POST(req: Request) {
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "ai_expensive",
    tenantId: "platform",
    subjectId: "assistant-chat:public",
  });
  if (rateLimited) return rateLimited;

  let body: Body;
  try {
    body = await readBoundedJsonBody<Body>(req, MAX_ASSISTANT_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, reason: "invalid_request_schema" }, 400);
  }

  const requestedLocale = clean(body.locale);
  if (requestedLocale && !SUPPORTED_LOCALES.has(requestedLocale)) {
    return json({ ok: false, reason: "unsupported_locale", supported: [...SUPPORTED_LOCALES] }, 400);
  }
  const locale = requestedLocale || "es-AR";
  const requestedMode = clean(body.mode);
  if (requestedMode && !SUPPORTED_MODES.has(requestedMode)) {
    return json({ ok: false, reason: "unsupported_mode" }, 400);
  }
  const mode = requestedMode || "assistant";

  const scalarLimits: Array<[keyof Body, number]> = [
    ["question", MAX_QUESTION_CHARS],
    ["message", MAX_QUESTION_CHARS],
    ["fullName", 120],
    ["email", 320],
    ["whatsapp", 32],
    ["contact", 320],
    ["tenant", 120],
    ["role", 40],
  ];
  for (const [field, maximum] of scalarLimits) {
    const value = body[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      return json({ ok: false, reason: "invalid_request_schema", field }, 400);
    }
    if (typeof value === "string" && value.trim().length > maximum) {
      return json({ ok: false, reason: "field_too_large", field }, 413);
    }
  }

  if (body.history !== undefined && !Array.isArray(body.history)) {
    return json({ ok: false, reason: "invalid_history" }, 400);
  }
  const rawHistory = body.history || [];
  if (rawHistory.length > MAX_HISTORY_ITEMS) {
    return json({ ok: false, reason: "history_too_large" }, 413);
  }
  const history: Array<{ role: "user" | "assistant"; text: string }> = [];
  let historyCharacters = 0;
  for (const item of rawHistory) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return json({ ok: false, reason: "invalid_history" }, 400);
    }
    const role = clean(item.role);
    const text = clean(item.text);
    if (!HISTORY_ROLES.has(role) || !text || text.length > MAX_HISTORY_ITEM_CHARS) {
      return json({ ok: false, reason: "invalid_history" }, 400);
    }
    historyCharacters += text.length;
    if (historyCharacters > MAX_HISTORY_TOTAL_CHARS) {
      return json({ ok: false, reason: "history_too_large" }, 413);
    }
    history.push({ role: role as "user" | "assistant", text });
  }

  const question = clean(body.question || body.message);
  if (!question) return json({ ok: false, reason: "question_required" }, 400);
  const historyText = history.map((item) => `${item.role}: ${item.text}`).join("\n");
  const conversationText = `${historyText}\n${question}`;
  const intent = detectIntent(conversationText);
  const extractedFromQuestion = extractLeadData(conversationText);

  const fullName = limited(body.fullName, 120);
  const explicitContact = limited(body.contact, 320);
  const email = limited(body.email || extractEmail(explicitContact) || extractEmail(conversationText), 320).toLowerCase();
  const whatsapp = limited(body.whatsapp || extractWhatsApp(explicitContact) || extractWhatsApp(conversationText), 32);
  if ((body.email && !validEmail(email)) || (body.whatsapp && !validPhone(whatsapp))) {
    return json({ ok: false, reason: body.email && !validEmail(email) ? "email_invalid" : "whatsapp_invalid" }, 400);
  }
  const contact = limited(explicitContact || [email, whatsapp].filter(Boolean).join(" | "), 320);
  const hasContact = validEmail(email) || validPhone(whatsapp);
  const hasQualifiedLeadData = fullName.length > 2 && hasContact;

  const missing: string[] = [];
  if (!fullName) missing.push(locale === "en" ? "full name" : locale === "pt-BR" ? "nome" : "nombre");
  if (!hasContact) missing.push(locale === "en" ? "email or WhatsApp" : "email o WhatsApp");
  if (!extractedFromQuestion.volume) missing.push(locale === "en" ? "volume" : "volumen");
  if (!extractedFromQuestion.tagType) missing.push(locale === "en" ? "tag profile" : "perfil de tag");
  if (!extractedFromQuestion.country) missing.push(locale === "en" ? "country" : locale === "pt-BR" ? "pais" : "pais");

  const requiresContact = missing.length > 0 && ["pricing", "reseller", "order", "meeting"].includes(intent);

  const crmReady = await ensureCrmOpsSchema().then(() => true).catch(() => false);
  const kbRows = crmReady
    ? await sql/*sql*/`
        SELECT locale, slug, title, body
        FROM knowledge_articles
        WHERE locale = ${locale}
        ORDER BY updated_at DESC
        LIMIT 12
      `.catch(() => [] as Array<Record<string, string>>)
    : [] as Array<Record<string, string>>;

  const selected = kbRows.slice(0, 3);
  const forcedDomainAnswer = intent === "tag_comparison" ? buildTagComparisonAnswer(locale) : "";
  const openAiPayload = forcedDomainAnswer ? null : await buildOpenAiAnswer({ locale, question, intent, kb: selected });
  const aiVolume = typeof openAiPayload?.volume === "number" && Number.isFinite(openAiPayload.volume)
    ? Math.max(0, Math.min(Math.trunc(openAiPayload.volume), 10_000_000))
    : null;
  const extracted: ExtractedLead = {
    company: limited(openAiPayload?.company || extractedFromQuestion.company, 160) || null,
    country: limited(openAiPayload?.country || extractedFromQuestion.country, 80) || null,
    vertical: limited(openAiPayload?.vertical || extractedFromQuestion.vertical, 40) || null,
    tagType: limited(openAiPayload?.tagType || extractedFromQuestion.tagType, 40) || null,
    volume: aiVolume ?? extractedFromQuestion.volume,
  };

  const leadStatus = openAiPayload?.buyingIntent === "high" || intent === "pricing" || intent === "meeting"
    ? "hot"
    : openAiPayload?.buyingIntent === "medium" || intent === "reseller"
      ? "qualified"
      : "new";

  const commercialIntent = ["pricing", "reseller", "order", "meeting", "integration", "tag_comparison"].includes(intent);
  // `mode` controls presentation only. It is never accepted as write authorization.
  const shouldSaveLead = hasQualifiedLeadData && commercialIntent;
  const source = mode;
  let leadSaved = false;
  let ticketSaved = false;
  let orderSaved = false;

  if (shouldSaveLead && crmReady) {
    leadSaved = await upsertLeadCompat({
      locale,
      contact,
      fullName,
      email,
      whatsapp,
      company: extracted.company || "",
      country: extracted.country || "",
      vertical: extracted.vertical || "other",
      tagType: extracted.tagType || "unknown",
      volume: extracted.volume || 0,
      roleInterest: intent,
      source,
      status: leadStatus,
      question,
    });

    ticketSaved = await createCommercialTicket({
      locale,
      contact,
      title: titleForTicket(locale, intent),
      detail: [
        `intent=${intent}`,
        `status=${leadStatus}`,
        fullName ? `name=${fullName}` : "",
        email ? `email=${email}` : "",
        whatsapp ? `whatsapp=${whatsapp}` : "",
        extracted.vertical ? `vertical=${extracted.vertical}` : "",
        extracted.tagType ? `tag=${extracted.tagType}` : "",
        extracted.volume ? `volume=${extracted.volume}` : "",
        question,
      ].filter(Boolean).join(" | "),
      source: `assistant:${source}`,
    });
  }

  if (hasContact && intent === "ticket" && crmReady) {
    ticketSaved = await createCommercialTicket({
      locale,
      contact,
      title: "Assistant support request",
      detail: question,
      source,
    });
  }

  if (hasQualifiedLeadData && intent === "order" && crmReady) {
    orderSaved = await sql/*sql*/`
      INSERT INTO order_requests (locale, contact, company, tag_type, volume, notes, status, source)
      VALUES (${locale}, ${contact}, ${extracted.company || ""}, ${extracted.tagType || "basic"}, ${extracted.volume || 0}, ${`${fullName ? `name=${fullName}; ` : ""}${question}`.slice(0, 700)}, 'new', ${source})
    `.then(() => true).catch(() => false);
  }

  const savedAck = leadSaved && ticketSaved
    ? locale === "en"
      ? "Lead and ticket saved in CRM. Sales can continue with quote, samples or private meeting."
      : locale === "pt-BR"
        ? "Lead e ticket salvos no CRM. Vendas pode continuar com proposta, amostras ou reuniao privada."
        : "Lead y ticket guardados en CRM. Ventas puede seguir con cotizacion, muestras o reunion privada."
    : "";

  const answer = forcedDomainAnswer || openAiPayload?.answer || buildFallbackAnswer(locale, intent, extracted, missing);
  const persuasionNextStep = limited(openAiPayload?.nextStep, 500);
  const leadWriteRequested = shouldSaveLead;
  const ticketWriteRequested = shouldSaveLead || (hasContact && intent === "ticket");
  const orderWriteRequested = hasQualifiedLeadData && intent === "order";
  const persistenceIncomplete = (leadWriteRequested && !leadSaved)
    || (ticketWriteRequested && !ticketSaved)
    || (orderWriteRequested && !orderSaved);

  return json({
    ok: !persistenceIncomplete,
    answer: [answer, savedAck, persuasionNextStep].filter(Boolean).join("\n\n"),
    intent,
    requiresContact,
    leadSaved,
    ticketSaved,
    orderSaved,
    persistence: {
      crm_available: crmReady,
      requested: leadWriteRequested || ticketWriteRequested || orderWriteRequested,
      complete: !persistenceIncomplete,
      reason: persistenceIncomplete ? "crm_write_incomplete" : null,
    },
    extracted,
    citations: selected.map((item) => ({ title: item.title, slug: item.slug, locale: item.locale })),
    suggested:
      locale === "pt-BR"
        ? ["Quero proposta 10k", "Quero amostras", "Quero ser revendedor", "Quero reuniao privada"]
        : locale === "en"
          ? ["I want a quote for 10k", "I want samples", "I want to become a reseller", "Book a private meeting"]
          : ["Quiero cotizacion 10k", "Quiero muestras", "Quiero ser revendedor", "Quiero reunion privada"],
  }, persistenceIncomplete ? 503 : 200);
}
