import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleDot,
  Code2,
  HeartHandshake,
  Link2,
  PackageCheck,
  PlayCircle,
  Route,
  ScanLine,
} from "lucide-react";
import type { AppLocale } from "@product/config";
import { InstitutionalVideoPanel } from "../institutional-video-panel";
import { getIndustryCatalog, getMarketingCopy } from "./marketing-clear.content";
import styles from "./marketing-clear.module.css";

const momentIcons = [Link2, ScanLine, HeartHandshake] as const;
const outcomeIcons = [PackageCheck, Route, HeartHandshake] as const;
const pathIcons = [BookOpen, PlayCircle, Code2] as const;

export function ClearHome({ locale, initialTheme }: { locale: AppLocale; initialTheme: "light" | "dark" }) {
  const copy = getMarketingCopy(locale);
  const featuredIndustries = getIndustryCatalog(locale).filter((item) =>
    ["wine-spirits", "luxury-beauty", "events"].includes(item.slug),
  );

  return (
    <>
      <section className={`${styles.section} ${styles.heroSection}`} aria-labelledby="clear-home-title">
        <div className={`${styles.shell} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy.hero.eyebrow}</p>
            <h1 id="clear-home-title">{copy.hero.title}</h1>
            <p className={styles.heroBody}>{copy.hero.body}</p>
            <div className={styles.heroActions}>
              <a href="#institutional-video" className={styles.primaryButton}>
                <PlayCircle aria-hidden="true" />
                {copy.hero.primary}
              </a>
              <Link href="/solutions" className={styles.secondaryButton}>
                {copy.hero.secondary}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <p className={styles.heroNote}>
              <Check aria-hidden="true" />
              {copy.hero.note}
            </p>
          </div>

          <div className={styles.heroExperience}>
            <div className={styles.heroSignal} aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <article className={styles.productCard}>
              <div className={styles.productMedia}>
                <Image
                  src="/demo/wine-secure/real-malbec-bottle-pexels.jpg"
                  alt={locale === "en" ? "Wine bottle used in a connected-product demonstration" : locale === "pt-BR" ? "Garrafa usada em uma demonstração de produto conectado" : "Botella usada en una demostración de producto conectado"}
                  fill
                  priority
                  sizes="(max-width: 760px) 72vw, 280px"
                />
                <span className={styles.demoLabel}>{copy.hero.demo}</span>
              </div>
              <div className={styles.productMeta}>
                <small>nexID · NFC / QR</small>
                <strong>{copy.hero.product}</strong>
                <span>{locale === "en" ? "Connected product identity" : locale === "pt-BR" ? "Identidade de produto conectado" : "Identidad de producto conectado"}</span>
              </div>
            </article>

            <article className={styles.phoneCard}>
              <div className={styles.phoneTopbar}>
                <span>9:41</span>
                <strong>nexID</strong>
                <CircleDot aria-hidden="true" />
              </div>
              <div className={styles.phoneTap}>
                <span className={styles.tapGlyph} aria-hidden="true"><ScanLine /></span>
                <div>
                  <small>{copy.hero.tap}</small>
                  <strong>{copy.hero.product}</strong>
                </div>
              </div>
              <ul className={styles.phoneResults}>
                <li><Check aria-hidden="true" /><span>{copy.hero.state}</span></li>
                <li><Check aria-hidden="true" /><span>{copy.hero.declared}</span></li>
                <li><ArrowRight aria-hidden="true" /><span>{copy.hero.action}</span></li>
              </ul>
              <p>{locale === "en" ? "The tag result is digital evidence, not standalone proof of the physical object." : locale === "pt-BR" ? "O resultado da tag é evidência digital, não prova autônoma do objeto físico." : "El resultado de la etiqueta es evidencia digital, no una prueba autónoma del objeto físico."}</p>
            </article>
          </div>
        </div>
      </section>

      <section id="institutional-video" className={`${styles.section} ${styles.videoSection}`} aria-labelledby="clear-video-title">
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>{copy.video.eyebrow}</p>
            <h2 id="clear-video-title">{copy.video.title}</h2>
            <p>{copy.video.body}</p>
          </div>
          <InstitutionalVideoPanel locale={locale} variant="landing" className={styles.videoPanel} initialTheme={initialTheme} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="clear-value-title">
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>{copy.value.eyebrow}</p>
            <h2 id="clear-value-title">{copy.value.title}</h2>
            <p>{copy.value.body}</p>
          </div>
          <ol className={styles.momentGrid}>
            {copy.value.items.map(([title, body], index) => {
              const Icon = momentIcons[index];
              return (
                <li key={title} className={styles.momentItem}>
                  <span className={styles.momentNumber}>0{index + 1}</span>
                  <Icon aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className={`${styles.section} ${styles.softSection}`} aria-labelledby="clear-outcomes-title">
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>{copy.outcomes.eyebrow}</p>
            <h2 id="clear-outcomes-title">{copy.outcomes.title}</h2>
            <p>{copy.outcomes.body}</p>
          </div>
          <div className={styles.outcomeGrid}>
            {copy.outcomes.items.map(([title, body, href], index) => {
              const Icon = outcomeIcons[index];
              return (
                <Link key={title} href={href} className={styles.outcomeCard}>
                  <Icon aria-hidden="true" />
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                  <ArrowRight aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="clear-industries-title">
        <div className={styles.shell}>
          <div className={styles.splitHeading}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>{copy.catalog.industriesEyebrow}</p>
              <h2 id="clear-industries-title">{copy.catalog.industriesTitle}</h2>
              <p>{copy.catalog.industriesBody}</p>
            </div>
            <Link href="/industries" className={styles.textLink}>
              {copy.nav.allIndustries}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.industryGrid}>
            {featuredIndustries.map((industry) => (
              <Link key={industry.slug} href={`/industries/${industry.slug}`} className={styles.industryCard}>
                <div className={styles.industryMedia}>
                  {industry.image ? (
                    <Image src={industry.image} alt="" fill sizes="(max-width: 760px) 92vw, 33vw" />
                  ) : null}
                </div>
                <div className={styles.industryCopy}>
                  <span>{industry.eyebrow}</span>
                  <h3>{industry.title}</h3>
                  <p>{industry.short}</p>
                  <strong>{copy.catalog.open}<ArrowRight aria-hidden="true" /></strong>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.exploreSection}`} aria-labelledby="clear-explore-title">
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>{copy.explore.eyebrow}</p>
            <h2 id="clear-explore-title">{copy.explore.title}</h2>
            <p>{copy.explore.body}</p>
          </div>
          <div className={styles.pathGrid}>
            {copy.explore.paths.map(([title, body, href, cta], index) => {
              const Icon = pathIcons[index];
              return (
                <Link key={title} href={href} className={styles.pathCard}>
                  <Icon aria-hidden="true" />
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <strong>{cta}<ArrowRight aria-hidden="true" /></strong>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.finalSection}`} aria-labelledby="clear-final-title">
        <div className={`${styles.shell} ${styles.finalCard}`}>
          <div>
            <p className={styles.eyebrow}>{copy.finalCta.eyebrow}</p>
            <h2 id="clear-final-title">{copy.finalCta.title}</h2>
            <p>{copy.finalCta.body}</p>
          </div>
          <div className={styles.finalActions}>
            <Link href="/?contact=demo#contact-modal" className={styles.primaryButton}>{copy.finalCta.primary}<ArrowRight aria-hidden="true" /></Link>
            <Link href="/pricing" className={styles.secondaryButton}>{copy.finalCta.secondary}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
