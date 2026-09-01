import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { BrandLockup } from "@product/ui";
import { isClerkConfiguredForRuntime } from "../../../lib/clerk-env";
import { getDashboardI18n } from "../../../lib/locale";
import { AuthThemeControl } from "../../../components/auth-theme-control";

export default async function SignUpPage() {
  const clerkEnabled = isClerkConfiguredForRuntime();
  const { locale } = await getDashboardI18n();
  return (
    <main className="dashboard-auth-surface relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="dashboard-auth-backdrop pointer-events-none absolute inset-0" />
      <div className="dashboard-auth-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <AuthThemeControl locale={locale} />
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-5 pb-10 pt-24 lg:grid-cols-[1fr_440px] lg:py-10">
        <section className="dashboard-auth-story">
          <Link href="/register" aria-label="Volver a nexID CRM" className="inline-flex items-center">
            <BrandLockup size={72} variant="ripple" theme="dark" />
          </Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Tenant onboarding</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight md:text-6xl">
            Crea tu acceso y nexID arma tu tenant operativo.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            El OAuth crea la identidad. El backend nexID completa usuario local,
            rol, membership y tenant inicial para empezar sin mezclar datos entre empresas.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-50 transition hover:border-cyan-200 hover:bg-cyan-400/15"
          >
            Volver al registro CRM
          </Link>
        </section>
        <section className="dashboard-auth-card rounded-3xl border border-white/10 p-4 shadow-[0_30px_100px_rgba(129,140,248,0.16)] backdrop-blur">
          {clerkEnabled ? (
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/"
              appearance={{
                variables: {
                  colorPrimary: "var(--auth-accent)",
                  colorPrimaryForeground: "var(--auth-primary-foreground)",
                  colorBackground: "var(--auth-clerk-bg)",
                  colorForeground: "var(--auth-text)",
                  colorMutedForeground: "var(--auth-muted)",
                  colorInput: "var(--auth-input-bg)",
                  colorInputForeground: "var(--auth-text)",
                  colorBorder: "var(--auth-border-solid)",
                  borderRadius: "0.875rem",
                },
              }}
            />
          ) : (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
              El registro OAuth requiere claves Clerk live. Para una demo enterprise usa Bodega Balmec o solicita alta manual.
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
