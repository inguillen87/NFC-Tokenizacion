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
};

type ExtractedLead = {
  company: string | null;
  country: string | null;
  vertical: string | null;
  tagType: string | null;
  volume: number | null;
};

const fallbackByLocale: Record<string, string[]> = {
  "es-AR": [
    "nexID protege productos con NFC (NTAG215 y NTAG424 DNA TagTamper) y validación SUN/SDM.",
    "Para cotizar, indicame volumen (10k/50k/100k), tipo de tag (basic/secure) y contacto.",
    "Puedo crear un lead, ticket o pedido para que ventas te contacte hoy.",
  ],
  "pt-BR": [
    "nexID protege produtos com NFC (NTAG215 e NTAG424 DNA TagTamper) e validação SUN/SDM.",
    "Para cotação, informe volume (10k/50k/100k), tipo de tag (basic/secure) e contato.",
    "Posso criar lead, ticket ou pedido para o time comercial.",
  ],
  en: [
    "nexID secures products with NFC (NTAG215 and NTAG424 DNA TagTamper) and SUN/SDM validation.",
    "For a quote, share volume (10k/50k/100k), tag type (basic/secure), and contact details.",
    "I can create a lead, ticket, or order request so the sales team contacts you today.",
  ],
};

function detectIntent(question: string) {
  const q = question.toLowerCase();
  if (q.includes("batch") || q.includes("manifest")) return "ops";
  if (q.includes("precio") || q.includes("cost") || q.includes("quote") || q.includes("cot")) return "pricing";
  if (q.includes("reseller") || q.includes("white-label")) return "reseller";
  if (q.includes("ticket") || q.includes("soporte") || q.includes("support")) return "ticket";
  if (q.includes("pedido") || q.includes("order") || q.includes("chips") || q.includes("comprar")) return "order";
  return "general";
}

function parseVolume(question: string) {
  const normalized = question.toLowerCase().replace(/\./g, "");
  const compact = normalized.match(/(\d+)\s*k\b/);
  if (compact?.[1]) return Number(compact[1]) * 1000;
  const exact = normalized.match(/\b(\d{4,7})\b/);
  return exact ? Number(exact[1]) : null;
}

function extractLeadData(question: string): ExtractedLead {
  const q = question.toLowerCase();
  const volume = parseVolume(question);
  const tagType = q.includes("424") || q.includes("secure") || q.includes("tagtamper") ? "secure" : q.includes("215") || q.includes("basic") ? "basic" : null;
  const vertical = q.includes("wine") || q.includes("vino") || q.includes("bodega")
    ? "wine"
    : q.includes("cosmetic") || q.includes("cosm")
      ? "cosmetics"
      : q.includes("pharma") || q.includes("farma")
        ? "pharma"
        : q.includes("event")
          ? "events"
          : null;

  const companyMatch = question.match(/(?:empresa|company|compañ[ií]a)\s*[:\-]\s*([^,\n]+)/i);
  const countryMatch = question.match(/(?:pa[ií]s|country)\s*[:\-]\s*([^,\n]+)/i);

  return {
    company: companyMatch?.[1]?.trim() || null,
    country: countryMatch?.[1]?.trim() || null,
    vertical,
    tagType,
    volume,
  };
}

function buildFallbackAnswer(locale: string, intent: string, extracted: ExtractedLead) {
  const base = fallbackByLocale[locale] || fallbackByLocale["es-AR"];
  const extraByLocale = {
    "es-AR": {
      pricing: `¿Querés cotizar ${extracted.volume ? extracted.volume.toLocaleString() : "10.000"} o 50.000 unidades? ¿Tags básicos (NTAG215) o anti-fraude (NTAG 424 DNA TagTamper)?`,
      reseller: "Si querés canal reseller, pasame nombre completo + email/WhatsApp y te enviamos onboarding hoy.",
      ticket: "Registro tu ticket de soporte para que te contacte el equipo dentro de 24h.",
    },
    "pt-BR": {
      pricing: `Quer cotar ${extracted.volume ? extracted.volume.toLocaleString() : "10.000"} ou 50.000 unidades? Tags básicos (NTAG215) ou anti-fraude (NTAG 424 DNA TagTamper)?`,
      reseller: "Se você quer canal reseller, envie nome completo + email/WhatsApp para onboarding hoje.",
      ticket: "Vou registrar seu ticket de suporte para resposta em até 24h.",
    },
    en: {
      pricing: `Do you want a quote for ${extracted.volume ? extracted.volume.toLocaleString() : "10k"} or 50k units? Basic tags (NTAG215) or anti-fraud (NTAG 424 DNA TagTamper)?`,
      reseller: "If you want reseller channel, send full name + email/WhatsApp and we’ll share onboarding today.",
      ticket: "I will register your support ticket for a response within 24h.",
    },
  } as const;

  const extra = extraByLocale[locale as keyof typeof extraByLocale] || extraByLocale["es-AR"];
  const intentLine = intent === "pricing" ? extra.pricing : intent === "reseller" ? extra.reseller : intent === "ticket" ? extra.ticket : "";
  return `${base[0]} ${base[1]} ${base[2]} ${intentLine}`.trim();
}

