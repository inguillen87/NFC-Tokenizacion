import type { AppLocale } from "@product/config";
import Image from "next/image";
import Link from "next/link";
import { NexidNavigationV4 } from "./nexid-navigation-v4";
import { HOME_V4_COPY } from "./home-copy";
import styles from "./nexid-home-v4.module.css";

const AFIP_DATA_FISCAL_URL = "https://qr.afip.gob.ar/?qr=-F2blnmFe6pmSP-chYnylQ,,";
const MIPYME_CERTIFICATE_URL = "/certificados/certificado-mipyme-intellitech.pdf";

type NexidHomeV4Props = {
  locale: AppLocale;
  locales: readonly AppLocale[];
  loginHref: string;
  initialTheme: "light" | "dark";
};

export function NexidHomeV4({ locale, locales, loginHref, initialTheme }: NexidHomeV4Props) {
  const copy = HOME_V4_COPY[locale];

  return (
    <div className={styles.root} data-nexid-home="v4">
      <a className={styles.skipLink} href="#main-content">
        {copy.a11y.skipToContent}
      </a>

      <NexidNavigationV4 locale={locale} locales={locales} loginHref={loginHref} initialTheme={initialTheme} />

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="home-v4-title">
          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>{copy.hero.eyebrow}</p>
                <h1 id="home-v4-title">{copy.hero.title}</h1>
                <p className={styles.heroBody}>{copy.hero.body}</p>

                <div className={styles.heroActions}>
                  <a className={styles.primaryButton} href="#how-it-works">
                    {copy.hero.primary}
                  </a>
                  <Link className={styles.secondaryButton} href="/?contact=sales&intent=company_rollout#contact-modal">
                    {copy.hero.secondary}
                  </Link>
                </div>

                <a className={styles.textLink} href="#evidence">
                  {copy.hero.evidence}
                  <span aria-hidden="true">↓</span>
                </a>
              </div>

              <figure className={styles.heroVisual}>
                <div className={styles.heroImage}>
                  <Image
                    src="/demo/wine-secure/real-malbec-bottle-pexels.jpg"
                    alt={copy.caseStudy.imageAlt}
                    fill
                    priority
                    loading="eager"
                    sizes="(max-width: 900px) 100vw, 48vw"
                  />
                </div>
                <figcaption className={styles.resultCard}>
                  <p>{copy.hero.visualKicker}</p>
                  <strong>{copy.hero.visualTitle}</strong>
                  <div className={styles.statusLine}>
                    <span aria-hidden="true" />
                    {copy.hero.visualStatus}
                  </div>
                  <dl>
                    <div>
                      <dt>{copy.hero.visualOrigin}</dt>
                      <dd>{copy.hero.visualOriginValue}</dd>
                    </div>
                  </dl>
                  <small>{copy.hero.visualBoundary}</small>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section id="how-it-works" className={styles.flow} aria-labelledby="flow-title">
          <div className={styles.shell}>
            <div className={styles.sectionIntro}>
              <p className={styles.eyebrow}>{copy.flow.eyebrow}</p>
              <h2 id="flow-title">{copy.flow.title}</h2>
              <p>{copy.flow.body}</p>
            </div>

            <ol className={styles.flowList}>
              {copy.flow.steps.map((step) => (
                <li key={step.number}>
                  <span className={styles.stepNumber}>{step.number}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <a className={styles.textLink} href="#evidence">
              {copy.flow.detail}
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>

        <section id="solutions" className={styles.roles} aria-labelledby="roles-title">
          <div className={styles.shell}>
            <div className={styles.sectionIntro}>
              <p className={styles.eyebrow}>{copy.roles.eyebrow}</p>
              <h2 id="roles-title">{copy.roles.title}</h2>
              <p>{copy.roles.body}</p>
            </div>

            <div className={styles.roleGrid}>
              {copy.roles.items.map((item) => (
                <article key={item.role}>
                  <p className={styles.roleLabel}>{item.role}</p>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <strong>{item.outcome}</strong>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className={styles.caseStudy} aria-labelledby="case-title">
          <div className={styles.shell}>
            <div className={styles.caseGrid}>
              <div className={styles.caseCopy}>
                <p className={styles.eyebrow}>{copy.caseStudy.eyebrow}</p>
                <h2 id="case-title">{copy.caseStudy.title}</h2>
                <p>{copy.caseStudy.body}</p>
                <span className={styles.demoLabel}>{copy.caseStudy.demoLabel}</span>

                <div className={styles.caseImage}>
                  <Image
                    src="/demo/wine-secure/real-malbec-bottle-pexels.jpg"
                    alt=""
                    fill
                    sizes="(max-width: 900px) 100vw, 42vw"
                  />
                </div>
              </div>

              <div className={styles.phoneStage} aria-label={copy.caseStudy.demoLabel}>
                <div className={styles.phone}>
                  <div className={styles.phoneTop} aria-hidden="true" />
                  <p className={styles.screenKicker}>{copy.caseStudy.screenKicker}</p>
                  <h3>{copy.caseStudy.screenTitle}</h3>

                  <div className={styles.acceptedState}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>{copy.caseStudy.accepted}</strong>
                      <p>{copy.caseStudy.acceptedNote}</p>
                    </div>
                  </div>

                  <dl className={styles.screenDetails}>
                    <div>
                      <dt>{copy.caseStudy.declaredLabel}</dt>
                      <dd>{copy.caseStudy.declaredValue}</dd>
                    </div>
                    <div>
                      <dt>{copy.caseStudy.nextLabel}</dt>
                      <dd>{copy.caseStudy.nextValue}</dd>
                    </div>
                  </dl>

                  <Link className={styles.primaryButton} href="/demo-lab">
                    {copy.caseStudy.cta}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="evidence" className={styles.evidence} aria-labelledby="evidence-title">
          <div className={styles.shell}>
            <div className={styles.evidenceGrid}>
              <div className={styles.evidenceCopy}>
                <p className={styles.eyebrow}>{copy.evidence.eyebrow}</p>
                <h2 id="evidence-title">{copy.evidence.title}</h2>
                <p>{copy.evidence.body}</p>
              </div>

              <div className={styles.evidenceList}>
                {copy.evidence.items.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className={styles.evidenceActions}>
              <Link className={styles.secondaryButton} href="/proof/verify">
                {copy.evidence.publicProof}
              </Link>
              <Link className={styles.primaryButton} href="/?contact=sales&intent=company_rollout#contact-modal">
                {copy.evidence.pilot}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footerTop}>
            <div>
              <Image src="/nexid-lockup-horizontal.svg" alt="nexID" width={154} height={38} />
              <p>{copy.footer.body}</p>
            </div>
            <nav aria-label={copy.a11y.footerNavigation}>
              <a href="#product">{copy.footer.product}</a>
              <Link href="/demo-lab">{copy.footer.demo}</Link>
              <Link href="/proof/verify">{copy.footer.proof}</Link>
              <Link href="/sdk">{copy.footer.developers}</Link>
              <Link href="/pricing">{copy.footer.pricing}</Link>
            </nav>
          </div>

          <div className={styles.footerBottom}>
            <p>© 2026 {copy.footer.rights}</p>
            <div>
              <a href={AFIP_DATA_FISCAL_URL} target="_blank" rel="noreferrer">{copy.footer.fiscal}</a>
              <a href={MIPYME_CERTIFICATE_URL} download>{copy.footer.certificate}</a>
              <a href="mailto:info@nexid.lat">info@nexid.lat</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
