import type { AppLocale } from "@product/config";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  CircleHelp,
  Database,
  FileText,
  Mail,
} from "lucide-react";
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
                <div className={styles.evidenceCardHeader}>
                  <div><span>{copy.evidence.sampleLabel}</span><strong>{copy.evidence.sampleTitle}</strong></div>
                  <b><i />{copy.evidence.sampleStatus}</b>
                </div>

                <div className={styles.evidenceReceipt}>
                  {copy.evidence.items.map((item, index) => (
                    <article key={item.label} data-kind={index === 2 ? "limit" : index === 1 ? "declared" : "observed"}>
                      <span className={styles.evidenceIcon} aria-hidden="true">
                        {index === 0 ? <BadgeCheck size={21} /> : index === 1 ? <Database size={21} /> : <CircleHelp size={21} />}
                      </span>
                      <div>
                        <small>{item.label}</small>
                        <h3>{item.title}</h3>
                        <p>{item.body}</p>
                      </div>
                      <em>{index === 2 ? copy.evidence.limitLabel : copy.evidence.sourceLabel}</em>
                    </article>
                  ))}
                </div>

                <div className={styles.evidenceCardFooter}>
                  <FileText aria-hidden="true" size={17} />
                  <span>{copy.video.boundary}</span>
                  <Link href="/proof/verify">{copy.evidence.publicProof}<ArrowUpRight aria-hidden="true" size={15} /></Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.footerCtaSection} aria-labelledby="footer-cta-title">
          <div className={`${styles.shell} ${styles.footerCta}`}>
            <div>
              <p className={styles.eyebrow}>{copy.footer.eyebrow}</p>
              <h2 id="footer-cta-title">{copy.footer.title}</h2>
            </div>
            <div>
              <p>{copy.footer.ctaBody}</p>
              <div className={styles.footerCtaActions}>
                <Link className={styles.primaryButton} href="/?contact=sales&intent=company_rollout#contact-modal">{copy.footer.primary}</Link>
                <Link className={styles.secondaryButton} href="/demo-lab">{copy.footer.secondary}</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>
                <Image src="/nexid-mark.svg" alt="" width={48} height={48} />
                <span>nex<i>ID</i></span>
              </div>
              <p>{copy.footer.body}</p>
              <strong>{copy.footer.solutionBy}</strong>
            </div>

            <div className={styles.footerNavigation}>
              <nav aria-label={copy.footer.platformLabel}>
                <strong>{copy.footer.platformLabel}</strong>
                <a href="#how-it-works">{copy.footer.howItWorks}</a>
                <a href="#solutions">{copy.footer.solutions}</a>
                <Link href="/pricing">{copy.footer.pricing}</Link>
              </nav>
              <nav aria-label={copy.footer.exploreLabel}>
                <strong>{copy.footer.exploreLabel}</strong>
                <Link href="/demo-lab">{copy.footer.demo}</Link>
                <Link href="/proof/verify">{copy.footer.proof}</Link>
                <Link href="/audiences">{copy.footer.audience}</Link>
              </nav>
              <nav aria-label={copy.footer.integrationLabel}>
                <strong>{copy.footer.integrationLabel}</strong>
                <Link href="/sdk">{copy.footer.developers}</Link>
                <Link href="/docs">{copy.footer.documentation}</Link>
                <Link href="/stack">{copy.footer.technology}</Link>
              </nav>
              <nav aria-label={copy.footer.contactLabel}>
                <strong>{copy.footer.contactLabel}</strong>
                <Link href="/?contact=sales&intent=company_rollout#contact-modal">{copy.footer.contact}</Link>
                <a href="mailto:info@nexid.lat"><Mail aria-hidden="true" size={14} />info@nexid.lat</a>
              </nav>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p>© 2026 {copy.footer.rights}</p>
            <div>
              <a href={AFIP_DATA_FISCAL_URL} target="_blank" rel="noreferrer">{copy.footer.fiscal}</a>
              <a href={MIPYME_CERTIFICATE_URL} download="certificado-mipyme-inmovar-latam.pdf">{copy.footer.certificate}</a>
              <a href="mailto:info@nexid.lat">info@nexid.lat</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