async function buildOpenAiAnswer({ locale, question, intent, kb }: { locale: string; question: string; intent: string; kb: Array<Record<string, string>> }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const context = kb.map((x) => `- [${x.locale}/${x.slug}] ${x.title}: ${x.body.slice(0, 500)}`).join("\n");
  const system =
    "You are nexID sales/support assistant. Be concise, high-converting, and practical. " +
    "Always guide to next step for lead capture: full name + email or WhatsApp. " +
    "When intent is pricing/reseller/order ask for volume/tag type/contact and propose demo call. " +
    `Reply in locale ${locale}.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Intent: ${intent}\nQuestion: ${question}\n\nKnowledge base:\n${context}` },
        ],
      }),
      cache: "no-store",
    });

    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body: Body = await req.json().catch(() => ({}));
  const locale = body.locale || "es-AR";
  const question = String(body.question || "");
  const intent = detectIntent(question);
  const extracted = extractLeadData(question);

  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || "").trim();
  const whatsapp = String(body.whatsapp || "").trim();
  const contact = String(body.contact || [email, whatsapp].filter(Boolean).join(" | ")).trim();
  const hasContact = Boolean(email || whatsapp || contact);
  const hasQualifiedLeadData = fullName.length > 3 && hasContact;
  const requiresContact = !hasQualifiedLeadData && (intent === "pricing" || intent === "reseller" || intent === "order");

  const kbRows = await sql/*sql*/`
    SELECT locale, slug, title, body
    FROM knowledge_articles
    WHERE locale = ${locale}
    ORDER BY updated_at DESC
    LIMIT 12
  `.catch(() => [] as Array<Record<string, string>>);

  const selected = kbRows
    .filter((row) => {
      const text = `${row.title} ${row.body}`.toLowerCase();
      if (intent === "pricing") return text.includes("precio") || text.includes("pricing") || text.includes("roi");
      if (intent === "ops") return text.includes("batch") || text.includes("manifest") || text.includes("sun");
      if (intent === "reseller") return text.includes("reseller") || text.includes("white-label");
      return true;
    })
    .slice(0, 3);

  const openAiAnswer = await buildOpenAiAnswer({ locale, question, intent, kb: selected });
  const answer = openAiAnswer || buildFallbackAnswer(locale, intent, extracted);

  if (hasQualifiedLeadData && (intent === "pricing" || intent === "reseller" || intent === "general" || intent === "order")) {
    await sql/*sql*/`
      INSERT INTO leads (locale, contact, company, country, vertical, tag_type, volume, source, status, notes)
      VALUES (
        ${locale},
        ${contact},
        ${extracted.company || ""},
        ${extracted.country || ""},
        ${extracted.vertical || "other"},
        ${extracted.tagType || "unknown"},
        ${extracted.volume || 0},
        ${String(body.mode || "assistant")},
        ${`${fullName ? `name=${fullName}; ` : ""}${question}`.slice(0, 700)}
      )
    `.catch(() => null);
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
      VALUES (
        ${locale},
        ${contact},
        ${extracted.company || ""},
        ${extracted.tagType || "basic"},
        ${extracted.volume || 0},
        ${`${fullName ? `name=${fullName}; ` : ""}${question}`.slice(0, 700)},
        'new'
      )
    `.catch(() => null);
  }

  return json({
    answer,
    intent,
    requiresContact,
    extracted,
    citations: selected.map((item) => ({ title: item.title, slug: item.slug, locale: item.locale })),
    suggested:
      locale === "pt-BR"
        ? ["Como funciona o manifest?", "Qual plano para 50k unidades?", "Quero ser reseller"]
        : locale === "en"
          ? ["How does manifest import work?", "What plan fits 50k units?", "I want to become a reseller"]
          : ["¿Cómo funciona el manifest?", "¿Qué plan conviene para 50k unidades?", "Quiero ser reseller"],
  });
}
