import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { Badge, Button, Card, SectionHeading } from "@product/ui";
import { landingContent } from "../../lib/landing-content";
import { getWebI18n } from "../../lib/locale";
import { CalculatorSection } from "../../components/calculator-section";

function Info({ text }: { text: string }) {
  return <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-300/40 text-xs text-cyan-200" title={text}>i</span>;
}

export default async function PricingPage() {
  const { locale } = await getWebI18n();
  const content = landingContent[locale];

  const labels =
    locale === "en"
      ? {
          includeTitle: "What is included in every quote",
          includes: ["Encoded chips by vertical and tag profile", "Authentication API + dashboard operations", "Onboarding, setup and integration scope", "Fraud/tamper rules + monitoring + support"],
          requestQuote: "Request quote",
          talkSales: "Talk to sales",
          reseller: "Become reseller",
          cardInfo: "Quote is tailored by vertical, volume, SLA, setup, dashboard and API depth.",
          roiCta: "Request pilot budget",
          modelTitle: "Business model clarity",
          modelCards: [
            "Basic line (NTAG213/215): volume hardware + setup + dashboard operations.",
            "Secure line (NTAG 424 DNA TT): encoded hardware + anti-fraud authentication + SaaS.",
            "Enterprise: integration, SLA, API, governance and advanced analytics.",
            "Reseller: white-label go-to-market with recurring margin and managed rollout.",
          ],
          chooseTitle: "When to choose each line",
          chooseBullets: [
            "Choose Basic when margin/risk per unit is low and speed/volume is priority.",
            "Choose Secure when authenticity, anti-clone, legal evidence or channel control are required.",
            "Use hybrid strategy in events: Basic for attendees, Secure for VIP/staff critical access.",
          ],
        }
      : locale === "pt-BR"
      ? {
          includeTitle: "O que inclui cada proposta",
          includes: ["Chips codificados por vertical e perfil de tag", "API de autenticação + operação no dashboard", "Onboarding, setup e escopo de integração", "Regras anti-fraude/tamper + monitoramento + suporte"],
          requestQuote: "Solicitar orçamento",
          talkSales: "Falar com vendas",
          reseller: "Quero ser reseller",
          cardInfo: "A proposta varia por vertical, volume, SLA, setup, dashboard e profundidade de API.",
          roiCta: "Solicitar orçamento de piloto",
          modelTitle: "Clareza do modelo de negócio",
          modelCards: [
            "Linha Basic (NTAG213/215): hardware por volume + setup + operação no dashboard.",
            "Linha Secure (NTAG 424 DNA TT): hardware codificado + autenticação antifraude + SaaS.",
            "Enterprise: integração, SLA, API, governança e analytics avançado.",
            "Revenda: go-to-market white-label com margem recorrente e rollout assistido.",
          ],
          chooseTitle: "Quando escolher cada linha",
          chooseBullets: [
            "Escolha Basic quando margem/risco por unidade é baixo e velocidade/volume é prioridade.",
            "Escolha Secure quando autenticidade, anti-clone, evidência legal ou controle de canal são críticos.",
            "Estratégia híbrida em eventos: Basic para público geral e Secure para VIP/staff crítico.",
          ],
        }
      : {
          includeTitle: "Qué incluye cada propuesta",
          includes: ["Chips codificados por vertical y perfil de tag", "API de autenticación + operación de dashboard", "Onboarding, setup y alcance de integración", "Reglas anti-fraude/tamper + monitoreo + soporte"],
          requestQuote: "Solicitar presupuesto",
          talkSales: "Hablar con ventas",
          reseller: "Quiero ser reseller",
          cardInfo: "La propuesta se ajusta por vertical, volumen, SLA, setup, dashboard y profundidad de API.",
          roiCta: "Solicitar presupuesto piloto",
          modelTitle: "Claridad del modelo de negocio",
          modelCards: [
            "Línea Basic (NTAG213/215): hardware por volumen + setup + operación de dashboard.",
            "Línea Secure (NTAG 424 DNA TT): hardware codificado + autenticación antifraude + SaaS.",
            "Enterprise: integración, SLA, API, gobernanza y analítica avanzada.",
            "Reseller: go-to-market white-label con margen recurrente y rollout asistido.",
          ],
          chooseTitle: "Cuándo elegir cada línea",
          chooseBullets: [
            "Elegí Basic cuando el margen/riesgo por unidad es bajo y la prioridad es velocidad/volumen.",
            "Elegí Secure cuando necesitás autenticidad, anti-clone, evidencia legal o control de canal.",
            "Estrategia híbrida en eventos: Basic para asistentes y Secure para VIP/staff crítico.",
          ],
        };

  return (
    <main className="container-shell py-16 pricing-page">
      <BackLink />
      <SectionHeading eyebrow={content.plans.eyebrow} title={content.plans.title} description={content.plans.description} />

      <Card className="mt-6 p-5 pricing-page-card">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{labels.includeTitle}</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {labels.includes.map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">• {item}</div>
          ))}
        </div>
      </Card>

      <div className="mt-10 grid gap-6 xl:grid-cols-3">
        {content.plans.cards.map((plan) => (
          <Card key={plan.name} className="p-6 pricing-page-card">
            <Badge tone={plan.name.includes("ENTERPRISE") ? "amber" : "cyan"}>{plan.badge}</Badge>
            <h3 className="mt-4 text-2xl font-semibold text-white">{plan.name}<Info text={labels.cardInfo} /></h3>
            <p className="mt-3 text-sm text-slate-400">{plan.body}</p>
            <p className="mt-4 text-cyan-300">{plan.price}</p>
            <ul className="mt-4 space-y-1 text-sm text-slate-300">{plan.bullets.map((b) => <li key={b}>• {b}</li>)}</ul>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Link href="/?contact=quote#contact-modal"><Button>{labels.requestQuote}</Button></Link>
              <Link href={plan.name.includes("RESELLER") ? "/?contact=reseller#contact-modal" : "/?contact=sales#contact-modal"}><Button variant="secondary">{plan.name.includes("RESELLER") ? labels.reseller : labels.talkSales}</Button></Link>
            </div>
          </Card>
        ))}
      </div>

      <CalculatorSection calculator={content.calculator} locale={locale} />


      <Card className="mt-8 p-6 pricing-page-card">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{labels.modelTitle}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {labels.modelCards.map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">• {item}</div>
          ))}
        </div>
      </Card>

      <Card className="mt-8 p-6 pricing-page-card">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{labels.chooseTitle}</h3>
        <div className="mt-4 grid gap-3">
          {labels.chooseBullets.map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">• {item}</div>
          ))}
        </div>
      </Card>

      <Card className="mt-8 p-6 pricing-page-card">
        <SectionHeading eyebrow={content.roi.eyebrow} title={content.roi.title} description={content.roi.description} />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {content.roi.metrics.map((m) => (
            <div key={m.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">{m.label}<Info text="Indicative business impact by vertical and adoption maturity." /></p>
              <p className="mt-2 text-2xl font-bold text-white">{m.value}</p>
              <p className="mt-1 text-sm text-slate-400">{m.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-6"><Link href="/?contact=quote#contact-modal"><Button>{labels.roiCta}</Button></Link></div>
      </Card>
    </main>
  );
}
