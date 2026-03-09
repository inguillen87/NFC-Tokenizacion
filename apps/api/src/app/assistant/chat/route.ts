export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

type Body = {
  locale?: string;
  role?: string;
  tenant?: string;
  question?: string;
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
    "nexID diferencia dos líneas: BASIC (NTAG213/215 para eventos y activaciones) y SECURE (NTAG 424 DNA TagTamper para autenticidad y antifraude).",
    "Con eso podés vender hardware + dashboard + API sin commodity pricing.",
    "Si me pasás datos mínimos, te dejo el lead listo para ventas ahora mismo.",
  ],
  "pt-BR": [
    "nexID separa duas linhas: BASIC (NTAG213/215) e SECURE (NTAG 424 DNA TagTamper).",
    "Isso permite vender hardware + dashboard + API sem comoditizar o produto.",
    "Com dados mínimos eu já registro o lead para vendas.",
  ],
  en: [
    "nexID has two lines: BASIC (NTAG213/215) and SECURE (NTAG 424 DNA TagTamper).",
    "That supports a hardware + dashboard + API model without commodity pricing.",
    "Share minimum data and I can save your lead immediately.",
  ],
};

function detectIntent(question: string) {
  const q = question.toLowerCase();
  if (q.includes("batch") || q.includes("manifest")) return "ops";
  if (q.includes("precio") || q.includes("cost") || q.includes("quote") || q.includes("cot")) return "pricing";
  if (q.includes("reseller") || q.includes("revendedor") || q.includes("revenda") || q.includes("white-label")) return "reseller";
  if (q.includes("ticket") || q.includes("soporte") || q.includes("support")) return "ticket";
  if (q.includes("pedido") || q.includes("order") || q.includes("chips") || q.includes("comprar")) return "order";
  return "general";
}

