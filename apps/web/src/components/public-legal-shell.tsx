import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, ArrowUpRight, Mail } from "lucide-react";
import { ThemeToggle } from "@product/ui";
import { resolveThemePreference, THEME_PREFERENCE_VERSION_COOKIE } from "@product/ui/theme-preference";
import { BrandHomeLink } from "./brand-home-link";
import styles from "./public-legal-shell.module.css";

export const privacyContactEmail = "info@nexid.lat";
export const privacyContactHref = `mailto:${privacyContactEmail}?subject=${encodeURIComponent("Consulta de privacidad NexID")}`;
export const deletionContactHref = `mailto:${privacyContactEmail}?subject=${encodeURIComponent("Solicitud de eliminación de datos NexID")}`;

type LegalSection = { id: string; title: string; content: ReactNode };

export async function PublicLegalShell({ title, description, page, sections, children }: {
  title: string;
  description: string;
  page: "privacy" | "data-deletion";
  sections: LegalSection[];
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const initialTheme = resolveThemePreference(
    cookieStore.get("theme")?.value,
    cookieStore.get(THEME_PREFERENCE_VERSION_COOKIE)?.value,
  );

  return (
    <div className={styles.page} data-public-legal lang="es-AR">
      <a className={styles.skipLink} href="#legal-content">Ir al contenido</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <BrandHomeLink locale="es-AR" size={46} theme={initialTheme} className={styles.brand} />
          <div className={styles.themeControl}><ThemeToggle locale="es-AR" initialTheme={initialTheme} /></div>
        </div>
      </header>
      <main id="legal-content" tabIndex={-1} className={styles.main}>
        <Link href="/" className={styles.backLink}><ArrowLeft aria-hidden="true" size={16} />Volver a NexID</Link>
        <div className={styles.hero}>
          <p className={styles.eyebrow}>Tus datos, con claridad</p>
          <h1>{title}</h1>
          <p className={styles.lead}>{description}</p>
          <p className={styles.updated}>Actualizado el <time dateTime="2026-10-09">9 de octubre de 2026</time></p>
        </div>
        <nav className={styles.documentNav} aria-label="Documentos de privacidad">
          <Link href="/privacy" aria-current={page === "privacy" ? "page" : undefined}>Privacidad</Link>
          <Link href="/data-deletion" aria-current={page === "data-deletion" ? "page" : undefined}>Eliminar mis datos</Link>
        </nav>
        <div className={styles.quickSummary}>{children}</div>
        <div className={styles.bodyLayout}>
          <nav className={styles.contents} aria-label="En esta página">
            <p>En esta página</p>
            <ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
          </nav>
          <article className={styles.article}>
            {sections.map((section) => (
              <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-title`}>
                <h2 id={`${section.id}-title`}>{section.title}</h2>
                {section.content}
              </section>
            ))}
          </article>
        </div>
        <aside className={styles.contact} aria-labelledby="legal-contact-title">
          <Mail aria-hidden="true" size={24} />
          <div><h2 id="legal-contact-title">¿Querés consultar sobre tus datos?</h2><p>El contacto público de NexID es <a href={privacyContactHref}>{privacyContactEmail}</a>. No envíes contraseñas ni códigos de acceso.</p></div>
          <a className={styles.contactAction} href={page === "data-deletion" ? deletionContactHref : privacyContactHref}>Escribir a NexID<ArrowUpRight aria-hidden="true" size={18} /></a>
        </aside>
      </main>
      <footer className={styles.footer}>
        <p>NexID · Marca comercial operada por GUILLEN MARCELO ARIEL.</p>
        <nav aria-label="Más información"><Link href="/about">Quiénes somos</Link><Link href="/privacy">Privacidad</Link><Link href="/data-deletion">Eliminar mis datos</Link></nav>
      </footer>
    </div>
  );
}
