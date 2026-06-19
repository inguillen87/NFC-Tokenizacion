import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { BrandLockup } from "@product/ui";

export default function SignInPage() {
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
            Clerk valida Google o email. nexID sincroniza esa identidad con nuestro IAM multi-tenant,
            permisos, MFA operativo y auditoria del CRM.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-50 transition hover:border-cyan-200 hover:bg-cyan-400/15"
          >
            Volver al acceso CRM
          </Link>
        </section>
        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_30px_100px_rgba(6,182,212,0.16)] backdrop-blur">
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/"
            appearance={{
              variables: { colorPrimary: "#22d3ee", colorBackground: "#020617" },
            }}
          />
        </section>
      </div>
    </main>
  );
}
