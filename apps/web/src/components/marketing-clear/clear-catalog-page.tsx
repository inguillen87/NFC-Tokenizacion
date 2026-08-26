import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Boxes, CircleCheck, Compass, Fingerprint, RadioTower, Route, ShieldCheck } from "lucide-react";
import type { AppLocale } from "@product/config";
import type { MarketingCatalogEntry } from "./marketing-clear.content";
import { getMarketingCopy } from "./marketing-clear.content";
import styles from "./marketing-clear.module.css";

const catalogIcons = [Fingerprint, Route, Boxes, CircleCheck, RadioTower, ShieldCheck, Compass] as const;

type ClearCatalogPageProps = {
  locale: AppLocale;
  kind: "solutions" | "industries";
  entries: MarketingCatalogEntry[];
};

export function ClearCatalogPage({ locale, kind, entries }: ClearCatalogPageProps) {
  const copy = getMarketingCopy(locale);
  const isSolutions = kind === "solutions";
  const eyebrow = isSolutions ? copy.catalog.solutionsEyebrow : copy.catalog.industriesEyebrow;
  const title = isSolutions ? copy.catalog.solutionsTitle : copy.catalog.industriesTitle;
  const body = isSolutions ? copy.catalog.solutionsBody : copy.catalog.industriesBody;

  return (
    <>
      <section className={`${styles.section} ${styles.catalogHero}`}>
        <div className={styles.narrowShell}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p>{body}</p>
        </div>
      </section>

      <section className={`${styles.section} ${styles.catalogSection}`} aria-label={eyebrow}>
        <div className={`${styles.shell} ${styles.catalogGrid}`}>
          {entries.map((entry, index) => {
            const Icon = catalogIcons[index % catalogIcons.length];
            return (
              <Link key={entry.slug} href={`/${kind}/${entry.slug}`} className={styles.catalogCard}>
                {entry.image ? (
                  <div className={styles.catalogCardMedia}>
                    <Image src={entry.image} alt="" fill sizes="(max-width: 760px) 92vw, 42vw" />
                  </div>
                ) : (
                  <span className={styles.catalogIcon}><Icon aria-hidden="true" /></span>
                )}
                <div className={styles.catalogCardCopy}>
                  <span>{entry.eyebrow}</span>
                  <h2>{entry.title}</h2>
                  <p>{entry.short}</p>
                  <strong>{copy.catalog.open}<ArrowRight aria-hidden="true" /></strong>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={`${styles.section} ${styles.catalogCtaSection}`}>
        <div className={`${styles.shell} ${styles.catalogCta}`}>
          <div>
            <p className={styles.eyebrow}>{copy.finalCta.eyebrow}</p>
            <h2>{copy.finalCta.title}</h2>
            <p>{copy.finalCta.body}</p>
          </div>
          <Link href="/?contact=demo#contact-modal" className={styles.primaryButton}>{copy.finalCta.primary}<ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
