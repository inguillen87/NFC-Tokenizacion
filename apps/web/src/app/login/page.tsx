import Link from "next/link";
import { cookies } from "next/headers";
import { productUrls } from "@product/config";
import { normalizeSafeReturnPath } from "@product/config/safe-return-path";
import { Card, ThemeToggle } from "@product/ui";
import { THEME_PREFERENCE_VERSION_COOKIE, resolveThemePreference } from "@product/ui/theme-preference";
import { ArrowRight, Building2, Fingerprint, ShieldCheck } from "lucide-react";
import { BackLink } from "../../components/back-link";
import { BrandHomeLink } from "../../components/brand-home-link";
import { getWebI18n } from "../../lib/locale";
import { ConsumerLoginPanel } from "./consumer-login-panel";
import styles from "./consumer-login.module.css";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WebLoginPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await getWebI18n();
  const params = (await searchParams) || {};
  const requestedNext = firstParam(params.next);
  const nextPath = normalizeSafeReturnPath(requestedNext, "/me");
  const hasMagicToken = Boolean(firstParam(params.t) || firstParam(params.token));
  const isTapReturn = nextPath.includes("fromTap=1") || nextPath.includes("eventId=");
  const hasConsumerDestination = typeof requestedNext === "string" && (nextPath === "/me" || nextPath.startsWith("/me/") || nextPath.startsWith("/me?"));
  const isConsumerAccess = isTapReturn || hasMagicToken || hasConsumerDestination || firstParam(params.consumer) === "1";
  const consumerLoginHref = `/login?consumer=1&next=${encodeURIComponent(nextPath)}`;
  const cookieStore = await cookies();
  const initialTheme = resolveThemePreference(
    cookieStore.get("theme")?.value,
    cookieStore.get(THEME_PREFERENCE_VERSION_COOKIE)?.value,
  );

  return (
    <main className="auth-surface web-auth-surface relative min-h-screen overflow-hidden bg-slate-950">
      <div className="web-auth-backdrop pointer-events-none absolute inset-0" />
      <div className={`relative z-10 mx-auto flex min-h-screen w-full max-w-[980px] flex-col gap-4 px-3 sm:px-6 ${isConsumerAccess ? styles.consumerShell : "justify-center py-8"}`}>
        <div className="flex items-center justify-between gap-3">
          <BackLink prefetch={false} />
          <div className="web-auth-theme-control flex items-center gap-2">
            <span className="hidden text-xs font-semibold text-slate-400 sm:inline">Apariencia</span>
            <ThemeToggle initialTheme={initialTheme} locale={locale} />
          </div>
        </div>

        <Card className="auth-card web-auth-card w-full border border-white/10 bg-slate-900/70 p-4 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
              <BrandHomeLink locale={locale} markOnly size={34} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Acceso nexID</p>
                <p className="text-sm font-black text-white">{isConsumerAccess ? "Mi cuenta" : "Elegí tu espacio"}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {isConsumerAccess ? "Protegido" : "Acceso protegido"}
            </span>
          </div>

          {isConsumerAccess ? (
            <div className={styles.consumerLayout}>
              <section aria-labelledby="consumer-login-title">
                <h1 id="consumer-login-title" className={`brand-editorial-gradient font-black text-white ${styles.consumerTitle}`}>
                  {isTapReturn ? "Continuá tu recorrido" : "Entrá a tu cuenta"}
                </h1>
                <p className={styles.consumerSummary}>
                  {isTapReturn ? "Confirmá tu acceso para seguir donde estabas." : "Consultá tus productos y los servicios que habilita cada marca."}
                </p>
                <ConsumerLoginPanel nextPath={nextPath} />
              </section>

              <aside className={`auth-info-panel rounded-2xl border border-white/10 bg-slate-900/55 ${styles.consumerDetails}`}>
                <details>
                  <summary>¿Qué puedo consultar?</summary>
                  <ul className="grid gap-3 text-sm leading-5 text-slate-300">
                    <li>La historia y el pasaporte digital de tus productos.</li>
                    <li>Garantías, beneficios o contacto cuando la marca los habilita.</li>
                    <li>Las condiciones de la marca para cada servicio.</li>
                  </ul>
                </details>
                <Link href="/login" prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-cyan-200 hover:text-cyan-100">
                  Cambiar tipo de acceso <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </aside>
            </div>
          ) : (
            <section className="mt-7" aria-labelledby="access-choice-title">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Dos portales, una identidad clara</p>
              <h1 id="access-choice-title" className="brand-editorial-gradient mt-3 max-w-3xl text-3xl font-black leading-tight text-white sm:text-4xl">
                ¿Dónde querés entrar?
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Elegí tu Pasaporte para consultar un producto, o el centro de control para trabajar con tu equipo.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <a
                  href={`${productUrls.app}/login`}
                  className="web-auth-choice group rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-5 transition hover:-translate-y-0.5 hover:border-cyan-200/60"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Empresas y equipos</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Centro de control</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Administrá los productos, etiquetas y permisos de tu empresa.</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-cyan-100">
                    Entrar al panel empresa <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </a>

                <Link
                  href={consumerLoginHref}
                  prefetch={false}
                  className="web-auth-choice group rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-5 transition hover:-translate-y-0.5 hover:border-emerald-200/60"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
                    <Fingerprint className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Personas y consumidores</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Mi Pasaporte nexID</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Abrí productos guardados, garantías y beneficios con código por email o teléfono.</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-100">
                    Entrar a mi pasaporte <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <Link href="/register" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-200">Crear cuenta</Link>
                <Link href="/docs" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-200">Ver documentación</Link>
                <Link href="/?contact=demo#contact-modal" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-cyan-100">Solicitar demo</Link>
              </div>
            </section>
          )}
        </Card>
      </div>
    </main>
  );
}
