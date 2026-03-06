export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

type Body = { locale?: string; role?: string; tenant?: string; question?: string; contact?: string; mode?: string };

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
    "Para cotizar, indicame volumen (10k/50k/100k), tipo de tag (basic/secure) y contacto (email o WhatsApp).",
    "Puedo crear un lead, ticket o pedido para que ventas te contacte hoy.",
  ],
  "pt-BR": [
    "nexID protege produtos com NFC (NTAG215 e NTAG424 DNA TagTamper) e validação SUN/SDM.",
    "Para cotação, informe volume (10k/50k/100k), tipo de tag (basic/secure) e contato (email ou WhatsApp).",
    "Posso criar lead, ticket ou pedido para o time comercial.",
  ],
  en: [
    "nexID secures products with NFC (NTAG215 and NTAG424 DNA TagTamper) and SUN/SDM validation.",
    "For a quote, share volume (10k/50k/100k), tag type (basic/secure), and your contact info.",
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

function buildAnswer(locale: string, intent: string, extracted: ExtractedLead) {
  const base = fallbackByLocale[locale] || fallbackByLocale["es-AR"];
  const extraByLocale = {
    "es-AR": {
      pricing: `¿Querés cotizar ${extracted.volume ? extracted.volume.toLocaleString() : "10.000"} o 50.000 unidades?` +
        ` ¿Preferís tags ${extracted.tagType === "secure" ? "seguros (NTAG 424 DNA TagTamper)" : "básicos (NTAG215)"} o secure anti-fraude?`,
      reseller: "Si querés canal reseller, dejame WhatsApp o email y te pasamos onboarding hoy.",
      ticket: "Ya registro un ticket de soporte y te contactamos dentro de 24h.",
    },
    "pt-BR": {
      pricing: `Quer cotar ${extracted.volume ? extracted.volume.toLocaleString() : "10.000"} ou 50.000 unidades?` +
        ` Você prefere tags ${extracted.tagType === "secure" ? "seguros (NTAG 424 DNA TagTamper)" : "básicos (NTAG215)"}?`,
      reseller: "Se você quer o canal reseller, deixe WhatsApp ou e-mail para onboarding ainda hoje.",
      ticket: "Vou registrar um ticket de suporte e nosso time responde em até 24h.",
    },
    en: {
      pricing: `Do you want a quote for ${extracted.volume ? extracted.volume.toLocaleString() : "10k"} or 50k units?` +
        ` Do you need ${extracted.tagType === "secure" ? "secure tags (NTAG 424 DNA TagTamper)" : "basic tags (NTAG215)"}?`,
      reseller: "If you want the reseller channel, leave WhatsApp or email and we’ll send onboarding today.",
      ticket: "I’ll log a support ticket and the team will follow up within 24h.",
    },
  } as const;

  const extra = extraByLocale[locale as keyof typeof extraByLocale] || extraByLocale["es-AR"];
  const intentLine = intent === "pricing" ? extra.pricing : intent === "reseller" ? extra.reseller : intent === "ticket" ? extra.ticket : "";
  return `${base[0]} ${base[1]} ${base[2]} ${intentLine}`.trim();
}

export async function POST(req: Request) {
  const body: Body = await req.json().catch(() => ({}));
  const locale = body.locale || "es-AR";
  const question = String(body.question || "");
  const intent = detectIntent(question);
  const extracted = extractLeadData(question);

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

  const answer = buildAnswer(locale, intent, extracted);
  const contact = String(body.contact || "").trim();

  if (contact && (intent === "pricing" || intent === "reseller" || intent === "general")) {
    await sql/*sql*/`
      INSERT INTO leads (locale, contact, company, country, vertical, tag_type, volume, source, status, notes)
      VALUES (${locale}, ${contact}, ${extracted.company || ""}, ${extracted.country || ""}, ${extracted.vertical || "other"}, ${extracted.tagType || "unknown"}, ${extracted.volume || 0}, ${String(body.mode || "assistant")}, 'new', ${question.slice(0, 500)})
    `.catch(() => null);
  }

  if (contact && intent === "ticket") {
    await sql/*sql*/`
      INSERT INTO tickets (locale, contact, title, detail, status)
      VALUES (${locale}, ${contact}, 'Assistant support request', ${question.slice(0, 500)}, 'open')
    `.catch(() => null);
  }

  if (contact && intent === "order") {
    await sql/*sql*/`
      INSERT INTO order_requests (locale, contact, company, tag_type, volume, notes, status)
      VALUES (${locale}, ${contact}, ${extracted.company || ""}, ${extracted.tagType || "basic"}, ${extracted.volume || 0}, ${question.slice(0, 500)}, 'new')
    `.catch(() => null);
  }

  return json({
    answer,
    intent,
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
