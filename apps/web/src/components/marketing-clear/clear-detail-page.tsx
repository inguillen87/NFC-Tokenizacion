import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Info, Layers3 } from "lucide-react";
import type { AppLocale } from "@product/config";
import type { MarketingCatalogEntry } from "./marketing-clear.content";
import { getMarketingCopy } from "./marketing-clear.content";
import styles from "./marketing-clear.module.css";

type ClearDetailPageProps = {
  locale: AppLocale;
  kind: "solutions" | "industries";
  entry: MarketingCatalogEntry;
};

const contactVerticalBySlug: Record<string, string> = {
  "product-identity": "wine",
  traceability: "logistics",
  "digital-passport": "wine",
  "customer-experience": "cosmetics",
  "offline-operations": "agro",
  "wine-spirits": "wine",
  "luxury-beauty": "cosmetics",
  "pharma-health": "pharma",
  "agro-food": "agro",
  logistics: "logistics",
  events: "events",
};

export function ClearDetailPage({ locale, kind, entry }: ClearDetailPageProps) {
  const copy = getMarketingCopy(locale);
  const backLabel = kind === "solutions" ? copy.detail.allSolutions : copy.detail.allIndustries;
  const contactMessage = locale === "en"
    ? `I want to evaluate a pilot for ${entry.title}.`
    : locale === "pt-BR"
      ? `Quero avaliar um piloto para ${entry.title}.`
      : `Quiero evaluar un piloto para ${entry.title}.`;
  const contactParams = new URLSearchParams({
    contact: "demo",
    intent: "company_rollout",
    vertical: contactVerticalBySlug[entry.slug] || "wine",
    message: contactMessage,
  });
  const contactHref = `/?${contactParams.toString()}#contact-modal`;

  return (
    <>
      <section className={`${styles.section} ${styles.detailHero}`}>
        <div className={`${styles.shell} ${styles.detailHeroGrid}`}>
          <div className={styles.detailHeroCopy}>
            <Link href={`/${kind}`} className={styles.backLink}><ArrowLeft aria-hidden="true" />{backLabel}</Link>
            <p className={styles.eyebrow}>{entry.eyebrow}</p>
            <h1>{entry.headline}</h1>
            <p>{entry.intro}</p>
            <div className={styles.detailActions}>
              <Link href={entry.demoHref} className={styles.primaryButton}>{copy.detail.demo}<ArrowRight aria-hidden="true" /></Link>
              <Link href="/docs" className={styles.secondaryButton}>{copy.detail.docs}</Link>
            </div>
          </div>

          <div className={styles.detailVisual}>
            {entry.image ? (
              <Image src={entry.image} alt="" fill priority sizes="(max-width: 860px) 92vw, 42vw" />
            ) : (
              <div className={styles.detailIdentityVisual} aria-hidden="true">
                <span><Layers3 /></span>
                <i />
                <i />
                <i />
              </div>
            )}
            <div className={styles.detailOutcome}>
              <small>{copy.detail.outcome}</small>
              <strong>{entry.outcome}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.softSection}`}>
        <div className={`${styles.shell} ${styles.detailContentGrid}`}>
          <div>
            <p className={styles.eyebrow}>{copy.detail.capabilities}</p>
            <h2>{entry.title}</h2>
          </div>
          <ul className={styles.detailPointList}>
            {entry.points.map((point) => <li key={point}><Check aria-hidden="true" /><span>{point}</span></li>)}
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>{copy.detail.how}</p>
            <h2>{locale === "en" ? "A controlled path from idea to pilot." : locale === "pt-BR" ? "Um caminho controlado da ideia ao piloto." : "Un recorrido controlado desde la idea hasta el piloto."}</h2>
          </div>
          <ol className={styles.detailSteps}>
            {entry.steps.map((step, index) => (
              <li key={step}>
                <span>0{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${styles.section} ${styles.boundarySection}`}>
        <div className={`${styles.narrowShell} ${styles.boundaryCard}`}>
          <Info aria-hidden="true" />
          <div>
            <p className={styles.eyebrow}>{copy.detail.boundary}</p>
            <h2>{locale === "en" ? "Clear evidence starts with clear limits." : locale === "pt-BR" ? "Evidência clara começa com limites claros." : "La evidencia clara empieza por límites claros."}</h2>
            <p>{entry.boundary}</p>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.finalSection}`}>
        <div className={`${styles.shell} ${styles.finalCard}`}>
          <div>
            <p className={styles.eyebrow}>{copy.finalCta.eyebrow}</p>
            <h2>{copy.finalCta.title}</h2>
            <p>{copy.finalCta.body}</p>
          </div>
          <div className={styles.finalActions}>
            <Link href={contactHref} className={styles.primaryButton}>{copy.finalCta.primary}<ArrowRight aria-hidden="true" /></Link>
            <Link href={`/${kind}`} className={styles.secondaryButton}>{backLabel}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
