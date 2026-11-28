import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, CircleHelp, LockOpen, UserRound } from "lucide-react";
import { sunDemoScenarioHref } from "../lib/sun-demo-links";
import { BrandControlCenterPreview } from "./brand-control-center-preview";
import wineShot from "../../public/landing/connected-journey/wine-journey-02.webp";
import agroShot from "../../public/landing/connected-journey/agro-journey-02.webp";
import packagingShot from "../../public/landing/connected-journey/packaging-journey-02.webp";
import fx from "./home-enhancements.module.css";

export function ReadingOutcomesSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
        eyebrow: "What a reading can show",
        title: "Three outcomes, explained plainly.",
        body: "A reading can end in three ways. In each one the passport says what it means and what you can do next.",
        example: "See the demo example",
        compare: "Compare nexID with other approaches",
        outcomes: [
          { tone: "ok", title: "Reading checked", body: "The tag message matches the brand record. You see the passport and the services the brand enabled." },
          { tone: "warn", title: "Seal open", body: "The tag reports that the seal was opened. That does not prove a counterfeit: each brand policy defines what it means." },
          { tone: "risk", title: "Reading not checked", body: "The message could not be checked. The passport says so clearly: the product page stays available and protected actions are blocked." },
        ],
      }
    : isBr
      ? {
          eyebrow: "O que uma leitura pode mostrar",
          title: "Três resultados, explicados com clareza.",
          body: "Uma leitura pode terminar de três maneiras. Em todas, o passaporte diz o que significa e o que você pode fazer.",
          example: "Ver o exemplo da demo",
          compare: "Comparar a nexID com outras abordagens",
          outcomes: [
            { tone: "ok", title: "Leitura conferida", body: "A mensagem da tag coincide com o registro da marca. Você vê o passaporte e os serviços habilitados." },
            { tone: "warn", title: "Lacre aberto", body: "A tag informa que o lacre foi aberto. Isso não demonstra falsificação: a política de cada marca define o que significa." },
            { tone: "risk", title: "Leitura não conferida", body: "A mensagem não pôde ser conferida. O passaporte diz isso com clareza: a ficha continua disponível e as ações protegidas ficam bloqueadas." },
          ],
        }
      : {
          eyebrow: "Qué puede mostrar una lectura",
          title: "Tres resultados, explicados sin vueltas.",
          body: "Una lectura puede terminar de tres maneras. En todas, el pasaporte te dice qué significa y qué podés hacer.",
          example: "Ver el ejemplo de la demo",
          compare: "Comparar nexID con otros enfoques",
          outcomes: [
            { tone: "ok", title: "Lectura comprobada", body: "El mensaje del tag coincide con el registro de la marca. Ves el pasaporte y los servicios habilitados." },
            { tone: "warn", title: "Sello abierto", body: "El tag informa que el sello se abrió. No demuestra falsificación: qué significa lo define la política de cada marca." },
            { tone: "risk", title: "Lectura no comprobada", body: "El mensaje no pudo comprobarse. El pasaporte lo dice con claridad: la ficha sigue disponible y las acciones protegidas se bloquean." },
          ],
        };
  const scenarios = ["closed", "opened", "invalid"] as const;
  const icons = [BadgeCheck, LockOpen, CircleHelp] as const;

  return (
    <section className={`container-shell ${fx.outcomes}`} aria-labelledby="home-outcomes">
      <header className={`${fx.outcomesIntro} ${fx.reveal}`} data-reveal>
        <p className={fx.audienceLabel}>{copy.eyebrow}</p>
        <h2 id="home-outcomes">{copy.title}</h2>
        <p>{copy.body}</p>
      </header>
      <ol className={fx.outcomesList}>
        {copy.outcomes.map((outcome, index) => {
          const Icon = icons[index] ?? BadgeCheck;
          return (
            <li key={outcome.title} className={`${fx.outcomeCard} ${fx.reveal}`} data-tone={outcome.tone} data-reveal data-spotlight style={{ "--reveal-i": index } as CSSProperties}>
              <span className={fx.outcomeIcon} aria-hidden="true"><Icon size={22} /></span>
              <h3>{outcome.title}</h3>
              <p>{outcome.body}</p>
              <Link href={sunDemoScenarioHref("agrochem", scenarios[index] ?? "closed")} prefetch={false} className={fx.outcomeLink}>
                {copy.example}<span className={fx.srOnly}>: {outcome.title}</span><ArrowRight size={15} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ol>
      <p className={`${fx.outcomesFooter} ${fx.reveal}`} data-reveal>
        <Link href="/compare" prefetch={false} className={fx.audienceSecondary}>{copy.compare}</Link>
      </p>
    </section>
  );
}

export function AudienceSection({ locale, loginHref }: { locale: string; loginHref: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
        label: "Where to continue",
        consumer: "For consumers", products: "Your products, in one place", consumerBody: "Open your saved passports and find the services each brand has made available.", account: "Go to my account",
        business: "For brands", customers: "Stay close to your customers", businessBody: "Publish product information and choose which benefits your customers can access from the label.", contact: "Book a demo for my brand", login: "Business sign-in",
      }
    : isBr
      ? {
          label: "Por onde continuar",
          consumer: "Para consumidores", products: "Seus produtos em um só lugar", consumerBody: "Abra seus passaportes salvos e encontre os serviços que cada marca disponibilizou.", account: "Ir para minha conta",
          business: "Para marcas", customers: "Fique perto dos seus clientes", businessBody: "Publique informações do produto e escolha quais benefícios seus clientes podem acessar pela etiqueta.", contact: "Agendar demo para minha marca", login: "Acesso empresas",
        }
      : {
          label: "Por dónde seguir",
          consumer: "Para consumidores", products: "Tus productos, en un solo lugar", consumerBody: "Abrí tus pasaportes guardados y encontrá los servicios que habilitó cada marca.", account: "Ir a mi cuenta",
          business: "Para marcas", customers: "Seguí cerca de tus clientes", businessBody: "Publicá la información del producto y elegí qué beneficios podrán consultar tus clientes desde la etiqueta.", contact: "Agendar demo para mi marca", login: "Acceso empresas",
        };

  return (
    <section className={`container-shell ${fx.audiences}`} aria-label={copy.label}>
      <article className={`${fx.audienceCard} ${fx.reveal}`} data-audience="consumers" data-reveal data-spotlight aria-labelledby="home-consumers">
        <span className={fx.audienceIcon} aria-hidden="true"><UserRound size={22} /></span>
        <p className={fx.audienceLabel}>{copy.consumer}</p>
        <h2 id="home-consumers">{copy.products}</h2>
        <p className={fx.audienceBody}>{copy.consumerBody}</p>
        <div className={fx.audienceActions}>
          <Link href="/me" prefetch={false} className={fx.audiencePrimary}>{copy.account}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </article>
      <article className={`${fx.audienceCard} ${fx.reveal}`} data-audience="brands" data-reveal data-spotlight style={{ "--reveal-i": 1 } as CSSProperties} aria-labelledby="home-brands">
        <span className={fx.audienceIcon} aria-hidden="true"><Building2 size={22} /></span>
        <p className={fx.audienceLabel}>{copy.business}</p>
        <h2 id="home-brands">{copy.customers}</h2>
        <p className={fx.audienceBody}>{copy.businessBody}</p>
        <div className={fx.audienceActions}>
          <Link href="/?contact=demo#contact-modal" prefetch={false} className={fx.audiencePrimary}>{copy.contact}<ArrowRight size={16} aria-hidden="true" /></Link>
          <a href={loginHref} className={fx.audienceSecondary}>{copy.login}</a>
        </div>
      </article>
    </section>
  );
}

export function ControlCenterSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? { eyebrow: "For brands · try it here", title: "Set up a sample passport and watch it change.", body: "Link a product, choose what to show, enable services and review the activity. Everything in this panel is illustrative sample data." }
    : isBr
      ? { eyebrow: "Para marcas · teste aqui", title: "Configure um passaporte de amostra e veja como muda.", body: "Vincule um produto, escolha o que mostrar, habilite serviços e revise a atividade. Tudo neste painel são dados ilustrativos de amostra." }
      : { eyebrow: "Para marcas · probalo acá", title: "Configurá un pasaporte de muestra y mirá cómo cambia.", body: "Vinculá un producto, elegí qué mostrar, habilitá servicios y revisá la actividad. Todo en este panel son datos ilustrativos de muestra." };

  return (
    <section className={`container-shell ${fx.outcomes} ${fx.controlCenter}`} aria-labelledby="home-control-center" data-home-control-center>
      <header className={`${fx.outcomesIntro} ${fx.reveal}`} data-reveal>
        <p className={fx.audienceLabel}>{copy.eyebrow}</p>
        <h2 id="home-control-center">{copy.title}</h2>
        <p>{copy.body}</p>
      </header>
      <div className={`${fx.controlCenterStage} ${fx.reveal}`} data-reveal>
        <BrandControlCenterPreview locale={locale} />
      </div>
    </section>
  );
}

export function DemoLauncherSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
        eyebrow: "Try it with a product", title: "Pick an industry. Open its passport.", scope: "Guided demos · sample data",
        open: "Open the demo", all: "See every demo", platform: "How it works and why it is secure", compare: "Compare approaches",
        demos: [
          { key: "wine", name: "Wine and beverages", body: "Origin, seal status and service from the bottle." },
          { key: "agro", name: "Agro", body: "Batch, documentation and guidance in the field." },
          { key: "packaging", name: "Packaging and premium goods", body: "Product information and benefits from the pack." },
        ],
      }
    : isBr
      ? {
          eyebrow: "Teste com um produto", title: "Escolha um setor. Abra o passaporte.", scope: "Demos guiadas · dados de exemplo",
          open: "Abrir a demo", all: "Ver todas as demos", platform: "Como funciona e por que é seguro", compare: "Comparar abordagens",
          demos: [
            { key: "wine", name: "Vinhos e bebidas", body: "Origem, estado do lacre e serviço a partir da garrafa." },
            { key: "agro", name: "Agro", body: "Lote, documentação e orientação no campo." },
            { key: "packaging", name: "Embalagens e produtos premium", body: "Informação do produto e benefícios a partir da embalagem." },
          ],
        }
      : {
          eyebrow: "Probalo con un producto", title: "Elegí un rubro. Abrí su pasaporte.", scope: "Demos guiadas · datos de ejemplo",
          open: "Abrir la demo", all: "Ver todas las demos", platform: "Cómo funciona y por qué es seguro", compare: "Comparar enfoques",
          demos: [
            { key: "wine", name: "Vinos y bebidas", body: "Origen, estado del sello y servicio desde la botella." },
            { key: "agro", name: "Agro", body: "Lote, documentación y guía en el campo." },
            { key: "packaging", name: "Packaging y productos premium", body: "Información del producto y beneficios desde el envase." },
          ],
        };
  const media = { wine: wineShot, agro: agroShot, packaging: packagingShot } as const;
  const hrefs = {
    wine: "/demo-lab?vertical=wine",
    agro: sunDemoScenarioHref("agrochem", "closed"),
    packaging: sunDemoScenarioHref("fragrance", "closed"),
  } as const;

  return (
    <section className={`container-shell ${fx.launcher}`} aria-labelledby="home-demos">
      <header className={`${fx.outcomesIntro} ${fx.reveal}`} data-reveal>
        <p className={fx.audienceLabel}>{copy.eyebrow}</p>
        <h2 id="home-demos">{copy.title}</h2>
        <p>{copy.scope}</p>
      </header>
      <ul className={fx.launcherGrid}>
        {copy.demos.map((demo, index) => {
          const key = demo.key as keyof typeof media;
          return (
            <li key={demo.key} className={fx.reveal} data-reveal style={{ "--reveal-i": index } as CSSProperties}>
              <Link href={hrefs[key]} prefetch={false} className={fx.launcherCard} data-spotlight data-demo-entry={demo.key}>
                <span className={fx.launcherMedia}>
                  <Image src={media[key]} alt="" fill sizes="(min-width: 860px) 30vw, 92vw" />
                </span>
                <span className={fx.launcherBody}>
                  <strong>{demo.name}</strong>
                  <span>{demo.body}</span>
                  <em>{copy.open}<ArrowRight size={16} aria-hidden="true" /></em>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className={`${fx.launcherLinks} ${fx.reveal}`} data-reveal>
        <Link href="/demo-lab" prefetch={false} className={fx.audienceSecondary}>{copy.all}</Link>
        <Link href="/platform" prefetch={false} className={fx.audienceSecondary}>{copy.platform}</Link>
        <Link href="/compare" prefetch={false} className={fx.audienceSecondary}>{copy.compare}</Link>
      </p>
    </section>
  );
}
