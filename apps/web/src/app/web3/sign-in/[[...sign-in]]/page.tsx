import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { BrandLockup } from "@product/ui";
import { MetamaskPrimaryButton } from "../metamask-primary-button";
import { web3ClerkAppearance } from "../../clerk-appearance";

function clerkReady() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export default async function Web3SignInPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const nextPath = typeof params.next === "string" ? params.next : "/me/wallet";
  const completeUrl = `/web3/complete?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px),radial-gradient(circle_at_72%_18%,rgba(34,211,238,.22),transparent_34%),radial-gradient(circle_at_18%_76%,rgba(124,58,237,.18),transparent_30%)] [background-size:32px_32px,32px_32px,auto,auto]" />
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-[1fr_440px]">
        <section>
          <Link href="/me/wallet" aria-label="Volver a wallet nexID" className="inline-flex items-center">
            <BrandLockup size={72} variant="ripple" theme="dark" />
          </Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Web3 opcional</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight md:text-6xl">
            Conecta MetaMask solo para ownership, NFT y marketplace.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Tu alta por WhatsApp/email sigue igual. Esta verificacion aparece cuando queres vender, transferir,
            tokenizar o asociar una wallet real a tu Passport.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            {["Wallet verificada", "Sesion consumer nexID", "Marketplace listo"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 font-bold text-cyan-50">
                {item}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-white/10 bg-slate-950/78 p-4 shadow-[0_30px_100px_rgba(6,182,212,0.16)] backdrop-blur">
          {clerkReady() ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Accion recomendada</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Firma con MetaMask para vincular wallet al Passport. No cambia tu alta por WhatsApp/email.
                </p>
                <div className="mt-4">
                  <MetamaskPrimaryButton redirectUrl={completeUrl} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                <p className="px-1 pb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">O usa el flujo completo de Clerk</p>
                <SignIn
                  routing="path"
                  path="/web3/sign-in"
                  signUpUrl="/web3/sign-up"
                  fallbackRedirectUrl={completeUrl}
                  appearance={web3ClerkAppearance}
                />
              </div>
            </div>
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
