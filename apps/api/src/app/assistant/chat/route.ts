export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { ensureCrmOpsSchema } from "../../../lib/commercial-runtime-schema";

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
    "nexID vende confianza verificable, no chips sueltos: producto fisico, tap NFC, SUN dinamico, pasaporte celular, CRM y acciones post-compra.",
    "BASIC sirve para activaciones rapidas. SECURE y PREMIUM sirven para autenticidad, antifraude, garantia, reventa y datos accionables.",
    "Si me pasas volumen, pais, vertical y contacto, dejo el lead listo para cotizacion o reunion privada.",
  ],
  "pt-BR": [
    "nexID vende confianca verificavel, nao chips soltos: produto fisico, tap NFC, SUN dinamico, passport mobile, CRM e acoes pos-compra.",
    "BASIC serve para ativacoes rapidas. SECURE e PREMIUM servem para autenticidade, antifraude, garantia, revenda e dados acionaveis.",
    "Com volume, pais, vertical e contato eu registro o lead para proposta ou reuniao privada.",
  ],
  en: [
    "nexID sells verifiable trust, not loose chips: physical product, NFC tap, dynamic SUN, mobile passport, CRM and post-purchase actions.",
    "BASIC is for fast activations. SECURE and PREMIUM are for authenticity, anti-fraud, warranty, resale and actionable data.",
    "Share volume, country, vertical and contact and I can create the quote/private-meeting lead.",
  ],
};

function clean(value: unknown) {
  return String(value || "").trim();
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
      "NTAG 424 DNA: secure NFC with dynamic SUN/SDM. Each tap generates different cryptographic evidence, so it is the right choice for bottles, cosmetics, luxury goods, warranty, ownership claims, anti-copy and post-purchase actions.",
      "NTAG 424 DNA TagTamper: premium seal profile. It can detect/open-state policy, so it is the best commercial story for capsules, seals, packaging and high-value products.",
      "My recommendation: use 215 for low-risk scale and 424 DNA/TT when the brand must prove authenticity, route, owner, warranty or resale value.",
    ].join("\n");
  }

  if (locale === "pt-BR") {
    return [
      "Para nexID, 215 e 424 nao sao codigos de pagamento. Sao perfis de tag NFC.",
      "NTAG 215: NFC de menor custo para identidade simples, pulseiras, ativos serializados, tap rapido e campanhas QR/NFC. Serve quando o risco e baixo e a meta e velocidade.",
      "NTAG 424 DNA: NFC seguro com SUN/SDM dinamico. Cada toque gera evidencia criptografica diferente; e a opcao certa para garrafas, cosmeticos, luxo, garantia, ownership, anti-copia e acoes pos-compra.",
      "NTAG 424 DNA TagTamper: perfil premium de lacre. Pode trabalhar com estado de abertura, ideal para tampas, selos, embalagens e produtos de alto valor.",
      "Recomendacao: 215 para escala de baixo risco; 424 DNA/TT quando a marca precisa provar autenticidade, rota, dono, garantia ou valor de revenda.",
    ].join("\n");
  }

  return [
    "Para nexID, 215 y 424 no son codigos de pago. Son perfiles de tag NFC.",
    "NTAG 215: NFC de menor costo para identidad simple, brazaletes/eventos, activos serializados, tap rapido y campanas QR/NFC. Sirve cuando el riesgo es bajo y la prioridad es escala.",
    "NTAG 424 DNA: NFC seguro con SUN/SDM dinamico. Cada tap genera evidencia criptografica distinta; es el perfil correcto para botellas, cosmetica, lujo, garantia, reclamo de dueno, anti-copia y acciones post-compra.",
    "NTAG 424 DNA TagTamper: perfil premium de sello. Permite una politica vinculada a apertura/manipulacion, ideal para capsulas, sellos, packaging y productos de alto valor.",
    "Recomendacion: 215 para escala de bajo riesgo; 424 DNA/TT cuando la marca necesita probar autenticidad, ruta, dueno, garantia o valor de reventa.",
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
    "The buyer is evaluating NFC/QR tags, product passports, SUN/SDM validation, anti-copy, warranty, CRM, reseller channel or private demo.",
    "Core domain facts: NTAG213/215 are BASIC low-cost tags for simple serialized taps, events and campaigns. NTAG 424 DNA is SECURE with dynamic SUN/SDM cryptographic tap evidence. NTAG 424 DNA TagTamper is PREMIUM for seals, caps and open-state policy.",
    "Answer in the requested locale. Be concrete, sales-useful and short. Ask only for missing lead fields.",
    "If there is buying intent, push toward samples, quote or private meeting. Do not invent exact unit prices.",
    "Return JSON with keys: answer, company, country, vertical, tagType, volume, buyingIntent, nextStep.",
  ].join(" ");

  const preferredModel = process.env.OPENAI_CHAT_MODEL || "gpt-5-mini";
  const fallbacks = [preferredModel, "gpt-5-nano", "gpt-4o-mini"].filter((m, i, arr) => arr.indexOf(m) === i);

  for (const model of fallbacks) {
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
          messages: [
            { role: "system", content: system },
            { role: "user", content: `Locale: ${locale}\nIntent: ${intent}\nQuestion: ${question}\nKnowledge base:\n${context}` },
          ],
          response_format: { type: "json_object" },
        }),
        cache: "no-store",
      });

      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) continue;
      return JSON.parse(text) as OpenAILeadPayload;
    } catch {
      continue;
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
    } catch {
      await updateBasic(recent[0].id).catch(() => null);
    }
    return;
  }

  try {
    await insertExtended();
  } catch {
    await insertBasic().catch(() => null);
  }
}

