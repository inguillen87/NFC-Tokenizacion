import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { BrandLockup } from "@product/ui";
import { ClerkGoogleSuperAdminButton } from "../../../components/clerk-google-super-admin-button";
import { dashboardDemoAccessAllowedForRole } from "../../../lib/dashboard-access-flags";
import { isClerkConfiguredForRuntime } from "../../../lib/clerk-env";

export default function SignInPage() {
  const bodegaDemoAllowed = dashboardDemoAccessAllowedForRole("tenant-admin");
  const clerkEnabled = isClerkConfiguredForRuntime();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px),radial-gradient(circle_at_74%_18%,rgba(6,182,212,.22),transparent_34%)] [background-size:32px_32px,32px_32px,auto]" />
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-[1fr_440px]">
        <section>
          <Link href="/login" aria-label="Volver a nexID CRM" className="inline-flex items-center">
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
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Fundador allowlisted</p>
              <h2 className="mt-2 text-lg font-black text-white">Super Admin nexID</h2>
              <p className="mt-2 text-sm leading-5 text-slate-300">
                Solo Google/Clerk + allowlist server-side puede abrir permisos globales.
              </p>
            </div>
            {bodegaDemoAllowed ? (
              <Link
                href="/api/session/demo?role=tenant-admin"
                title="Entrar como Bodega Balmec"
                className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 p-4 text-left transition hover:border-cyan-200/70 hover:bg-cyan-400/15"
              >
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Demo comercial 12h</p>
                <h2 className="mt-2 text-lg font-black text-white">Bodega Balmec</h2>
                <p className="mt-2 text-sm leading-5 text-slate-300">
                  Tenant completo para mostrar CRM, mapa vivo, proof y marketplace sin permisos globales.
                </p>
              </Link>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left opacity-80">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Demo deshabilitada</p>
                <h2 className="mt-2 text-lg font-black text-white">Bodega Balmec</h2>
                <p className="mt-2 text-sm leading-5 text-slate-400">Este entorno requiere credenciales de tenant.</p>
              </div>
            )}
          </div>
          <Link
            href="/login"
            className="mt-4 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-50 transition hover:border-cyan-200 hover:bg-cyan-400/15"
          >
            Ver todos los perfiles del CRM
          </Link>
        </section>
        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_30px_100px_rgba(6,182,212,0.16)] backdrop-blur">
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ingreso Google allowlisted</p>
            <p className="mt-2 text-sm leading-5 text-slate-300">
              Google prueba que sos el titular del correo. nexID solo crea sesión Super Admin si ese correo está aprobado.
            </p>
          </div>
          {clerkEnabled ? (
            <div className="grid gap-4">
              <ClerkGoogleSuperAdminButton
                label="Continuar con Google allowlisted"
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-300/45 bg-cyan-400 px-5 py-4 text-sm font-black text-slate-950 shadow-[0_22px_55px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70"
              />
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-3">
                <p className="px-2 pb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Fallback Clerk
                </p>
                <SignIn
                  routing="path"
                  path="/sign-in"
                  signUpUrl="/sign-up"
                  forceRedirectUrl="/auth/clerk/super-admin"
                  fallbackRedirectUrl="/auth/clerk/super-admin"
                  appearance={{
                    variables: { colorPrimary: "#22d3ee", colorBackground: "#020617" },
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
              Clerk no está habilitado con claves live en este entorno. Usa Bodega Balmec demo o credenciales enterprise desde la pantalla principal.
              <Link href="/login" className="mt-4 inline-flex w-full justify-center rounded-xl border border-amber-200/30 bg-amber-200/10 px-4 py-3 font-bold text-amber-50">
                Volver a login enterprise
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
