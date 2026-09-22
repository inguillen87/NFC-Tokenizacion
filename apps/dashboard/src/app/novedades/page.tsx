import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BrandLockup, ThemeToggle } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { DASHBOARD_RELEASE, DASHBOARD_RELEASE_DATE, releaseCopy } from "../../lib/dashboard-release";
import styles from "../../components/release-notes.module.css";

export const metadata: Metadata = { title: "Novedades y versión | nexID", robots: { index: false, follow: false } };

/** Public release notes contain no tenant data and make no API or database calls. */
export default async function ReleaseNotesPage() {
  const { locale } = await getDashboardI18n();
  const copy = releaseCopy(locale);
  return <main className={styles.page} data-testid="dashboard-release-notes">
    <div className={styles.inner}>
      <nav className={styles.topbar} aria-label={copy.link}>
        <Link href="/" prefetch={false} aria-label="nexID"><BrandLockup size={44} theme="dark" className="brand-surface-auth" /></Link>
        <div className={styles.headerActions}><Link href="https://nexid.lat" className={styles.siteLink}><ArrowLeft size={14} aria-hidden="true" style={{ display: "inline", marginRight: 7 }} />{copy.site}</Link><ThemeToggle locale={locale} /></div>
      </nav>
      <div className={styles.hero}>
        <div><p className={styles.eyebrow}>{copy.eyebrow}</p><h1 className={styles.title}>{copy.title}</h1><p className={styles.description}>{copy.summary}</p></div>
        <aside className={styles.version} aria-label={copy.label}>
          <span>{copy.label}</span><code data-testid="dashboard-release-id">{DASHBOARD_RELEASE}</code>
          <time dateTime={DASHBOARD_RELEASE_DATE}>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${DASHBOARD_RELEASE_DATE}T12:00:00Z`))}</time>
        </aside>
      </div>
      <section aria-labelledby="release-changes"><h2 id="release-changes" className={styles.heading}>{copy.changes}</h2>
        <div className={styles.grid}>{copy.cards.map((card, index) => <article key={index} className={styles.card}>
          <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span className={styles.tag}>{card.tag}</span><h3>{card.title}</h3><p>{card.text}</p>
        </article>)}</div>
      </section>
      <section className={styles.guide} aria-labelledby="release-guide"><h2 id="release-guide" className={styles.heading}>{copy.guide}</h2>
        <ol className={styles.steps}>{copy.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <Link href="/leads-tickets" prefetch={false} className={styles.cta}>{copy.back}<ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
      <p className={styles.boundary}>{copy.boundary}</p>
    </div>
  </main>;
}
