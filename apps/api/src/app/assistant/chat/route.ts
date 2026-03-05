export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

type Body = { locale?: string; role?: string; tenant?: string; question?: string; contact?: string; mode?: string };

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
  return "general";
}

export async function POST(req: Request) {
  const body: Body = await req.json().catch(() => ({}));
  const locale = body.locale || "es-AR";
  const question = String(body.question || "");
  const intent = detectIntent(question);

  const kbRows = await sql/*sql*/`
    SELECT locale, slug, title, body
    FROM knowledge_articles
    WHERE locale = ${locale}
    ORDER BY updated_at DESC
    LIMIT 12
  `.catch(() => [] as Array<Record<string, string>>);

  const selected = kbRows.filter((row) => {
    const text = `${row.title} ${row.body}`.toLowerCase();
    if (intent === "pricing") return text.includes("precio") || text.includes("pricing") || text.includes("roi");
    if (intent === "ops") return text.includes("batch") || text.includes("manifest") || text.includes("sun");
    if (intent === "reseller") return text.includes("reseller") || text.includes("white-label");
    return true;
  }).slice(0, 2);

  const base = fallbackByLocale[locale] || fallbackByLocale["es-AR"];
  const answer = `${base[0]} ${base[1]} ${base[2]}`;
  const contact = String(body.contact || "");
  if (contact && (intent === "pricing" || intent === "reseller")) {
    await sql/*sql*/`
      INSERT INTO leads (locale, contact, source, status, notes)
      VALUES (${locale}, ${contact}, ${String(body.mode || "assistant")}, 'new', ${question.slice(0, 400)})
    `.catch(() => null);
  }


  return json({
    answer,
    intent,
    citations: selected.map((item) => ({ title: item.title, slug: item.slug, locale: item.locale })),
    suggested: locale === "pt-BR"
      ? ["Como funciona o manifest?", "Qual plano para 50k unidades?", "Quero ser reseller"]
      : locale === "en"
      ? ["How does manifest import work?", "What plan fits 50k units?", "I want to become a reseller"]
      : ["¿Cómo funciona el manifest?", "¿Qué plan conviene para 50k unidades?", "Quiero ser reseller"],
  });
}
