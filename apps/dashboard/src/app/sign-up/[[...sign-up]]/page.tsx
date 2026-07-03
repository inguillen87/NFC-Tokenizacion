import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { BrandLockup } from "@product/ui";
import { isClerkConfiguredForRuntime } from "../../../lib/clerk-env";

export default function SignUpPage() {
  const clerkEnabled = isClerkConfiguredForRuntime();
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px),radial-gradient(circle_at_74%_18%,rgba(129,140,248,.2),transparent_34%)] [background-size:32px_32px,32px_32px,auto]" />
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-[1fr_440px]">
        <section>
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
        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_30px_100px_rgba(129,140,248,0.16)] backdrop-blur">
          {clerkEnabled ? (
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/"
              appearance={{
                variables: { colorPrimary: "#22d3ee", colorBackground: "#020617" },
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
