import { Badge, BrandDot, Button, Card, SectionHeading, WorldMapPlaceholder } from "@product/ui";
import Link from "next/link";
import { HeroScene } from "./hero-scene";

import type { AppLocale } from "@product/config";
import type { LandingContent } from "../lib/landing-content";
import { ProductExitLink } from "./product-exit-link";

type Content = LandingContent;
type StatsCopy = {
  latency: string;
  unitEconomics: string;
  businessModel: string;
  latencyDelta: string;
  economicsDelta: string;
  businessDelta: string;
};

const proofByLocale: Record<AppLocale, string[]> = {
  "es-AR": ["SaaS trazable", "Titularidad / Garantía / Procedencia", "SaaS para identidad física verificable"],
  "pt-BR": ["SaaS rastreável", "Titularidade / Garantia / Procedência", "SaaS para identidade física verificável"],
  en: ["Traceable SaaS", "Ownership / Warranty / Provenance", "SaaS for verifiable physical identity"],
};

export function HeroSection({ content, stats, locale }: { content: Content; stats: StatsCopy; locale: AppLocale }) {
  void stats;
  const proofItems = [...new Set(proofByLocale[locale] || proofByLocale["es-AR"])]
  const badgeText = content.hero.badge;
  const heroTitle = content.hero.title;
  const heroBody = content.hero.body;
  const demoCta = locale === "en" ? "View interactive demo" : locale === "pt-BR" ? "Ver demo interativa" : "Ver demo interactiva";
  const samplesCta = locale === "en" ? "Request demo" : locale === "pt-BR" ? "Solicitar demo" : "Pedir demo";
  const resellerCta = locale === "en" ? "Become a reseller" : locale === "pt-BR" ? "Quero ser reseller" : "Quiero ser reseller";
  const salesCta = locale === "en" ? "Talk to sales" : locale === "pt-BR" ? "Falar com vendas" : "Hablar con ventas";
  const waSalesCta = locale === "en" ? "WhatsApp sales" : locale === "pt-BR" ? "WhatsApp vendas" : "WhatsApp ventas";
  const waCeoCta = locale === "en" ? "WhatsApp CEO" : locale === "pt-BR" ? "WhatsApp CEO" : "WhatsApp CEO";
  const demoLabCta = locale === "en" ? "Open Demo Lab" : locale === "pt-BR" ? "Abrir Demo Lab" : "Abrir Demo Lab";
  const aiGuideCta = locale === "en" ? "AI guide · ask anything" : locale === "pt-BR" ? "BotIA · consultoria guiada" : "BotIA · asesoría guiada";
  return (
    <section className="container-shell py-16 md:py-24">
      <div className="hero-shell grid gap-10 rounded-[2rem] p-6 md:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {badgeText}
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
            <BrandDot size={10} variant="ripple" theme="dark" />
            <span>{locale === "en" ? "Production-ready product OS" : locale === "pt-BR" ? "Product OS pronto para produção" : "Product OS listo para producción"}</span>
          </div>

          <h1 className="mt-6 text-balance text-5xl font-black tracking-tight text-white md:text-7xl">{heroTitle}</h1>
          <p className="hero-subtitle mt-6 max-w-2xl text-lg leading-8 text-slate-300">{heroBody}</p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <a href="#demo" className="hero-cta hero-cta--cyan rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100">{demoCta}</a>
            <Link href="/?contact=demo#contact-modal" className="hero-cta hero-cta--emerald rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100">{samplesCta}</Link>
            <Link href="/?contact=reseller#contact-modal" className="hero-cta hero-cta--violet rounded-xl border border-violet-300/35 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-100">{resellerCta}</Link>
            <Link href="/?contact=sales#contact-modal" className="hero-cta hero-cta--neutral rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100">{salesCta}</Link>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <a href="/?assistant=open" className="hero-mini-cta hero-mini-cta--cyan rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">{aiGuideCta}</a>
            <a href="https://wa.me/5492613168608?text=Hola%20quiero%20hablar%20con%20ventas%20nexID" target="_blank" rel="noreferrer" className="hero-mini-cta hero-mini-cta--emerald rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">{waSalesCta}</a>
            <a href="https://wa.me/5492613168608?text=Hola%20quiero%20hablar%20con%20el%20CEO%20de%20nexID" target="_blank" rel="noreferrer" className="hero-mini-cta hero-mini-cta--violet rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">{waCeoCta}</a>
          </div>

          <div className="mt-2">
            <ProductExitLink kind="demoLab" className="hero-mini-cta hero-mini-cta--neutral inline-flex rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-200">{demoLabCta}</ProductExitLink>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {proofItems.map((item) => (
              <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {item}
              </span>
            ))}
          </div>
        </div>

        <Card className="hero-panel hero-glow p-5 md:p-6">
          <HeroScene locale={locale} />
        </Card>
      </div>
    </section>
  );
}

