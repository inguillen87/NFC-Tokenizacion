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
import { PassportFragmentTarget } from "./passport-fragment-target";
import { HeroImmersiveSignal } from "./hero-immersive-signal";
import { SimpleTrustFlowIntroMotion } from "./simple-trust-flow-motion";
import { SimpleTrustIndustryJourney } from "./simple-trust-industry-journey";
import nexIdDppHero from "../../public/landing/nexid-dpp-hero-v3.webp";
import styles from "./home-sections.module.css";

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
    <section className={`landing-hero-section ${styles.hero}`} data-hero-presentation="immersive">
      <div className={`hero-immersive-media ${styles.media}`} aria-hidden="true">
        <Image src={nexIdDppHero} alt="" fill priority placeholder="blur" sizes="100vw" className="hero-immersive-image" />
        <div className="hero-immersive-veil" />
        <HeroImmersiveSignal locale={locale} />
      </div>
      <div className="hero-signal-field pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
      <div className={`container-shell hero-story-grid ${styles.grid}`}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{hero.badge}</p>
            <h1 className={styles.title}>{hero.title}</h1>
            <p className={styles.body}>{hero.body}</p>
            <div className={styles.actions} role="group" aria-label={isEn ? "Main actions" : isBr ? "Ações principais" : "Acciones principales"}>
                <Link href="/demo-lab?profile=wine" prefetch={false} className={styles.primary}>
                  {hero.primary}<ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link href="/?contact=demo#contact-modal" prefetch={false} className={styles.secondary}>{hero.secondary}</Link>
            </div>
            <ul className={styles.proof} aria-label={isEn ? "Experience highlights" : isBr ? "Destaques da experiência" : "Claves de la experiencia"}>
              {proofPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p className={styles.caption}>
              <span>{isEn ? "The product is the starting point" : isBr ? "O produto é o ponto de partida" : "El producto es el punto de partida"}</span>
              <small>{isEn ? "Illustrative NFC experience" : isBr ? "Experiência NFC ilustrativa" : "Experiencia NFC ilustrativa"}</small>
            </p>
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
        personLane: "PERSON EXPERIENCE · WHAT OPENS FROM THE PRODUCT",
        businessLane: "BUSINESS OPERATION · WHAT RETURNS TO THE CONTROL CENTER",
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
        boundaryPrefix: "",
        boundaryBrand: "nexID",
        boundaryBody:
          "organizes records and digital evidence. It does not identify a person from a tag and does not certify the physical product by itself.",
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
          personLane: "EXPERIÊNCIA DA PESSOA · O QUE ABRE A PARTIR DO PRODUTO",
          businessLane: "OPERAÇÃO DA EMPRESA · O QUE VOLTA AO CENTRO DE CONTROLE",
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
          boundaryPrefix: "A ",
          boundaryBrand: "nexID",
          boundaryBody:
            "organiza registros e evidência digital. Não identifica uma pessoa por uma etiqueta nem certifica, sozinha, o produto físico.",
          detailEyebrow: "EXPLORE O DETALHE",
          detailBody: "Escolha um papel abaixo para ver campos, fontes, responsáveis, nível do registro e visibilidade.",
        }
      : {
          label: "Participantes y flujo de información del pasaporte digital de producto",
          eyebrow: "EL ECOSISTEMA DEL PASAPORTE",
          title: "Cada participante ve lo que necesita. La empresa conserva el control.",
          intro:
            "Un tap abre la experiencia para la persona. El pasaporte conserva el contexto del producto. La empresa publica y gobierna. El dashboard devuelve actividad operativa sin convertir una etiqueta en la identidad de una persona.",
          personLane: "EXPERIENCIA DE LA PERSONA · LO QUE ABRE DESDE EL PRODUCTO",
          businessLane: "OPERACIÓN DE LA EMPRESA · LO QUE VUELVE AL CENTRO DE CONTROL",
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
          boundaryPrefix: "",
          boundaryBrand: "nexID",
          boundaryBody:
            "organiza registros y evidencia digital. No identifica a una persona desde una etiqueta ni certifica por sí sola el producto físico.",
          detailEyebrow: "EXPLORÁ EL DETALLE",
          detailBody: "Elegí un rol abajo para revisar campos, fuentes, responsables, nivel de registro y visibilidad.",
        };

  const stageIcons = [UserRound, Package, Building2, BarChart3] as const;

  return (
    <section id="pasaporte-digital" className="commercial-value-section container-shell scroll-mt-24" aria-label={copy.label}>
      <PassportFragmentTarget />
      <div className="commercial-value-shell">
        <div className="dpp-participant-map">
          <header className="dpp-participant-map__intro">
            <p>{copy.eyebrow}</p>
            <h2>{copy.title}</h2>
            <span>{copy.intro}</span>
          </header>

          <div className="dpp-participant-map__lanes">
            <span><UserRound />{copy.personLane}</span>
            <span><Building2 />{copy.businessLane}</span>
          </div>

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

          <p className="dpp-participant-map__boundary">
            {copy.boundaryPrefix}<strong>{copy.boundaryBrand}</strong>{" "}{copy.boundaryBody}
          </p>
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
