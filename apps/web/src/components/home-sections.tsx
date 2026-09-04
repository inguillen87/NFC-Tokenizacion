import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Package,
  Recycle,
  UserRound,
  Wrench,
} from "lucide-react";
import { DppRoleExplorer } from "./dpp-role-explorer";
import { HeroImmersiveSignal } from "./hero-immersive-signal";
import { SimpleTrustFlowIntroMotion } from "./simple-trust-flow-motion";
import { SimpleTrustIndustryJourney } from "./simple-trust-industry-journey";
import nexIdDppHero from "../../public/landing/nexid-dpp-hero-v3.webp";

type Content = {
  hero: {
    badge: string;
    title: string;
    body: string;
    primary: string;
    secondary: string;
  };
};

export function HeroSection({ content, locale }: { content: Content; locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const hero = content.hero;
  const proofPoints = isEn
    ? ["Model, batch or item identity", "Available information and history", "NFC + QR, no app"]
    : isBr
      ? ["Identidade por modelo, lote ou unidade", "Informação e história disponíveis", "NFC + QR, sem app"]
      : ["Identidad por modelo, lote o unidad", "Información e historia disponibles", "NFC + QR, sin app"];

  return (
    <section className="landing-hero-section relative overflow-hidden border-b pb-6 pt-8 lg:pb-8 lg:pt-12">
      <div className="hero-immersive-media pointer-events-none absolute inset-x-0 top-0 z-0" aria-hidden="true">
        <Image
          src={nexIdDppHero}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="hero-immersive-image"
        />
        <div className="hero-immersive-veil" />
        <HeroImmersiveSignal locale={locale} />
      </div>
      <div className="hero-signal-field pointer-events-none absolute inset-0 z-0" aria-hidden="true" />

      <div className="container-shell relative z-10">
        <div className="hero-story-grid grid min-w-0 items-center">
          <div className="hero-main-copy min-w-0 max-w-[47rem] text-left">
            <div className="hero-eyebrow-chip inline-flex items-center gap-2 rounded-full border px-4 py-1.5 backdrop-blur-md">
              <span className="hero-eyebrow-dot flex h-2 w-2 rounded-full" aria-hidden="true" />
              <span className="hero-eyebrow-copy text-xs font-medium uppercase tracking-widest">{hero.badge}</span>
            </div>

            <h1 className="brand-editorial-gradient mt-6 max-w-4xl pb-2 text-[2.65rem] font-extrabold leading-[1.03] tracking-[-0.045em] sm:text-[3.5rem] lg:text-[4.25rem]">
              {hero.title}
            </h1>
            <p className="hero-subtitle mt-5 max-w-2xl text-base leading-7 md:text-lg md:leading-8">
              {hero.body}
            </p>

            <div className="hero-post-video-actions mt-7" role="group" aria-label={isEn ? "Main actions" : isBr ? "Ações principais" : "Acciones principales"}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="#como-funciona" className="inline-flex min-h-12 hero-primary-action items-center justify-center rounded-xl px-6 py-3 text-sm font-bold transition hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                  {hero.primary}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/?contact=demo#contact-modal" className="inline-flex min-h-12 hero-secondary-action items-center justify-center rounded-xl border px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                  {hero.secondary}
                </Link>
              </div>
            </div>

            <ul className="mt-6 flex flex-wrap gap-2" aria-label={isEn ? "Experience highlights" : isBr ? "Destaques da experiência" : "Claves de la experiencia"}>
              {proofPoints.map((point) => (
                <li key={point} className="hero-proof-chip inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold">
                  <span className="hero-proof-dot h-1.5 w-1.5 rounded-full" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}

export function SimpleTrustFlowSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
        eyebrow: "How it works",
        title: "From the product to its passport, in three moments.",
        body: "Choose an industry and follow one product from its identity to its current information and the services available through NFC or QR.",
        primary: "Try the interactive passport",
      }
    : isBr
      ? {
          eyebrow: "Como funciona",
          title: "Do produto ao seu passaporte, em três momentos.",
          body: "Escolha um setor e acompanhe um único produto desde sua identidade até as informações atuais e os serviços disponíveis por NFC ou QR.",
          primary: "Testar o passaporte interativo",
        }
      : {
          eyebrow: "Cómo funciona",
          title: "Del producto a su pasaporte, en tres momentos.",
          body: "Elegí un rubro y seguí un único producto desde su identidad hasta la información vigente y los servicios disponibles por NFC o QR.",
          primary: "Probar el pasaporte interactivo",
        };

  return (
    <section id="como-funciona" className="simple-trust-flow-section container-shell py-8 md:py-12">
      <div className="simple-trust-flow-shell">
        <SimpleTrustFlowIntroMotion eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
        <SimpleTrustIndustryJourney locale={locale} ctaLabel={copy.primary} />
      </div>
    </section>
  );
}

export function CommercialValueSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
        label: "Digital product passport participants and information flow",
        eyebrow: "THE PASSPORT ECOSYSTEM",
        title: "Every participant sees what they need. The company keeps control.",
        intro:
          "A tap opens the experience for the person. The passport keeps the product context. The company publishes and governs it. The dashboard returns operational activity without treating a tag as a person's identity.",
        stages: [
          {
            key: "person",
            step: "01",
            actor: "Person",
            title: "Checks from their phone",
            body: "Sees public information, history, guidance and enabled services without installing an app.",
            detail: "Personal data requires a valid basis and applicable consent.",
          },
          {
            key: "passport",
            step: "02",
            actor: "Product + passport",
            title: "Keeps the context together",
            body: "Links a model, batch or item to the current information published by the organization.",
            detail: "Carries digital identity, source and visibility rules.",
          },
          {
            key: "company",
            step: "03",
            actor: "Company",
            title: "Publishes and governs",
            body: "Defines which content, service or channel is available for each connected product.",
            detail: "The organization remains responsible for its declarations.",
          },
          {
            key: "dashboard",
            step: "04",
            actor: "Business dashboard",
            title: "Turns activity into operations",
            body: "Organizes registered taps and actions for analytics, follow-up and product improvement.",
            detail: "Returns product context to the authorized team.",
          },
        ],
        returnLabel: "What can return to the CRM",
        returnIntro: "Subject to availability, source and permissions:",
        returns: ["Reads by product or batch", "Content consulted", "Services started", "Reported or consented zone"],
        serviceTitle: "Service / channel",
        serviceBody: "Receives only the product context needed to resolve the task when the company enables it.",
        circularityTitle: "Circularity / authority",
        circularityBody: "Reviews applicable information, its source and responsible party according to the available access.",
        boundary:
          "nexID organizes records and digital evidence. It does not identify a person from a tag and does not certify the physical product by itself.",
        detailEyebrow: "EXPLORE THE DETAIL",
        detailBody: "Choose a role below to inspect fields, sources, responsible parties, record level and visibility.",
      }
    : isBr
      ? {
          label: "Participantes e fluxo de informação do passaporte digital do produto",
          eyebrow: "O ECOSSISTEMA DO PASSAPORTE",
          title: "Cada participante vê o que precisa. A empresa mantém o controle.",
          intro:
            "Um toque abre a experiência para a pessoa. O passaporte preserva o contexto do produto. A empresa publica e governa. O dashboard devolve atividade operacional sem tratar uma etiqueta como identidade pessoal.",
          stages: [
            {
              key: "person",
              step: "01",
              actor: "Pessoa",
              title: "Consulta pelo celular",
              body: "Vê informação pública, história, orientações e serviços habilitados sem instalar um aplicativo.",
              detail: "Dados pessoais exigem base válida e consentimento aplicável.",
            },
            {
              key: "passport",
              step: "02",
              actor: "Produto + passaporte",
              title: "Mantém o contexto unido",
              body: "Relaciona modelo, lote ou unidade com a informação atual publicada pela organização.",
              detail: "Transporta identidade digital, fonte e regras de visibilidade.",
            },
            {
              key: "company",
              step: "03",
              actor: "Empresa",
              title: "Publica e governa",
              body: "Define qual conteúdo, serviço ou canal fica disponível para cada produto conectado.",
              detail: "A organização continua responsável por suas declarações.",
            },
            {
              key: "dashboard",
              step: "04",
              actor: "Dashboard empresarial",
              title: "Transforma atividade em operação",
              body: "Organiza toques e ações registradas para análise, acompanhamento e melhoria do produto.",
              detail: "Devolve contexto do produto à equipe autorizada.",
            },
          ],
          returnLabel: "O que pode voltar ao CRM",
          returnIntro: "Segundo disponibilidade, fonte e permissões:",
          returns: ["Leituras por produto ou lote", "Conteúdo consultado", "Serviços iniciados", "Zona informada ou consentida"],
          serviceTitle: "Serviço / canal",
          serviceBody: "Recebe somente o contexto necessário do produto quando a empresa habilita esse atendimento.",
          circularityTitle: "Circularidade / autoridade",
          circularityBody: "Consulta a informação aplicável, sua fonte e responsável conforme o acesso disponível.",
          boundary:
            "A nexID organiza registros e evidência digital. Não identifica uma pessoa por uma etiqueta nem certifica, sozinha, o produto físico.",
          detailEyebrow: "EXPLORE O DETALHE",
          detailBody: "Escolha um papel abaixo para ver campos, fontes, responsáveis, nível do registro e visibilidade.",
        }
      : {
          label: "Participantes y flujo de información del pasaporte digital de producto",
          eyebrow: "EL ECOSISTEMA DEL PASAPORTE",
          title: "Cada participante ve lo que necesita. La empresa conserva el control.",
          intro:
            "Un tap abre la experiencia para la persona. El pasaporte conserva el contexto del producto. La empresa publica y gobierna. El dashboard devuelve actividad operativa sin convertir una etiqueta en la identidad de una persona.",
          stages: [
            {
              key: "person",
              step: "01",
              actor: "Persona",
              title: "Consulta desde su celular",
              body: "Ve información pública, historia, instrucciones y servicios habilitados sin instalar una app.",
              detail: "Los datos personales requieren base válida y consentimiento aplicable.",
            },
            {
              key: "passport",
              step: "02",
              actor: "Producto + pasaporte",
              title: "Conserva el contexto",
              body: "Relaciona modelo, lote o unidad con la información vigente publicada por la organización.",
              detail: "Transporta identidad digital, fuente y reglas de visibilidad.",
            },
            {
              key: "company",
              step: "03",
              actor: "Empresa",
              title: "Publica y gobierna",
              body: "Define qué contenido, servicio o canal queda disponible para cada producto conectado.",
              detail: "La organización sigue siendo responsable de sus declaraciones.",
            },
            {
              key: "dashboard",
              step: "04",
              actor: "Dashboard de la empresa",
              title: "Convierte actividad en operación",
              body: "Ordena taps y acciones registradas para analítica, seguimiento y mejora del producto.",
              detail: "Devuelve contexto del producto al equipo autorizado.",
            },
          ],
          returnLabel: "Qué puede volver al CRM",
          returnIntro: "Según disponibilidad, fuente y permisos:",
          returns: ["Lecturas por producto o lote", "Contenido consultado", "Servicios iniciados", "Zona informada o consentida"],
          serviceTitle: "Servicio / canal",
          serviceBody: "Recibe sólo el contexto necesario del producto cuando la empresa habilita esa atención.",
          circularityTitle: "Circularidad / autoridad",
          circularityBody: "Consulta la información aplicable, su fuente y responsable según el acceso disponible.",
          boundary:
            "nexID organiza registros y evidencia digital. No identifica a una persona desde una etiqueta ni certifica por sí sola el producto físico.",
          detailEyebrow: "EXPLORÁ EL DETALLE",
          detailBody: "Elegí un rol abajo para revisar campos, fuentes, responsables, nivel de registro y visibilidad.",
        };

  const stageIcons = [UserRound, Package, Building2, BarChart3] as const;

  return (
    <section className="commercial-value-section container-shell" aria-label={copy.label}>
      <div className="commercial-value-shell">
        <div className="dpp-participant-map">
          <header className="dpp-participant-map__intro">
            <p>{copy.eyebrow}</p>
            <h2>{copy.title}</h2>
            <span>{copy.intro}</span>
          </header>

          <ol className="dpp-participant-map__flow" aria-label={copy.label}>
            {copy.stages.map((stage, index) => {
              const Icon = stageIcons[index] ?? Package;

              return (
                <li key={stage.key} data-participant={stage.key}>
                  <article className="dpp-participant-card">
                    <div className="dpp-participant-card__topline">
                      <span className="dpp-participant-card__icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="dpp-participant-card__step">{stage.step}</span>
                    </div>
                    <p className="dpp-participant-card__actor">{stage.actor}</p>
                    <h3>{stage.title}</h3>
                    <p className="dpp-participant-card__body">{stage.body}</p>
                    <span className="dpp-participant-card__detail">{stage.detail}</span>
                  </article>
                  {index < copy.stages.length - 1 ? (
                    <span className="dpp-participant-arrow" aria-hidden="true">
                      <ArrowRight />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <div className="dpp-participant-map__return">
            <div className="dpp-participant-return-copy">
              <span className="dpp-participant-return-icon" aria-hidden="true"><BarChart3 /></span>
              <div>
                <strong>{copy.returnLabel}</strong>
                <small>{copy.returnIntro}</small>
              </div>
            </div>
            <ul>
              {copy.returns.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <aside className="dpp-participant-map__secondary" aria-label={isEn ? "Supporting roles" : isBr ? "Papéis de apoio" : "Roles complementarios"}>
            <article>
              <span aria-hidden="true"><Wrench /></span>
              <div><strong>{copy.serviceTitle}</strong><p>{copy.serviceBody}</p></div>
            </article>
            <article>
              <span aria-hidden="true"><Recycle /></span>
              <div><strong>{copy.circularityTitle}</strong><p>{copy.circularityBody}</p></div>
            </article>
          </aside>

          <p className="dpp-participant-map__boundary">{copy.boundary}</p>
        </div>

        <div className="dpp-participant-detail-bridge">
          <strong>{copy.detailEyebrow}</strong>
          <span>{copy.detailBody}</span>
        </div>
        <DppRoleExplorer locale={locale} />
      </div>
    </section>
  );
}
