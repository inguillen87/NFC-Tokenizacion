import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { Card, SectionHeading } from "@product/ui";
import { landingContent } from "../../lib/landing-content";
import { getWebI18n } from "../../lib/locale";
import { ArrowRight, BadgeDollarSign, Briefcase, ClipboardCheck, Globe2, Layers3, ShieldCheck, Sparkles } from "lucide-react";

const labels = {
  "es-AR": {
    assistant: "Abrir BotIA",
    schedule: "Agendar demo",
    sales: "Hablar con agente",
    whats: "WhatsApp directo",
    jumpTitle: "Explorar programa reseller",
    whyTitle: "Por qué el canal reseller tiene sentido",
    whyBullets: [
      "Permite entrar más rápido a verticales donde el partner ya tiene distribución, diseño o fabricación.",
      "Combina margen inmediato en setup/hardware con revenue recurrente en software y operación.",
      "Hace escalable el go-to-market sin obligarnos a vender todo directo desde el día uno.",
    ],
    modelTitle: "Cómo gana un reseller",
    modelCards: [
      "1. Discovery + setup cobrable por cuenta o vertical.",
      "2. Margen en tags/inlays/cards/seals ya codificados.",
      "3. SaaS/usage recurrente por verificaciones, ownership y analytics.",
      "4. Servicios de rollout, QA, training y soporte de canal.",
    ],
    flowTitle: "Flujo recomendado para onboarding",
    flow: [
      "Alinear vertical objetivo y buyer principal.",
      "Elegir 1 pack wedge: Wine Secure, Events, Docs o Cosmetics.",
      "Definir handoff operativo: batch_id, URL template, keys y manifest format.",
      "Correr piloto con narrativa comercial + dashboard + demo móvil.",
    ],
    ctaRibbon: "Canal listo para go-to-market, demos y rollout real.",
  },
  "pt-BR": {
    assistant: "Abrir BotIA",
    schedule: "Agendar demo",
    sales: "Falar com agente",
    whats: "WhatsApp direto",
    jumpTitle: "Explorar programa reseller",
    whyTitle: "Por que o canal reseller faz sentido",
    whyBullets: [
      "Acelera entrada em verticais onde o parceiro já tem distribuição, design ou manufatura.",
      "Combina margem imediata em setup/hardware com receita recorrente em software e operação.",
      "Escala o go-to-market sem depender só de venda direta desde o início.",
    ],
    modelTitle: "Como um reseller ganha dinheiro",
    modelCards: [
      "1. Discovery + setup cobrável por conta ou vertical.",
      "2. Margem em tags/inlays/cards/seals já codificados.",
      "3. SaaS/usage recorrente por verificações, ownership e analytics.",
      "4. Serviços de rollout, QA, training e suporte de canal.",
    ],
    flowTitle: "Fluxo recomendado para onboarding",
    flow: [
      "Alinhar vertical alvo e buyer principal.",
      "Escolher 1 pack wedge: Wine Secure, Events, Docs ou Cosmetics.",
      "Definir handoff operacional: batch_id, URL template, keys e manifest format.",
      "Rodar piloto com narrativa comercial + dashboard + demo móvel.",
    ],
    ctaRibbon: "Canal pronto para go-to-market, demos e rollout real.",
  },
  en: {
    assistant: "Open AI assistant",
    schedule: "Book demo",
    sales: "Talk to agent",
    whats: "Direct WhatsApp",
    jumpTitle: "Explore reseller program",
    whyTitle: "Why the reseller channel matters",
    whyBullets: [
      "It accelerates entry into verticals where partners already own distribution, design or manufacturing access.",
      "It combines immediate setup/hardware margin with recurring software and operations revenue.",
      "It scales go-to-market without forcing everything through direct sales from day one.",
    ],
    modelTitle: "How a reseller makes money",
    modelCards: [
      "1. Billable discovery + setup per account or vertical.",
      "2. Margin on encoded tags/inlays/cards/seals.",
      "3. Recurring SaaS/usage for verification, ownership and analytics.",
      "4. Rollout, QA, training and channel support services.",
    ],
    flowTitle: "Recommended onboarding flow",
    flow: [
      "Align target vertical and primary buyer.",
      "Choose one wedge pack: Wine Secure, Events, Docs or Cosmetics.",
      "Define operating handoff: batch_id, URL template, keys and manifest format.",
      "Run a pilot with commercial narrative + dashboard + mobile demo.",
    ],
    ctaRibbon: "Channel ready for go-to-market, demos and real rollout execution.",
  },
} as const;

const cardIcons = [Globe2, Layers3, ShieldCheck, BadgeDollarSign] as const;

export default async function ResellersPage() {
  const { locale } = await getWebI18n();
  const content = landingContent[locale];
  const t = labels[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <SectionHeading eyebrow={content.reseller.eyebrow} title={content.reseller.title} description={content.reseller.description} />

      <div className="space-y-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          <Sparkles className="h-4 w-4 text-cyan-300" />
          {t.jumpTitle}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="#program" className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition-transform duration-200 hover:-translate-y-0.5"><Briefcase className="h-3.5 w-3.5" />Program</a>
          <a href="#economics" className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 transition-transform duration-200 hover:-translate-y-0.5"><BadgeDollarSign className="h-3.5 w-3.5" />Economics</a>
          <a href="#onboarding" className="inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100 transition-transform duration-200 hover:-translate-y-0.5"><ClipboardCheck className="h-3.5 w-3.5" />Onboarding</a>
        </div>
      </div>

      <div id="program" className="grid gap-6 md:grid-cols-2">
        {content.reseller.cards.map((item, index) => {
          const Icon = cardIcons[index] || Briefcase;
          return (
            <Card key={item.title} className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
                <Icon className="h-4 w-4" />
                {item.title}
              </p>
              <p className="mt-3 text-sm text-slate-300">{item.body}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{t.whyTitle}</h3>
          <div className="mt-4 grid gap-3">
            {t.whyBullets.map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </Card>

        <Card id="economics" className="p-6">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <BadgeDollarSign className="h-5 w-5 text-emerald-300" />
            {t.modelTitle}
          </h3>
          <div className="mt-4 grid gap-3">
            {t.modelCards.map((item) => (
              <div key={item} className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card id="onboarding" className="p-6">
        <SectionHeading eyebrow={content.credibility.eyebrow} title={content.credibility.title} description={content.credibility.description} />
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {content.credibility.items.map((item) => <li key={item}>• {item}</li>)}
        </ul>

        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{t.flowTitle}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {t.flow.map((item, index) => (
              <div key={item} className="rounded-xl border border-cyan-300/20 bg-slate-950/50 px-4 py-3 text-sm text-cyan-50">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/30 text-xs text-cyan-200">{index + 1}</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          {t.ctaRibbon}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/?assistant=open" className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100 transition-transform duration-200 hover:-translate-y-0.5">{t.assistant}<ArrowRight className="h-4 w-4" /></Link>
          <Link href="/?contact=demo#contact-modal" className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 transition-transform duration-200 hover:-translate-y-0.5">{t.schedule}<ArrowRight className="h-4 w-4" /></Link>
          <Link href="/?contact=sales#contact-modal" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-100 transition-transform duration-200 hover:-translate-y-0.5">{t.sales}</Link>
          <a href="https://wa.me/5492613168608?text=Hola%20quiero%20programa%20reseller%20nexID" target="_blank" rel="noreferrer" className="rounded-lg border border-violet-300/35 bg-violet-500/15 px-4 py-2 text-sm text-violet-100 transition-transform duration-200 hover:-translate-y-0.5">{t.whats}</a>
        </div>
      </Card>
    </main>
  );
}
