import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLockup, Card } from "@product/ui";
import { ArrowRight, Layers3, MapPinned, ScanLine } from "lucide-react";
import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";
import { getPublicAccessProfiles } from "../../lib/access-profiles";
import { LoginFormPanel } from "../../components/login-form-panel";
import { getDashboardSession, isDashboardSessionUpstreamUnavailable } from "../../lib/session";
import { dashboardDemoAccessAllowedForRole } from "../../lib/dashboard-access-flags";
import { isClerkConfiguredForRuntime } from "../../lib/clerk-env";
import { AuthThemeControl } from "../../components/auth-theme-control";
import { dashboardAuthPath, normalizeDashboardReturnPath } from "../../lib/dashboard-return-path";
import styles from "../../components/login-entry.module.css";
import { ReleaseNotesLink } from "../../components/release-notes-link";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function authNoticeForCode(code?: string) {
  switch (code) {
    case "clerk_not_configured":
      return "Google/Clerk no esta configurado con claves live para este deploy.";
    case "clerk_email_unverified":
      return "Clerk no devolvio un email verificado. Verifica el email en Google/Clerk y reintenta.";
    case "clerk_session_token_missing":
      return "Clerk no entrego una sesion verificable. Cerra la sesion de Google/Clerk y volve a ingresar.";
    case "clerk_session_invalid":
      return "La API rechazo la sesion Clerk. Revisa issuer, claves y dominios autorizados de Clerk.";
    case "clerk_authorized_party_invalid":
      return "La sesion Google es valida, pero la API no reconoce app.nexid.lat como origen autorizado. La configuracion del entorno debe corregirse antes de reintentar.";
    case "clerk_session_expired":
      return "La sesion Google/Clerk vencio. Volve a iniciar sesion para obtener una credencial nueva.";
    case "clerk_google_required":
      return "El acceso Super Admin exige una cuenta Google verificada. Reinicia el ingreso y elegi el Google fundador autorizado.";
    case "clerk_verification_unavailable":
      return "Clerk no pudo verificar la sesion por una falla de claves o JWKS en la API. El acceso permanece cerrado hasta recuperar la verificacion.";
    case "clerk_verification_not_configured":
    case "clerk_authorized_parties_not_configured":
      return "La verificacion Clerk de la API no esta configurada para este dominio.";
    case "clerk_super_admin_allowlist_not_configured":
      return "El acceso global permanece cerrado: falta configurar la allowlist server-side de Super Admin.";
    case "auth_upstream_unavailable":
      return "La API de autenticación no respondió. Reintenta o revisa el deploy de api.nexid.lat.";
    case "auth_upstream_not_configured":
      return "El acceso no está conectado a una API explícita en este entorno. La sesión permanece cerrada.";
    case "session_expired":
      return "Tu sesión venció o dejó de ser válida. Volvé a ingresar para continuar de forma segura.";
    case "clerk_super_admin_not_allowed":
      return "Esa cuenta Google no tiene un perfil interno activo autorizado para este acceso a NexID.";
    case "clerk_sync_failed":
      return "Clerk autenticó, pero nexID no pudo crear la sesión interna.";
    default:
      return "";
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { t, locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const profiles = getPublicAccessProfiles();
  const credentialProfiles = profiles.filter((profile) => profile.role !== "super-admin");
  const bodegaDemoAllowed = dashboardDemoAccessAllowedForRole("tenant-admin");
  const params = searchParams ? await searchParams : {};
  const nextPath = normalizeDashboardReturnPath(firstParam(params.next));
  const loggedOut = firstParam(params.logged_out) === "1";
  const authErrorCode = firstParam(params.auth_error);
  const authErrorNotice = authNoticeForCode(authErrorCode);
  const clerkRecoveryRequired = authErrorCode === "clerk_session_invalid"
    || authErrorCode === "clerk_session_expired"
    || authErrorCode === "clerk_google_required"
    || authErrorCode === "clerk_super_admin_not_allowed";
  const authNotice = authErrorNotice || (loggedOut ? "Sesión cerrada. Podés ingresar con una cuenta tenant real, abrir la demo simulada o usar Google allowlisted." : "");
  let session = null;
  if (!loggedOut && !authErrorNotice) {
    try {
      session = await getDashboardSession();
    } catch (error) {
      if (isDashboardSessionUpstreamUnavailable(error)) redirect(dashboardAuthPath("/session-recovery", nextPath));
      throw error;
    }
  }
  if (session) redirect(nextPath);

  return (
    <main className={`dashboard-auth-surface relative min-h-screen overflow-hidden bg-slate-950 ${styles.page}`}>
      <div className="dashboard-auth-backdrop pointer-events-none absolute inset-0" />
      <div className="dashboard-auth-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <AuthThemeControl locale={locale} />

      <div className="container-shell relative z-10 grid min-h-dvh items-start pb-4 pt-20 sm:pb-6 sm:pt-24 md:place-items-center md:py-10">
        <Card className={`dashboard-auth-card w-full max-w-6xl p-3 sm:p-4 md:p-10 ${styles.pageCard}`}>
          <div className="dashboard-auth-layout grid gap-5 md:grid-cols-[1.08fr_1fr]">
            <section
              aria-labelledby="dashboard-login-title"
              className="dashboard-auth-intro-primary order-1 rounded-2xl border border-white/10 p-4 md:rounded-none md:border-0 md:p-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href="/" aria-label="nexID home" className="inline-flex items-center">
                  <BrandLockup size={64} variant="ripple" theme="dark" className="brand-surface-auth" />
                </Link>
                <Link
                  href="https://nexid.lat"
                  aria-label="Volver al sitio de nexID"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-50 shadow-[0_18px_40px_rgba(6,182,212,0.16)] transition hover:border-cyan-200/70 hover:bg-cyan-400/16"
                >
                  <span className={styles.backLabel}>Volver al sitio</span><ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>

              <p className={styles.introEyebrow}>Centro de control nexID</p>
              <h1 id="dashboard-login-title" className={styles.introTitle}>Tu operación,<br />{" "}en un solo lugar.</h1>
              <p className={styles.introDescription}>Del producto a su actividad. Accedé al espacio de tu empresa para consultar trazabilidad, TAP físicos y relaciones con tus clientes.</p>
            </section>

            <div className="dashboard-auth-panel-column order-2 md:order-2">
              <div className="dashboard-auth-panel rounded-2xl border border-white/10 p-3 sm:p-4">
                <LoginFormPanel
                  emailPlaceholder={t.web.auth.emailPlaceholder}
                  passwordPlaceholder={t.web.auth.passwordPlaceholder}
                  loginAction={copy.auth.loginAction}
                  registerLabel={t.common.register}
                  forgotLabel={t.dashboard.forgotPassword}
                  inviteLabel={copy.auth.inviteTitle}
                  profiles={credentialProfiles}
                  bodegaDemoAllowed={bodegaDemoAllowed}
                  clerkEnabled={isClerkConfiguredForRuntime()}
                  authNotice={authNotice}
                  clerkRecoveryRequired={clerkRecoveryRequired}
                  nextPath={nextPath}
                />
              </div>
            </div>

            <section aria-label="Contexto de acceso" className="dashboard-auth-intro-secondary order-3 rounded-2xl border border-white/10 p-4 md:rounded-none md:border-0 md:p-0">
              <div className={styles.operationOverview}>
                <div><span><ScanLine aria-hidden="true" size={23} /></span><p><strong>Actividad del producto</strong><small>Lecturas y acciones, con su fuente y estado.</small></p></div>
                <div><span><MapPinned aria-hidden="true" size={23} /></span><p><strong>Contexto en el mapa</strong><small>Ubicaciones reportadas y su precisión, sin confundirlas con el origen.</small></p></div>
                <div><span><Layers3 aria-hidden="true" size={23} /></span><p><strong>El espacio de tu empresa</strong><small>Productos, CRM y equipo según tus permisos.</small></p></div>
              </div>
              <ReleaseNotesLink locale={locale} />
               <p className={styles.scopeNote}>Tu cuenta define qué empresa y módulos podés consultar. La demo interactiva es un recorrido separado con datos ilustrativos.</p>
            </section>
          </div>
        </Card>
      </div>
    </main>
  );
}
