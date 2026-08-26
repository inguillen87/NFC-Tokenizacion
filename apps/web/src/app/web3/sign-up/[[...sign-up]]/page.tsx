import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { web3ClerkAppearance } from "../../clerk-appearance";
import { isClerkConfiguredForRuntime } from "../../../../lib/clerk-env";
import { BrandHomeLink } from "../../../../components/brand-home-link";

export default async function Web3SignUpPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const nextPath = typeof params.next === "string" ? params.next : "/me/wallet";
  const completeUrl = `/web3/complete?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px),radial-gradient(circle_at_74%_18%,rgba(129,140,248,.2),transparent_34%)] [background-size:32px_32px,32px_32px,auto]" />
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-[1fr_440px]">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BrandHomeLink size={72} />
            <Link href="/me/wallet" className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/5 px-4 text-xs font-bold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/35">
              Volver a Wallet
            </Link>
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Passport Web3</p>
          <h1 className="brand-editorial-gradient mt-3 max-w-2xl text-4xl font-black leading-tight md:text-6xl">
            Crea tu identidad Web3 sin tocar el alta post-tap.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Este paso vincula una wallet a tu consumidor nexID para acciones de NFT, reventa, transferencia y propiedad digital.
          </p>
        </section>
        <section className="rounded-3xl border border-white/10 bg-slate-950/78 p-4 shadow-[0_30px_100px_rgba(129,140,248,0.16)] backdrop-blur">
          {isClerkConfiguredForRuntime() ? (
            <SignUp
              routing="path"
              path="/web3/sign-up"
              signInUrl="/web3/sign-in"
              fallbackRedirectUrl={completeUrl}
              appearance={web3ClerkAppearance}
            />
          ) : (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
              Falta configurar Clerk para Web3 en este entorno. El portal sigue funcionando con email/WhatsApp.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