function parseVolume(text: string) {
  const normalized = text.toLowerCase().replace(/\./g, "");
  const compact = normalized.match(/(\d+)\s*k\b/);
  if (compact?.[1]) return Number(compact[1]) * 1000;
  const exact = normalized.match(/\b(\d{4,7})\b/);
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

function extractLeadData(question: string): ExtractedLead {
  const q = question.toLowerCase();
  const volume = parseVolume(question);
  const tagType = q.includes("424") || q.includes("secure") || q.includes("tagtamper") ? "secure" : q.includes("215") || q.includes("213") || q.includes("basic") ? "basic" : null;
  const vertical = q.includes("wine") || q.includes("vino") || q.includes("bodega")
    ? "wine"
    : q.includes("cosmetic") || q.includes("cosm")
      ? "cosmetics"
      : q.includes("pharma") || q.includes("farma")
        ? "pharma"
        : q.includes("event") || q.includes("fiesta")
          ? "events"
          : q.includes("agro")
            ? "agro"
            : null;

  const companyMatch = question.match(/(?:empresa|company|compañ[ií]a)\s*[:\-]\s*([^,\n]+)/i);
  const countryMatch = question.match(/(?:pa[ií]s|country|argentina|chile|uruguay|colombia|mexico|brazil|brasil|peru)\s*[:\-]?\s*([^,\n]+)?/i);

  return {
    company: companyMatch?.[1]?.trim() || null,
    country: countryMatch?.[0]?.trim() || null,
    vertical,
    tagType,
    volume,
  };
}

function buildFallbackAnswer(locale: string, intent: string, extracted: ExtractedLead, missing: string[]) {
  const base = fallbackByLocale[locale] || fallbackByLocale["es-AR"];
  const extraByLocale = {
    "es-AR": {
      pricing: "Para cotizar: volumen + tipo de tag + país + contacto.",
      reseller: "Para activar reseller: nombre + email/WhatsApp + país + volumen estimado.",
      ticket: "Te genero un ticket de soporte con prioridad comercial.",
      done: "Perfecto: ya tengo datos para registrar tu lead comercial.",
      missingPrefix: "Me falta:",
    },
    "pt-BR": {
      pricing: "Para cotar: volume + tipo de tag + país + contato.",
      reseller: "Para canal revenda: nome + email/WhatsApp + país + volume estimado.",
      ticket: "Posso abrir um ticket de suporte comercial.",
      done: "Perfeito: já tenho dados para salvar seu lead.",
      missingPrefix: "Ainda falta:",
    },
    en: {
      pricing: "To quote: volume + tag type + country + contact.",
      reseller: "For reseller onboarding: name + email/WhatsApp + country + estimated volume.",
      ticket: "I can open a support ticket with commercial priority.",
      done: "Great: I have enough data to save your lead.",
      missingPrefix: "Still missing:",
    },
  } as const;
  const localeExtra = extraByLocale[locale as keyof typeof extraByLocale] || extraByLocale["es-AR"];

  const intentLine = intent === "pricing" ? localeExtra.pricing : intent === "reseller" ? localeExtra.reseller : intent === "ticket" ? localeExtra.ticket : "";
  const missingLine = missing.length > 0 ? `${localeExtra.missingPrefix} ${missing.join(", ")}.` : localeExtra.done;
  const extractedLine = extracted.volume || extracted.tagType || extracted.vertical
    ? `Contexto detectado: ${extracted.volume ? `volumen=${extracted.volume}` : ""} ${extracted.tagType ? `tag=${extracted.tagType}` : ""} ${extracted.vertical ? `vertical=${extracted.vertical}` : ""}`.trim()
    : "";

  return [base[0], intentLine, missingLine, extractedLine].filter(Boolean).join("\n");
}

async function buildOpenAiAnswer({ locale, question, intent, kb }: { locale: string; question: string; intent: string; kb: Array<Record<string, string>> }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const context = kb.map((item) => `- ${item.title}: ${item.body.slice(0, 450)}`).join("\n");
  const system = [
    "You are nexID Sales AI.",
    "Be concise, concrete, and never loop asking the same question if data is already present.",
    "If user already shared name/email/phone/volume/tag/country, acknowledge it and ask only missing fields.",
    "Return JSON with keys: answer, company, country, vertical, tagType, volume, buyingIntent, nextStep.",
  ].join(" ");

  const preferredModel = process.env.OPENAI_CHAT_MODEL || "gpt-audio-1.5";
  const fallbacks = [preferredModel, "gpt-4o-mini"].filter((m, i, arr) => arr.indexOf(m) === i);

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
          temperature: 0.25,
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
      phone = ${params.whatsapp}, estimated_volume = ${String(params.volume || "")}, message = ${params.question}, notes = ${notes}
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
    VALUES (${params.locale}, ${params.contact}, ${params.fullName}, ${params.email}, ${params.whatsapp}, ${params.company}, ${params.country}, ${params.vertical}, '', ${String(params.volume || "")}, ${params.tagType}, ${params.volume}, ${params.source}, ${params.status}, ${params.question}, ${notes})
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

export async function POST(req: Request) {
  const body: Body = await req.json().catch(() => ({}));
  const locale = body.locale || "es-AR";
  const question = String(body.question || "").trim();
  const historyText = Array.isArray(body.history) ? body.history.map((m) => String(m?.text || "")).join("\n") : "";
  const intent = detectIntent(`${historyText}\n${question}`);
  const extractedFromQuestion = extractLeadData(`${historyText}\n${question}`);

  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || extractEmail(`${question}\n${historyText}`)).trim();
  const whatsapp = String(body.whatsapp || extractWhatsApp(`${question}\n${historyText}`)).trim();
  const contact = String(body.contact || [email, whatsapp, fullName].filter(Boolean).join(" | ")).trim();
  const hasContact = Boolean(email || whatsapp || contact);
  const hasQualifiedLeadData = fullName.length > 2 && hasContact;

  const missing: string[] = [];
  if (!fullName) missing.push(locale === "en" ? "full name" : "nombre");
  if (!hasContact) missing.push(locale === "en" ? "email or whatsapp" : "email o whatsapp");
  if (!extractedFromQuestion.volume) missing.push(locale === "en" ? "volume" : "volumen");
  if (!extractedFromQuestion.tagType) missing.push(locale === "en" ? "tag type (213/215 or 424)" : "tipo de tag (213/215 o 424)");
  if (!extractedFromQuestion.country) missing.push(locale === "en" ? "country" : "país");

  const requiresContact = missing.length > 0 && (intent === "pricing" || intent === "reseller" || intent === "order");

  const kbRows = await sql/*sql*/`
    SELECT locale, slug, title, body
    FROM knowledge_articles
    WHERE locale = ${locale}
    ORDER BY updated_at DESC
    LIMIT 12
  `.catch(() => [] as Array<Record<string, string>>);

  const selected = kbRows.slice(0, 3);

  const openAiPayload = await buildOpenAiAnswer({ locale, question, intent, kb: selected });
  const extracted: ExtractedLead = {
    company: openAiPayload?.company || extractedFromQuestion.company,
    country: openAiPayload?.country || extractedFromQuestion.country,
    vertical: openAiPayload?.vertical || extractedFromQuestion.vertical,
    tagType: openAiPayload?.tagType || extractedFromQuestion.tagType,
    volume: typeof openAiPayload?.volume === "number" ? openAiPayload.volume : extractedFromQuestion.volume,
  };

  const leadStatus = openAiPayload?.buyingIntent === "high" ? "hot" : openAiPayload?.buyingIntent === "medium" ? "qualified" : "new";

  const shouldSaveLead = hasQualifiedLeadData && (
    body.mode === "lead_capture" || intent === "pricing" || intent === "reseller" || intent === "order" || intent === "general"
  );

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
      source: String(body.mode || "assistant"),
      status: leadStatus,
      question,
    });
  }

  if (hasContact && intent === "ticket") {
    await sql/*sql*/`
      INSERT INTO tickets (locale, contact, title, detail, status)
      VALUES (${locale}, ${contact}, 'Assistant support request', ${question.slice(0, 500)}, 'open')
    `.catch(() => null);
  }

  if (hasQualifiedLeadData && intent === "order") {
    await sql/*sql*/`
      INSERT INTO order_requests (locale, contact, company, tag_type, volume, notes, status)
      VALUES (${locale}, ${contact}, ${extracted.company || ""}, ${extracted.tagType || "basic"}, ${extracted.volume || 0}, ${`${fullName ? `name=${fullName}; ` : ""}${question}`.slice(0, 700)}, 'new')
    `.catch(() => null);
  }

  const savedAck = shouldSaveLead
    ? locale === "en"
      ? "Lead saved in CRM. Sales team can now continue with quote/samples/reseller onboarding."
      : locale === "pt-BR"
        ? "Lead salvo no CRM. O time comercial já pode continuar com proposta/amostras/revenda."
        : "Lead guardado en CRM. El equipo comercial ya puede continuar con cotización/muestras/revendedor."
    : "";

  const answer = openAiPayload?.answer || buildFallbackAnswer(locale, intent, extracted, missing);
  const persuasionNextStep = openAiPayload?.nextStep || "";

  return json({
    answer: [answer, savedAck, persuasionNextStep].filter(Boolean).join("\n\n"),
    intent,
    requiresContact,
    leadSaved: shouldSaveLead,
    extracted,
    citations: selected.map((item) => ({ title: item.title, slug: item.slug, locale: item.locale })),
    suggested:
      locale === "pt-BR"
        ? ["Quero cotação 10k", "Quero amostras", "Quero ser revendedor"]
        : locale === "en"
          ? ["I want a quote for 10k", "I want samples", "I want to become a reseller"]
          : ["Quiero cotización 10k", "Quiero muestras", "Quiero ser revendedor"],
  });
}
