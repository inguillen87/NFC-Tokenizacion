import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { BrandLockup, type Theme } from "@product/ui";
import { productUrls, schedulingUrls, withPath, type AppLocale } from "@product/config";
import { CommercialContactModal } from "../commercial-contact-modal";
import { ClearNavigation } from "./clear-navigation";
import { getMarketingCopy, getMarketingNav } from "./marketing-clear.content";
import styles from "./marketing-clear.module.css";

const afipDataFiscalHref = "https://qr.afip.gob.ar/?qr=-F2blnmFe6pmSP-chYnylQ,,";
const mipymeCertificateHref = "/certificados/certificado-mipyme-intellitech.pdf";

type ClearSiteFrameProps = {
  locale: AppLocale;
  locales: readonly AppLocale[];
  initialTheme: Theme;
  children: ReactNode;
};

export function ClearSiteFrame({ locale, locales, initialTheme, children }: ClearSiteFrameProps) {
  const copy = getMarketingCopy(locale);
  const groups = getMarketingNav(locale);
  const loginHref = withPath(productUrls.app, "/login");
  const year = new Date().getFullYear();

  return (
    <div className={styles.siteRoot}>
      <a href="#main-content" className={styles.skipLink}>{copy.skip}</a>
      <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label="nexID home" className={styles.brandLink}>
            <BrandLockup size={34} variant="static" theme="light" className={styles.brandLockup} />
          </Link>
          <ClearNavigation
            groups={groups}
            locale={locale}
            locales={locales}
            initialTheme={initialTheme}
            pricingLabel={copy.nav.pricing}
            loginLabel={copy.nav.login}
            demoLabel={copy.nav.demo}
            menuLabel={copy.nav.menu}
            closeLabel={copy.nav.close}
            loginHref={loginHref}
          />
        </div>
      </header>

      <main id="main-content" data-marketing-main className={styles.siteMain}>
        {children}
      </main>

      <footer data-marketing-footer className={styles.siteFooter}>
        <div className={styles.footerInner}>
          <div className={styles.footerLead}>
            <Link href="/" aria-label="nexID home">
              <BrandLockup size={30} variant="static" theme="light" />
            </Link>
            <p>{copy.footer.statement}</p>
          </div>

          <div className={styles.footerColumn}>
            <strong>{copy.footer.product}</strong>
            <Link href="/solutions">{copy.nav.solutions[0]}</Link>
            <Link href="/industries">{copy.nav.industries[0]}</Link>
            <Link href="/pricing">{copy.nav.pricing}</Link>
            <Link href="/demo-lab">Demo Lab</Link>
          </div>

          <div className={styles.footerColumn}>
            <strong>{copy.footer.technical}</strong>
            <Link href="/docs">Docs</Link>
            <Link href="/sdk">SDK & API</Link>
            <Link href="/proof/verify">Proof Verify</Link>
            <Link href="/sun">SUN</Link>
          </div>

          <div className={styles.footerColumn}>
            <strong>{copy.footer.company}</strong>
            <Link href="/resellers">Resellers</Link>
            <Link href="/investor-snapshot">Investor</Link>
            <a href={afipDataFiscalHref} target="_blank" rel="noreferrer">{copy.footer.fiscal}</a>
            <a href={mipymeCertificateHref} download>{copy.footer.mipyme}</a>
          </div>

          <div className={styles.footerColumn}>
            <strong>{copy.footer.contact}</strong>
            <a href="mailto:info@nexid.lat">info@nexid.lat</a>
            <a href="https://api.whatsapp.com/send?phone=5492613168608" target="_blank" rel="noreferrer">WhatsApp AR</a>
            <a href="https://api.whatsapp.com/send?phone=56988689095" target="_blank" rel="noreferrer">WhatsApp CL</a>
            <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer">{locale === "en" ? "Schedule meeting" : locale === "pt-BR" ? "Agendar reunião" : "Agendar reunión"}</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {year} {copy.footer.rights}</span>
          <span>{locale === "en" ? "Evidence with identified sources." : locale === "pt-BR" ? "Evidência com fontes identificadas." : "Evidencia con fuentes identificadas."}</span>
        </div>
      </footer>

      <Suspense fallback={null}>
        <CommercialContactModal initialLocale={locale} />
      </Suspense>
    </div>
  );
}
