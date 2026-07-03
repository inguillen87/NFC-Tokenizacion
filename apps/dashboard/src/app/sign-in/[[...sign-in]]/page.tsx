import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { BrandLockup } from "@product/ui";
import { getAccessProfiles } from "../../../lib/access-profiles";
import { dashboardDemoAccessAllowedForRole } from "../../../lib/dashboard-access-flags";
import { isClerkConfiguredForRuntime } from "../../../lib/clerk-env";

export default function SignInPage() {
  const operationalProfiles = getAccessProfiles().filter((profile) => profile.key === "super-admin" || profile.key === "tenant-admin");
  const clerkEnabled = isClerkConfiguredForRuntime();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px),radial-gradient(circle_at_74%_18%,rgba(6,182,212,.22),transparent_34%)] [background-size:32px_32px,32px_32px,auto]" />
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-[1fr_440px]">
        <section>
          <Link href="/login" aria-label="Volver a nexID CRM" className="inline-flex items-center">
            <BrandLockup size={72} variant="ripple" theme="dark" />
          </Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Admin CRM</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight md:text-6xl">
            Ingreso seguro para equipos, tenants y operadores.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            nexID mantiene un IAM operativo para CRM, tenants y empleados. Clerk queda como login social cuando
            la cuenta ya existe en el directorio externo, sin bloquear la consola comercial.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            {operationalProfiles.map((profile) => (
              dashboardDemoAccessAllowedForRole(profile.role) ? (
                <Link
                  key={profile.key}
                  href={`/api/session/demo?role=${encodeURIComponent(profile.role)}`}
                  title={`Entrar como ${profile.label}`}
                  className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 p-4 text-left transition hover:border-cyan-200/70 hover:bg-cyan-400/15"
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Acceso demo</p>
                  <h2 className="mt-2 text-lg font-black text-white">{profile.label}</h2>
                  <p className="mt-2 text-sm leading-5 text-slate-300">{profile.note}</p>
                </Link>
              ) : (
                <div key={profile.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left opacity-80">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Credenciales requeridas</p>
                  <h2 className="mt-2 text-lg font-black text-white">{profile.label}</h2>
                  <p className="mt-2 text-sm leading-5 text-slate-400">{profile.note}</p>
                </div>
              )
            ))}
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
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Login social opcional</p>
            <p className="mt-2 text-sm leading-5 text-slate-300">
              Usa Google, MetaMask o email solo si la identidad ya fue creada en Clerk. Para la reunion, usa los accesos operativos.
            </p>
          </div>
          {clerkEnabled ? (
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/"
              appearance={{
                variables: { colorPrimary: "#22d3ee", colorBackground: "#020617" },
              }}
            />
          ) : (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
              Clerk no esta habilitado con claves live en este entorno. Usa Bodega Balmec demo o credenciales enterprise desde la pantalla principal.
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
