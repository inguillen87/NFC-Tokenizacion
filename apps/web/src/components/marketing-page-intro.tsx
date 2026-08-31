import Link from "next/link";
import styles from "./marketing-page-intro.module.css";

type MarketingPageIntroResult = {
  title: string;
  detail?: string;
};

type MarketingPageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  microResults?: readonly MarketingPageIntroResult[];
  cta?: {
    label: string;
    href: string;
  };
};

export function MarketingPageIntro({
  eyebrow,
  title,
  description,
  microResults = [],
  cta,
}: MarketingPageIntroProps) {
  return (
    <header className={`${styles.root} ${microResults.length ? "" : styles.rootSolo}`}>
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.copy}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>

        {cta ? (
          <Link className={styles.cta} href={cta.href}>
            {cta.label}
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>

      {microResults.length ? (
        <ol className={styles.results} aria-label={eyebrow}>
          {microResults.slice(0, 3).map((result, index) => (
            <li className={styles.result} key={`${result.title}-${index}`}>
              <span className={styles.resultNumber} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong>{result.title}</strong>
              {result.detail ? <p>{result.detail}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </header>
  );
}
