import Link from "next/link";
import { BrandLockup } from "@product/ui";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { ClerkGoogleSuperAdminButton } from "../../../components/clerk-google-super-admin-button";
import { dashboardDemoAccessAllowedForRole } from "../../../lib/dashboard-access-flags";
import { isClerkConfiguredForRuntime } from "../../../lib/clerk-env";
import { getDashboardI18n } from "../../../lib/locale";
import { AuthThemeControl } from "../../../components/auth-theme-control";
import { normalizeDashboardReturnPath } from "../../../lib/dashboard-return-path";

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const bodegaDemoAllowed = dashboardDemoAccessAllowedForRole("tenant-admin");
  const clerkEnabled = isClerkConfiguredForRuntime();
  const { locale } = await getDashboardI18n();
  const params = searchParams ? await searchParams : {};
  const rawNextPath = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = normalizeDashboardReturnPath(rawNextPath);
  const loginPath = `/login?next=${encodeURIComponent(nextPath)}`;
  const reauth = (Array.isArray(params.reauth) ? params.reauth[0] : params.reauth) === "1";

  return (
    <main data-testid="sign-in-superadmin-page" className="dashboard-auth-surface relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="dashboard-auth-backdrop pointer-events-none absolute inset-0" />
      <div className="dashboard-auth-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <AuthThemeControl locale={locale} />
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-5 pb-10 pt-24 lg:grid-cols-[1fr_440px] lg:py-10">
        <section className="dashboard-auth-story">
          <Link href={loginPath} aria-label="Volver a nexID CRM" className="inline-flex items-center">
            <BrandLockup size={72} variant="ripple" theme="dark" />
          </Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Super Admin fundador</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight md:text-6xl">
            Google verifica identidad. nexID decide el acceso.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            El correo fundador entra por Google/Clerk y después pasa por la allowlist de nexID. Tenants, empleados y
            demos comerciales siguen separados para no mezclar operaciones enterprise con el portal consumidor.
          </p>
          <div data-testid="sign-in-auth-status" className="mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
            <div data-state={clerkEnabled ? "ready" : "attention"} className={`dashboard-auth-status-card rounded-2xl border p-4 ${clerkEnabled ? "border-emerald-300/20 bg-emerald-400/10" : "border-amber-300/25 bg-amber-400/10"}`}>
              <div className="flex items-center gap-2">
                {clerkEnabled ? <CheckCircle2 className="h-4 w-4 text-emerald-200" /> : <CircleAlert className="h-4 w-4 text-amber-200" />}
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Google/Clerk</p>
              </div>
              <p className="mt-2 text-sm font-black text-white">{clerkEnabled ? "OAuth live en este deploy" : "OAuth pendiente de env live"}</p>
            </div>
            <div data-state={bodegaDemoAllowed ? "ready" : "attention"} className={`dashboard-auth-status-card rounded-2xl border p-4 ${bodegaDemoAllowed ? "border-cyan-300/20 bg-cyan-400/10" : "border-amber-300/25 bg-amber-400/10"}`}>
              <div className="flex items-center gap-2">
                {bodegaDemoAllowed ? <CheckCircle2 className="h-4 w-4 text-cyan-200" /> : <CircleAlert className="h-4 w-4 text-amber-200" />}
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Demo Bodega</p>
              </div>
              <p className="mt-2 text-sm font-black text-white">{bodegaDemoAllowed ? "Tenant comercial disponible" : "Tenant demo deshabilitado"}</p>
            </div>
          </div>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="dashboard-auth-panel dashboard-auth-panel--soft rounded-2xl border border-white/10 p-4 text-left">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Fundador allowlisted</p>
              <h2 className="mt-2 text-lg font-black text-white">Super Admin nexID</h2>
              <p className="mt-2 text-sm leading-5 text-slate-300">
                Solo Google/Clerk + allowlist server-side puede abrir permisos globales.
              </p>
            </div>
            {bodegaDemoAllowed ? (
              <form action={`/api/session/demo?role=tenant-admin&next=${encodeURIComponent(nextPath)}`} method="post" className="h-full">
                <button
                  type="submit"
                  data-testid="sign-in-bodega-demo-link"
                  title="Abrir la demo simulada de Bodega Balmec"
                  className="dashboard-auth-profile-card h-full w-full rounded-2xl border border-cyan-300/25 p-4 text-left transition hover:border-cyan-200/70"
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Demo comercial 12h</p>
                  <h2 className="mt-2 text-lg font-black text-white">Demo Bodega Balmec</h2>
                  <p className="mt-2 text-sm leading-5 text-slate-300">
                    Tenant completo para mostrar CRM, mapa de eventos reportados, proof y marketplace sin permisos globales.
                  </p>
                </button>
              </form>
            ) : (
              <div className="dashboard-auth-panel dashboard-auth-panel--soft rounded-2xl border border-white/10 p-4 text-left opacity-80">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Demo deshabilitada</p>
                <h2 className="mt-2 text-lg font-black text-white">Demo Bodega Balmec</h2>
                <p className="mt-2 text-sm leading-5 text-slate-400">Este entorno requiere credenciales de tenant.</p>
              </div>
            )}
          </div>
          <Link
            href={loginPath}
            className="mt-4 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-50 transition hover:border-cyan-200 hover:bg-cyan-400/15"
          >
            Ver todos los perfiles del CRM
          </Link>
        </section>
        <section className="dashboard-auth-card rounded-3xl border border-white/10 p-4 shadow-[0_30px_100px_rgba(6,182,212,0.16)] backdrop-blur">
          <div className="dashboard-auth-panel dashboard-auth-panel--soft mb-4 rounded-2xl border border-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ingreso Google allowlisted</p>
            <p className="mt-2 text-sm leading-5 text-slate-300">
              Google prueba que sos el titular del correo. nexID solo crea sesión Super Admin si ese correo está aprobado.
            </p>
          </div>
          {clerkEnabled ? (
            <div data-testid="sign-in-clerk-live-panel" className="grid gap-4">
              {reauth ? (
                <p className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
                  La sesión anterior quedó cerrada. Continuá con el Google fundador autorizado.
                </p>
              ) : null}
              <ClerkGoogleSuperAdminButton
                label="Continuar con Google allowlisted"
                nextPath={nextPath}
                className="dashboard-auth-oauth-button dashboard-auth-oauth-button--solid flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/45 px-5 py-4 text-sm font-black shadow-[0_22px_55px_rgba(34,211,238,0.22)] transition disabled:cursor-wait disabled:opacity-70"
              />
              <div data-testid="sign-in-google-only-boundary" className="dashboard-auth-panel dashboard-auth-panel--inset rounded-2xl border border-white/10 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
                  Único acceso global habilitado
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Esta pantalla no ofrece Facebook, wallet ni contraseña. El rol Super Admin exige Google verificado,
                  email fundador aprobado y una sesión interna emitida por nexID.
                </p>
              </div>
            </div>
          ) : (
            <div data-testid="sign-in-clerk-disabled-panel" className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
              Clerk no está habilitado con claves live en este entorno. Usá la demo simulada o credenciales enterprise reales desde la pantalla principal.
              <Link href={loginPath} className="mt-4 inline-flex w-full justify-center rounded-xl border border-amber-200/30 bg-amber-200/10 px-4 py-3 font-bold text-amber-50">
                Volver a login enterprise
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