export function TrustBarSection({ content }: { content: Content }) {
  return (
    <section className="container-shell pb-10">
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-5">
        {content.trustBar.map((item) => (
          <div key={item} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-center text-xs uppercase tracking-[0.14em] text-cyan-200">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorksSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.howItWorks.eyebrow} title={content.howItWorks.title} description={content.howItWorks.description} />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {content.howItWorks.steps.map((step) => (
          <Card key={step.title} className="p-5">
            <p className="text-sm font-semibold text-white">{step.title}</p>
            <p className="mt-2 text-sm leading-7 text-slate-400">{step.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function CardsSection({ content }: { content: Content }) {
  return (
    <section id="platform" className="container-shell py-16">
      <SectionHeading eyebrow={content.what.eyebrow} title={content.what.title} description={content.what.description} />
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {content.what.cards.map((card) => (
          <Card key={card.title} className="animate-card-shift p-6">
            <div className="text-base font-semibold text-white">{card.title}</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">{card.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}



export function EventsTagPositioningSection({ locale }: { locale: AppLocale }) {
  const copy = locale === "en"
    ? {
      eyebrow: "Events / NTAG215 positioning",
      title: "Why NTAG215 wins against QR in many event flows",
      intro: "NTAG215 is built for tap UX, serialisation and operational control in wristbands, tickets and credentials. It is not premium anti-fraud.",
      basicTitle: "NTAG215 Basic (events and activations)",
      basicBullets: [
        "Faster check-in than QR/email/photo in crowded access points.",
        "Each physical piece can be serialised with UID and rules server-side.",
        "Harder to share casually than a screenshot-based QR flow.",
        "Ideal for event wristbands, credentials, tickets and brand activations.",
      ],
      secureTitle: "NTAG 424 DNA TagTamper (premium anti-fraud)",
      secureBullets: [
        "Use this profile when anti-clone and tamper resistance are business critical.",
        "Recommended for wine, cosmetics, docs/presence and high-risk supply chains.",
      ],
      footer: "Message to buyers: NTAG215 = UX + control + serialisation. NTAG 424 DNA TT = strong anti-fraud.",
    }
    : locale === "pt-BR"
    ? {
      eyebrow: "Posicionamento Eventos / NTAG215",
      title: "Por que NTAG215 supera QR em muitos fluxos de evento",
      intro: "NTAG215 é para UX por toque, serialização e controle operacional em pulseiras, tickets e credenciais. Não é anti-fraude premium.",
      basicTitle: "NTAG215 Basic (eventos e ativações)",
      basicBullets: [
        "Check-in mais rápido que QR/email/foto em acessos com fila.",
        "Cada peça física pode ser serializada com UID e regras no backend.",
        "Mais difícil de compartilhar casualmente do que um QR por screenshot.",
        "Ideal para pulseiras, credenciais, tickets e ativações de marca.",
      ],
      secureTitle: "NTAG 424 DNA TagTamper (anti-fraude premium)",
      secureBullets: [
        "Use este perfil quando anti-clone e tamper são críticos.",
        "Recomendado para vinho, cosméticos, docs/presence e cadeias de risco.",
      ],
      footer: "Mensagem comercial: NTAG215 = UX + controle + serialização. NTAG 424 DNA TT = anti-fraude forte.",
    }
    : {
      eyebrow: "Posicionamiento Eventos / NTAG215",
      title: "Por qué NTAG215 supera al QR en muchos flujos de eventos",
      intro: "NTAG215 está pensado para UX por tap, serialización y control operativo en pulseras, tickets y credenciales. No es anti-fraude premium.",
      basicTitle: "NTAG215 Basic (eventos y activaciones)",
      basicBullets: [
        "Check-in más rápido que QR/email/foto en accesos con filas.",
        "Cada pieza física puede serializarse con UID y reglas server-side.",
        "Más difícil de compartir casualmente que un QR por screenshot.",
        "Ideal para pulseras, credenciales, tickets y activaciones de marca.",
      ],
      secureTitle: "NTAG 424 DNA TagTamper (anti-fraude premium)",
      secureBullets: [
        "Usá este perfil cuando anti-clonación y tamper sean críticos.",
        "Recomendado para vino, cosmética, docs/presence y cadenas de alto riesgo.",
      ],
      footer: "Mensaje comercial: NTAG215 = UX + control + serialización. NTAG 424 DNA TT = anti-fraude fuerte.",
    };

  return (
    <section className="container-shell py-16">
      <Card className="p-6 md:p-8">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.intro} />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4">
            <p className="text-sm font-semibold text-cyan-200">{copy.basicTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {copy.basicBullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-violet-300/25 bg-violet-500/10 p-4">
            <p className="text-sm font-semibold text-violet-200">{copy.secureTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {copy.secureBullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}
            </ul>
          </div>
        </div>
        <p className="mt-5 text-sm text-slate-300">{copy.footer}</p>
      </Card>
    </section>
  );
}
export function PlansSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.plans.eyebrow} title={content.plans.title} description={content.plans.description} />
      <div className="mt-10 grid gap-6 xl:grid-cols-3">
        {content.plans.cards.map((plan) => (
          <Card key={plan.name} className="animate-card-shift p-6">
            <Badge tone={plan.name.includes("ENTERPRISE") ? "amber" : "cyan"}>{plan.badge}</Badge>
            <div className="mt-4 text-2xl font-bold text-white">{plan.name}</div>
            <p className="mt-2 text-sm text-cyan-300">{plan.price}</p>
            <p className="mt-3 text-sm leading-7 text-slate-400">{plan.body}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {plan.bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function AuthenticityStatesSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.authenticity.eyebrow} title={content.authenticity.title} description={content.authenticity.description} />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {content.authenticity.cards.map((item) => (
          <Card key={item.state} className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.state}</p>
            <p className={`mt-3 text-lg font-semibold ${item.tone === "good" ? "text-emerald-300" : item.tone === "warn" ? "text-amber-300" : "text-rose-300"}`}>
              {item.tone === "good" ? content.authenticity.badges.good : item.tone === "warn" ? content.authenticity.badges.warn : content.authenticity.badges.risk}
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-400">{item.detail}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function BulletSection({ eyebrow, title, description, bullets }: { eyebrow: string; title: string; description: string; bullets: string[] }) {
  return (
    <section className="container-shell py-16">
      <Card className="p-8">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {bullets.map((bullet) => (
            <div key={bullet} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{bullet}</div>
          ))}
        </div>
      </Card>
    </section>
  );
}

export function UseCasesSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.useCases.eyebrow} title={content.useCases.title} description={content.useCases.description} />
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {content.useCases.cards.map((item) => (
          <Card key={item.title} className="animate-card-shift p-6">
            <div className="text-base font-semibold text-white">{item.title}</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">{item.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function ResellerSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.reseller.eyebrow} title={content.reseller.title} description={content.reseller.description} />
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {content.reseller.cards.map((item) => (
          <Card key={item.title} className="animate-card-shift p-6">
            <div className="text-lg font-bold text-white">{item.title}</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">{item.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function RoiCredibilitySection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHeading eyebrow={content.roi.eyebrow} title={content.roi.title} description={content.roi.description} />
          <div className="mt-6 space-y-4">
            {content.roi.metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{metric.value}</p>
                <p className="mt-1 text-sm text-slate-400">{metric.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeading eyebrow={content.credibility.eyebrow} title={content.credibility.title} description={content.credibility.description} />
          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            {content.credibility.items.map((item) => <li key={item}>• {item}</li>)}
          </ul>
          <div className="mt-6"><WorldMapPlaceholder /></div>
        </Card>
      </div>
    </section>
  );
}

export function CtaSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-20">
      <Card className="hero-glow p-8 text-center">
        <h2 className="text-3xl font-bold text-white">{content.cta.title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">{content.cta.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/?contact=demo#contact-modal"><Button>{content.cta.primary}</Button></Link>
          <Link href="/?contact=sales#contact-modal"><Button variant="secondary">{content.cta.secondary}</Button></Link>
        </div>
      </Card>
    </section>
  );
}
