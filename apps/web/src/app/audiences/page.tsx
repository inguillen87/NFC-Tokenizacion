import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { BackLink } from "../../components/back-link";
import { getWebI18n } from "../../lib/locale";
import { ArrowRight, Briefcase, Building2, Landmark, Rocket, ShieldCheck, UserRound } from "lucide-react";

type AudienceCard = {
  audience: string;
  icon: "brands" | "reseller" | "government" | "customer";
  hook: string;
  sell: string[];
  avoid: string;
  cta: string;
};

type AudienceCopy = {
  eyebrow: string;
  title: string;
  description: string;
  jumpTitle: string;
  cards: AudienceCard[];
  investorTitle: string;
  investorBullets: string[];
  investorNote: string;
  buyerFlowTitle: string;
  buyerFlow: string[];
  intentTitle: string;
  intentCards: Array<{ title: string; body: string; href: string; kind: "internal" | "product" | "lead" }>;
  assistantCta: string;
  demoCta: string;
};

const iconByAudience = {
  brands: Building2,
  reseller: Briefcase,
  government: Landmark,
  customer: UserRound,
} as const;

const copyByLocale: Record<"es-AR" | "pt-BR" | "en", AudienceCopy> = {
  "es-AR": {
    eyebrow: "Pitch por audiencia",
    title: "Mismo núcleo, discurso distinto para cada comprador",
    description: "nexID vende una plataforma modular. Cambia el orden del mensaje según quien decide la compra.",
    jumpTitle: "Explorar por tipo de comprador",
    cards: [
      {
        audience: "Empresas / marcas",
        icon: "brands",
        hook: "Entrá por revenue protegido, postventa y control de canal.",
        sell: ["Antifraude y control de canal.", "Passport por unidad para postventa y CRM.", "Ownership, garantía y activaciones premium."],
        avoid: "Evitar arrancar con jerga cripto o tokenización financiera.",
        cta: "Abrir docs de producto",
      },
      {
        audience: "Reseller / integrador",
        icon: "reseller",
        hook: "Entrá por margen recurrente, setup cobrable y vertical playbooks.",
        sell: ["Modelo white-label y multi-tenant.", "Márgenes en setup + hardware + SaaS recurrente.", "Playbooks por vertical (vino, eventos, cosmética, docs)."],
        avoid: "Evitar propuesta sin soporte operativo/comercial.",
        cta: "Ver programa reseller",
      },
      {
        audience: "Gobierno / sector público",
        icon: "government",
        hook: "Entrá por auditabilidad, cadena de custodia y evidencia verificable.",
        sell: ["Documentos verificables y cadena de custodia.", "Control de contratistas, accesos y presencia física.", "Registro auditable y arquitectura DPP-ready."],
        avoid: "Evitar venderlo como 'cripto first'.",
        cta: "Ver stack verificable",
      },
      {
        audience: "Cliente final",
        icon: "customer",
        hook: "Entrá por experiencia simple: tocar, validar, recibir beneficio.",
        sell: ["Verificación simple: válido, alertado o bloqueado.", "Beneficios concretos: garantía, perks, redención.", "Confianza sin fricción: tap y listo."],
        avoid: "Evitar UX compleja con pasos innecesarios.",
        cta: "Abrir demo",
      },
    ],
    investorTitle: "Narrativa para inversores (orden recomendado)",
    investorBullets: [
      "Fase 1: Verify (autenticidad + tamper) como wedge comercial.",
      "Fase 2: Passport (trazabilidad + data + cumplimiento).",
      "Fase 3: Rights (ownership, garantías, vouchers, transferencias).",
      "Fase 4: Registry/Market como expansión selectiva.",
    ],
    investorNote: "Clave: no vender la visión más larga antes de demostrar que Verify + Passport ya monetizan hoy.",
    buyerFlowTitle: "Secuencia sugerida para una llamada comercial",
    buyerFlow: [
      "1. Arrancá por el problema de negocio que más duele a ese buyer.",
      "2. Mostrá el carrier (NFC/QR) como medio, no como producto principal.",
      "3. Cerrá con operación real: batches, rollout, analytics y revenue model.",
    ],
    intentTitle: "Elegí la conversación que querés tener",
    intentCards: [
      { title: "Evaluar para empresa", body: "Ir directo a una conversación comercial sobre rollout, operación y perfiles de chip.", href: "/?contact=sales&intent=company_rollout#contact-modal", kind: "lead" },
      { title: "Explorar demo", body: "Pedir una demo guiada del flujo real y la experiencia de validación.", href: "/?contact=demo&intent=demo_lab&vertical=events#contact-modal", kind: "lead" },
      { title: "Mirar investor snapshot", body: "Entrar por narrativa de plataforma, moat y expansión.", href: "/?contact=quote&intent=investor_snapshot#contact-modal", kind: "lead" },
    ],
    assistantCta: "Abrir BotIA comercial",
    demoCta: "Agendar demo",
  },
  "pt-BR": {
    eyebrow: "Pitch por audiência",
    title: "Mesmo núcleo, mensagem diferente para cada comprador",
    description: "nexID é uma plataforma modular. O produto é o mesmo; o discurso muda por perfil de compra.",
    jumpTitle: "Explorar por tipo de comprador",
    cards: [
      { audience: "Empresas / marcas", icon: "brands", hook: "Comece por receita protegida, pós-venda e controle de canal.", sell: ["Antifraude e controle de canal.", "Passport por unidade para pós-venda.", "Ownership, garantia e ativações."], avoid: "Evitar começar com jargão cripto.", cta: "Abrir docs de produto" },
      { audience: "Revendedor / integrador", icon: "reseller", hook: "Comece por margem recorrente, setup cobrável e playbooks verticais.", sell: ["White-label multi-tenant.", "Margem em setup + hardware + SaaS.", "Playbooks por vertical."], avoid: "Evitar oferta sem suporte de operação.", cta: "Ver programa reseller" },
      { audience: "Governo", icon: "government", hook: "Comece por auditabilidade, cadeia de custódia e evidência verificável.", sell: ["Documentos verificáveis.", "Presença física e cadeia de custódia.", "Registro auditável DPP-ready."], avoid: "Evitar narrativa 'cripto first'.", cta: "Ver stack verificável" },
      { audience: "Cliente final", icon: "customer", hook: "Comece por experiência simples: tocar, validar e receber benefício.", sell: ["Verificação simples por status.", "Benefícios claros (garantia e perks).", "Tap sem fricção."], avoid: "Evitar UX longa e confusa.", cta: "Abrir demo" },
    ],
    investorTitle: "Narrativa para investidores",
    investorBullets: ["Fase 1: Verify.", "Fase 2: Passport.", "Fase 3: Rights.", "Fase 4: Registry/Market seletivo."],
    investorNote: "Ponto-chave: não vender a visão longa antes de provar que Verify + Passport já monetizam hoje.",
    buyerFlowTitle: "Sequência sugerida para uma call comercial",
    buyerFlow: [
      "1. Comece pelo problema de negócio mais urgente daquele buyer.",
      "2. Mostre o carrier (NFC/QR) como meio, não como produto principal.",
      "3. Feche com operação real: batches, rollout, analytics e revenue model.",
    ],
    intentTitle: "Escolha a conversa que você quer ter",
    intentCards: [
      { title: "Avaliar para empresa", body: "Ir direto para uma conversa comercial sobre rollout, operação e perfis de chip.", href: "/?contact=sales&intent=company_rollout#contact-modal", kind: "lead" },
      { title: "Explorar demo", body: "Pedir uma demo guiada do fluxo real e da experiência de validação.", href: "/?contact=demo&intent=demo_lab&vertical=events#contact-modal", kind: "lead" },
      { title: "Ver investor snapshot", body: "Entrar por narrativa de plataforma, moat e expansão.", href: "/?contact=quote&intent=investor_snapshot#contact-modal", kind: "lead" },
    ],
    assistantCta: "Abrir BotIA comercial",
    demoCta: "Agendar demo",
  },
  en: {
    eyebrow: "Audience-based pitch",
    title: "One core platform, different message by buyer",
    description: "nexID is modular. The stack is the same, but the commercial entry point changes by audience.",
    jumpTitle: "Explore by buyer type",
    cards: [
      { audience: "Brands / enterprises", icon: "brands", hook: "Lead with protected revenue, after-sales and channel control.", sell: ["Anti-fraud and channel protection.", "Unit passport for after-sales and CRM.", "Ownership, warranty and premium activation."], avoid: "Avoid opening with crypto-financial language.", cta: "Open product docs" },
      { audience: "Reseller / integrator", icon: "reseller", hook: "Lead with recurring margin, billable setup and vertical playbooks.", sell: ["White-label multi-tenant operations.", "Margin mix: setup + hardware + recurring SaaS.", "Vertical playbooks for faster go-to-market."], avoid: "Avoid unsupported partner model.", cta: "View reseller program" },
      { audience: "Government", icon: "government", hook: "Lead with auditability, chain of custody and verifiable evidence.", sell: ["Verifiable documents and chain of custody.", "Contractor/access/proof-of-presence controls.", "Auditable registry and DPP-ready architecture."], avoid: "Avoid crypto-first positioning.", cta: "View verifiable stack" },
      { audience: "End customer", icon: "customer", hook: "Lead with simple UX: tap, validate, unlock value.", sell: ["Simple trust statuses.", "Real benefits: warranty, perks, redemption.", "Low-friction tap experience."], avoid: "Avoid complex multi-step UX.", cta: "Open demo" },
    ],
    investorTitle: "Investor narrative (recommended order)",
    investorBullets: ["Phase 1: Verify.", "Phase 2: Passport.", "Phase 3: Rights.", "Phase 4: Selective Registry/Market expansion."],
    investorNote: "Key point: do not sell the long vision before proving that Verify + Passport already monetize today.",
    buyerFlowTitle: "Suggested sequence for a sales call",
    buyerFlow: [
      "1. Start from the business pain most urgent to that buyer.",
      "2. Position NFC/QR as the carrier, not the primary product.",
      "3. Close with real operations: batches, rollout, analytics and revenue model.",
    ],
    intentTitle: "Choose the conversation you want to have",
    intentCards: [
      { title: "Evaluate for a company", body: "Jump straight into a commercial conversation about rollout, operations and chip profiles.", href: "/?contact=sales&intent=company_rollout#contact-modal", kind: "lead" },
      { title: "Explore the demo", body: "Request a guided demo of the live validation experience.", href: "/?contact=demo&intent=demo_lab&vertical=events#contact-modal", kind: "lead" },
      { title: "Open investor snapshot", body: "Lead with platform story, moat and expansion potential.", href: "/?contact=quote&intent=investor_snapshot#contact-modal", kind: "lead" },
    ],
    assistantCta: "Open sales assistant",
    demoCta: "Book demo",
  },
};

