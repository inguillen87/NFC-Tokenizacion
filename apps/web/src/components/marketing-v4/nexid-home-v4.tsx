import type { AppLocale } from "@product/config";
import Image from "next/image";
import Link from "next/link";
import {
  NexidHeroExperience,
  NexidProcessExperience,
  NexidRoleExperience,
} from "./nexid-home-experience";
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

                <div className={styles.heroCapabilities} aria-label={copy.hero.capabilitiesLabel}>
                  <span>{copy.hero.capabilitiesLabel}</span>
                  <ul>
                    {copy.hero.capabilities.map((capability) => <li key={capability}>{capability}</li>)}
                  </ul>
                </div>
              </div>

              <NexidHeroExperience
                sectors={copy.hero.sectors}
                sectorsLabel={copy.hero.sectorsLabel}
                rotationLabel={copy.hero.rotationLabel}
                pauseRotation={copy.hero.pauseRotation}
                resumeRotation={copy.hero.resumeRotation}
                demoLabel={copy.video.openDemo}
              />
            </div>
          </div>
        </section>

        <NexidProcessExperience
          flow={copy.flow}
          controls={copy.video}
        />

        <NexidRoleExperience copy={copy.roles} />

        <section id="evidence" className={styles.evidence} aria-labelledby="evidence-title">
          <div className={styles.shell}>
            <div className={styles.evidenceLayout}>
              <div className={styles.evidenceIntro}>
                <p className={styles.eyebrow}>{copy.evidence.eyebrow}</p>
                <h2 id="evidence-title">{copy.evidence.title}</h2>
                <p>{copy.evidence.body}</p>
                <div className={styles.evidenceActions}>
                  <Link className={styles.secondaryButton} href="/proof/verify">
                    {copy.evidence.publicProof}
                  </Link>
                  <Link className={styles.primaryButton} href="/?contact=sales&intent=company_rollout#contact-modal">
                    {copy.evidence.pilot}
                  </Link>
                </div>
              </div>

              <div className={styles.evidenceLedger}>
                {copy.evidence.items.map((item) => (
                  <article key={item.label}>
                    <div>
                      <small>{item.label}</small>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </div>
                  </article>
                ))}
              </div>
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
              <a href="#solutions">{copy.footer.product}</a>
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
