import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { Card, SectionHeading } from "@product/ui";
import { landingContent } from "../../lib/landing-content";
import { getWebI18n } from "../../lib/locale";

const labels = {
  "es-AR": {
    assistant: "Abrir BotIA",
    schedule: "Agendar demo",
    sales: "Hablar con agente",
    whats: "WhatsApp directo",
  },
  "pt-BR": {
    assistant: "Abrir BotIA",
    schedule: "Agendar demo",
    sales: "Falar com agente",
    whats: "WhatsApp direto",
  },
  en: {
    assistant: "Open AI assistant",
    schedule: "Book demo",
    sales: "Talk to agent",
    whats: "Direct WhatsApp",
  },
} as const;

export default async function ResellersPage() {
  const { locale } = await getWebI18n();
  const content = landingContent[locale];
  const t = labels[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <SectionHeading eyebrow={content.reseller.eyebrow} title={content.reseller.title} description={content.reseller.description} />

      <div className="grid gap-6 md:grid-cols-2">
        {content.reseller.cards.map((item) => (
          <Card key={item.title} className="p-6">
            <h3 className="text-lg font-semibold text-white">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{item.body}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <SectionHeading eyebrow={content.credibility.eyebrow} title={content.credibility.title} description={content.credibility.description} />
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {content.credibility.items.map((item) => <li key={item}>• {item}</li>)}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/?assistant=open" className="rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100">{t.assistant}</Link>
          <Link href="/?contact=demo#contact-modal" className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100">{t.schedule}</Link>
          <Link href="/?contact=sales#contact-modal" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-100">{t.sales}</Link>
          <a href="https://wa.me/5492613168608?text=Hola%20quiero%20programa%20reseller%20nexID" target="_blank" rel="noreferrer" className="rounded-lg border border-violet-300/35 bg-violet-500/15 px-4 py-2 text-sm text-violet-100">{t.whats}</a>
        </div>
      </Card>
    </main>
  );
}