function resolveHref(audience: AudienceCard["icon"]) {
  if (audience === "brands") return "/?contact=sales&intent=brands&vertical=wine&volume=50000#contact-modal";
  if (audience === "reseller") return "/?contact=reseller&intent=reseller_program&vertical=events&volume=25000#contact-modal";
  if (audience === "government") return "/?contact=sales&intent=government_stack&vertical=pharma&volume=10000#contact-modal";
  return "/?contact=demo&intent=customer_demo&vertical=cosmetics&volume=10000#contact-modal";
}

export default async function AudiencesPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink href="/docs" />
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white">{copy.intentTitle}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {copy.intentCards.map((card) => {
            const content = (
              <>
                <p className="text-sm font-semibold text-white">{card.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{card.body}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-200">Explorar<ArrowRight className="h-4 w-4" /></span>
              </>
            );

            return (
              <Link key={card.title} href={card.href} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/25 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
                {content}
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.jumpTitle}</p>
        <div className="flex flex-wrap gap-2">
          {copy.cards.map((card) => {
            const Icon = iconByAudience[card.icon];
            return (
              <a key={card.audience} href={`#${card.icon}`} className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition-transform duration-200 hover:-translate-y-0.5">
                <Icon className="h-3.5 w-3.5" />
                {card.audience}
              </a>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {copy.cards.map((card) => {
          const Icon = iconByAudience[card.icon];
          return (
            <div key={card.audience} id={card.icon} className="scroll-mt-28">
              <Card className="h-full p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
                      <Icon className="h-5 w-5 text-cyan-300" />
                      {card.audience}
                    </h3>
                    <p className="mt-2 text-sm text-cyan-100">{card.hook}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-300">
                    buyer lens
                  </span>
                </div>

                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  {card.sell.map((item) => <li key={item}>• {item}</li>)}
                </ul>

                <p className="mt-4 rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">⚠ {card.avoid}</p>

                <Link
                  href={resolveHref(card.icon)}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  {card.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <Rocket className="h-5 w-5 text-emerald-300" />
            {copy.investorTitle}
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-emerald-200">
            {copy.investorBullets.map((item) => <li key={item}>• {item}</li>)}
          </ul>
          <p className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{copy.investorNote}</p>
        </Card>

        <Card className="p-6">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            {copy.buyerFlowTitle}
          </h3>
          <div className="mt-4 grid gap-3">
            {copy.buyerFlow.map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/?assistant=open" className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100 transition-transform duration-200 hover:-translate-y-0.5">
              {copy.assistantCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/?contact=demo&intent=demo_lab&vertical=events#contact-modal" className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 transition-transform duration-200 hover:-translate-y-0.5">
              {copy.demoCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
