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
            "Basic line (NTAG215): volume hardware + setup + dashboard operations.",
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
          layersTitle: "How nexID pricing is built",
          layers: [
            "Layer 1 · Setup/Pilot: scope, onboarding, packaging adaptation, activation plan.",
            "Layer 2 · Hardware: tags/inlays/cards/seals by volume and security profile.",
            "Layer 3 · SaaS/Usage: verification events, analytics, alerts, ownership workflows.",
            "Layer 4 · Channel: reseller/white-label governance, margin sharing and support.",
          ],
          pilotTitle: "Suggested pilot pricing by vertical (USD)",
          pilotRows: [
            "Wine Secure · Min 2,000 bottles · Setup 4k–8k + 2.8–5.0 / bottle + 500–1,200 / month SaaS",
            "Events Basic · Min 1,500 attendees · Setup 1k–2.5k + 0.8–1.8 / attendee + 300–900 / event",
            "Events Secure · Min 200 credentials · Setup 2k–5k + 3.5–7.0 / credential + 500–1,200 / event",
            "Docs & Presence Secure · Min 500 units · Setup 2.5k–6k + 3.0–8.0 / unit + 300–1,000 / month SaaS",
          ],
          rulesTitle: "Hard pricing rules",
          rules: [
            "Secure always includes NRE/setup. Do not waive engineering work.",
            "Pilot terms should include semi-annual or annual SaaS prepayment.",
            "Sell avoided risk + enabled revenue + captured data, not raw chip cost.",
          ],
          procurementTitle: "Enterprise rollout guardrails",
          procurementBullets: [
            "Do not accept supplier production without approved batch_id, URL template, key ownership and manifest format.",
            "Treat pilot cost as proof budget; treat 10k/50k orders as governed programs with acceptance criteria.",
            "Price includes software control, QA and activation governance — not just encoded hardware.",
          ],
          rolloutChecklistTitle: "Checklist before approving rollout budget",
          rolloutChecklist: [
            "Approved batch_id convention and batch owner.",
            "Supplier confirmed URL template, key custody and manifest schema.",
            "Pilot KPI defined: activation, scan rate, fraud/tamper alerts and renewal path.",
            "Commercial owner and operations owner assigned before go-live.",
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
            "Linha Basic (NTAG215): hardware por volume + setup + operação no dashboard.",
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
          layersTitle: "Como o pricing da nexID é montado",
          layers: [
            "Camada 1 · Setup/Pilot: escopo, onboarding, adaptação de embalagem e plano de ativação.",
            "Camada 2 · Hardware: tags/inlays/cards/seals por volume e perfil de segurança.",
            "Camada 3 · SaaS/Usage: verificações, analytics, alertas e ownership workflows.",
            "Camada 4 · Canal: governança reseller/white-label, margem e suporte.",
          ],
          pilotTitle: "Pricing sugerido de piloto por vertical (USD)",
          pilotRows: [
            "Wine Secure · Mín 2.000 garrafas · Setup 4k–8k + 2.8–5.0 / garrafa + 500–1.200 / mês SaaS",
            "Events Basic · Mín 1.500 participantes · Setup 1k–2.5k + 0.8–1.8 / participante + 300–900 / evento",
            "Events Secure · Mín 200 credenciais · Setup 2k–5k + 3.5–7.0 / credencial + 500–1.200 / evento",
            "Docs & Presence Secure · Mín 500 unidades · Setup 2.5k–6k + 3.0–8.0 / unidade + 300–1.000 / mês SaaS",
          ],
          rulesTitle: "Regras duras de pricing",
          rules: [
            "Secure sempre inclui NRE/setup. Não remover engenharia.",
            "Piloto com pré-pagamento SaaS semestral ou anual.",
            "Venda risco evitado + receita habilitada + dados capturados, não custo de chip.",
          ],
          procurementTitle: "Guardrails para rollout enterprise",
          procurementBullets: [
            "Não aceitar produção do fornecedor sem batch_id, URL template, ownership das keys e formato de manifest aprovados.",
            "Tratar custo de piloto como budget de prova; tratar pedidos de 10k/50k como programas governados com critérios de aceite.",
            "O preço inclui controle de software, QA e governança de ativação — não só hardware codificado.",
          ],
          rolloutChecklistTitle: "Checklist antes de aprovar orçamento de rollout",
          rolloutChecklist: [
            "Convenção de batch_id e owner do lote aprovados.",
            "Fornecedor confirmou URL template, custódia das keys e schema do manifest.",
            "KPIs do piloto definidos: ativação, scan rate, alertas de fraude/tamper e caminho de renewal.",
            "Owner comercial e owner operacional definidos antes do go-live.",
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
            "Línea Basic (NTAG215): hardware por volumen + setup + operación de dashboard.",
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
          layersTitle: "Cómo se construye el pricing en nexID",
          layers: [
            "Capa 1 · Setup/Pilot: alcance, onboarding, adaptación de packaging y plan de activación.",
            "Capa 2 · Hardware: tags/inlays/cards/seals por volumen y perfil de seguridad.",
            "Capa 3 · SaaS/Usage: verificaciones, analítica, alertas y ownership workflows.",
            "Capa 4 · Canal: gobernanza reseller/white-label, margen compartido y soporte.",
          ],
          pilotTitle: "Pricing piloto sugerido por vertical (USD)",
          pilotRows: [
            "Wine Secure · Mín 2.000 botellas · Setup 4k–8k + 2.8–5.0 / botella + 500–1.200 / mes SaaS",
            "Events Basic · Mín 1.500 asistentes · Setup 1k–2.5k + 0.8–1.8 / asistente + 300–900 / evento",
            "Events Secure · Mín 200 credenciales · Setup 2k–5k + 3.5–7.0 / credencial + 500–1.200 / evento",
            "Docs & Presence Secure · Mín 500 unidades · Setup 2.5k–6k + 3.0–8.0 / unidad + 300–1.000 / mes SaaS",
          ],
          rulesTitle: "Reglas duras de pricing",
          rules: [
            "Secure siempre lleva NRE/setup. No regalar ingeniería.",
            "Piloto con prepago semestral o anual de SaaS.",
            "Vendé riesgo evitado + revenue habilitado + datos capturados, no chip suelto.",
          ],
          procurementTitle: "Guardrails para rollout enterprise",
          procurementBullets: [
            "No aceptar producción del proveedor sin batch_id, URL template, ownership de keys y formato de manifest aprobados.",
            "Tomar el costo piloto como presupuesto de prueba; tratar pedidos de 10k/50k como programas gobernados con criterios de aceptación.",
            "El precio incluye control de software, QA y gobernanza de activación — no solo hardware codificado.",
          ],
          rolloutChecklistTitle: "Checklist antes de aprobar presupuesto de rollout",
          rolloutChecklist: [
            "Convención de batch_id y owner del lote aprobados.",
            "Proveedor confirmó URL template, custodia de keys y schema del manifest.",
            "KPIs del piloto definidos: activación, scan rate, alertas de fraude/tamper y camino de renewal.",
            "Owner comercial y owner operativo definidos antes del go-live.",
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
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{labels.layersTitle}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {labels.layers.map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">• {item}</div>
          ))}
        </div>
      </Card>

      <Card className="mt-8 p-6 pricing-page-card">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{labels.procurementTitle}</h3>
        <div className="mt-4 grid gap-3">
          {labels.procurementBullets.map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">• {item}</div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{labels.rolloutChecklistTitle}</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {labels.rolloutChecklist.map((item, index) => (
              <div key={item} className="rounded-xl border border-cyan-300/20 bg-slate-950/50 px-3 py-3 text-sm text-cyan-50">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/30 text-xs text-cyan-200">{index + 1}</span>{item}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-8 p-6 pricing-page-card">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{labels.pilotTitle}</h3>
        <div className="mt-4 grid gap-3">
          {labels.pilotRows.map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">• {item}</div>
          ))}
        </div>
        <h4 className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">{labels.rulesTitle}</h4>
        <div className="mt-3 grid gap-3">
          {labels.rules.map((item) => (
            <div key={item} className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-3 text-sm text-cyan-100">• {item}</div>
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