async function createCommercialTicket(params: {
  locale: string;
  contact: string;
  title: string;
  detail: string;
  source: string;
}) {
  await sql/*sql*/`
    INSERT INTO tickets (locale, contact, title, detail, status, source)
    VALUES (${params.locale}, ${params.contact}, ${params.title}, ${params.detail.slice(0, 1200)}, 'open', ${params.source})
  `.catch(() => null);
}

function titleForTicket(locale: string, intent: string) {
  if (locale === "en") return intent === "meeting" ? "Private meeting request" : "Commercial lead from AI assistant";
  if (locale === "pt-BR") return intent === "meeting" ? "Pedido de reuniao privada" : "Lead comercial desde assistente AI";
  return intent === "meeting" ? "Pedido de reunion privada" : "Lead comercial desde asistente AI";
}

export async function POST(req: Request) {
  await ensureCrmOpsSchema();
  const body: Body = await req.json().catch(() => ({}));
  const locale = body.locale || "es-AR";
  const question = clean(body.question || body.message);
  const historyText = Array.isArray(body.history) ? body.history.map((m) => clean(m?.text)).join("\n") : "";
  const conversationText = `${historyText}\n${question}`;
  const intent = detectIntent(conversationText);
  const extractedFromQuestion = extractLeadData(conversationText);

  const fullName = clean(body.fullName);
  const email = clean(body.email || extractEmail(conversationText));
  const whatsapp = clean(body.whatsapp || extractWhatsApp(conversationText));
  const contact = clean(body.contact || [email, whatsapp, fullName].filter(Boolean).join(" | "));
  const hasContact = Boolean(email || whatsapp || contact);
  const hasQualifiedLeadData = fullName.length > 2 && hasContact;

  const missing: string[] = [];
  if (!fullName) missing.push(locale === "en" ? "full name" : locale === "pt-BR" ? "nome" : "nombre");
  if (!hasContact) missing.push(locale === "en" ? "email or WhatsApp" : "email o WhatsApp");
  if (!extractedFromQuestion.volume) missing.push(locale === "en" ? "volume" : "volumen");
  if (!extractedFromQuestion.tagType) missing.push(locale === "en" ? "tag profile" : "perfil de tag");
  if (!extractedFromQuestion.country) missing.push(locale === "en" ? "country" : locale === "pt-BR" ? "pais" : "pais");

  const requiresContact = missing.length > 0 && ["pricing", "reseller", "order", "meeting"].includes(intent);

  const kbRows = await sql/*sql*/`
    SELECT locale, slug, title, body
    FROM knowledge_articles
    WHERE locale = ${locale}
    ORDER BY updated_at DESC
    LIMIT 12
  `.catch(() => [] as Array<Record<string, string>>);

  const selected = kbRows.slice(0, 3);
  const forcedDomainAnswer = intent === "tag_comparison" ? buildTagComparisonAnswer(locale) : "";
  const openAiPayload = forcedDomainAnswer ? null : await buildOpenAiAnswer({ locale, question, intent, kb: selected });
  const extracted: ExtractedLead = {
    company: openAiPayload?.company || extractedFromQuestion.company,
    country: openAiPayload?.country || extractedFromQuestion.country,
    vertical: openAiPayload?.vertical || extractedFromQuestion.vertical,
    tagType: openAiPayload?.tagType || extractedFromQuestion.tagType,
    volume: typeof openAiPayload?.volume === "number" ? openAiPayload.volume : extractedFromQuestion.volume,
  };

  const leadStatus = openAiPayload?.buyingIntent === "high" || intent === "pricing" || intent === "meeting"
    ? "hot"
    : openAiPayload?.buyingIntent === "medium" || intent === "reseller"
      ? "qualified"
      : "new";

  const commercialIntent = ["pricing", "reseller", "order", "meeting", "integration", "tag_comparison"].includes(intent);
  const shouldSaveLead = hasQualifiedLeadData && (body.mode === "lead_capture" || body.mode === "realtime_ai" || commercialIntent || intent === "general");
  const source = clean(body.mode || "assistant");

  if (shouldSaveLead) {
    await upsertLeadCompat({
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

    await createCommercialTicket({
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

  if (hasContact && intent === "ticket") {
    await createCommercialTicket({
      locale,
      contact,
      title: "Assistant support request",
      detail: question,
      source,
    });
  }

  if (hasQualifiedLeadData && intent === "order") {
    await sql/*sql*/`
      INSERT INTO order_requests (locale, contact, company, tag_type, volume, notes, status, source)
      VALUES (${locale}, ${contact}, ${extracted.company || ""}, ${extracted.tagType || "basic"}, ${extracted.volume || 0}, ${`${fullName ? `name=${fullName}; ` : ""}${question}`.slice(0, 700)}, 'new', ${source})
    `.catch(() => null);
  }

  const savedAck = shouldSaveLead
    ? locale === "en"
      ? "Lead and ticket saved in CRM. Sales can continue with quote, samples or private meeting."
      : locale === "pt-BR"
        ? "Lead e ticket salvos no CRM. Vendas pode continuar com proposta, amostras ou reuniao privada."
        : "Lead y ticket guardados en CRM. Ventas puede seguir con cotizacion, muestras o reunion privada."
    : "";

  const answer = forcedDomainAnswer || openAiPayload?.answer || buildFallbackAnswer(locale, intent, extracted, missing);
  const persuasionNextStep = openAiPayload?.nextStep || "";

  return json({
    answer: [answer, savedAck, persuasionNextStep].filter(Boolean).join("\n\n"),
    intent,
    requiresContact,
    leadSaved: shouldSaveLead,
    ticketSaved: shouldSaveLead || (hasContact && intent === "ticket"),
    extracted,
    citations: selected.map((item) => ({ title: item.title, slug: item.slug, locale: item.locale })),
    suggested:
      locale === "pt-BR"
        ? ["Quero proposta 10k", "Quero amostras", "Quero ser revendedor", "Quero reuniao privada"]
        : locale === "en"
          ? ["I want a quote for 10k", "I want samples", "I want to become a reseller", "Book a private meeting"]
          : ["Quiero cotizacion 10k", "Quiero muestras", "Quiero ser revendedor", "Quiero reunion privada"],
  });
}
