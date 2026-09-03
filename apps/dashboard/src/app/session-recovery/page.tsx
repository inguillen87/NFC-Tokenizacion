import { BrandLockup } from "@product/ui";
import { AuthThemeControl } from "../../components/auth-theme-control";
import { isClerkConfiguredForRuntime } from "../../lib/clerk-env";
import { getDashboardI18n } from "../../lib/locale";
import { SessionRecoveryClient } from "./session-recovery-client";
import { normalizeDashboardReturnPath } from "../../lib/dashboard-return-path";

type SessionRecoveryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SessionRecoveryPage({ searchParams }: SessionRecoveryPageProps) {
  const { locale } = await getDashboardI18n();
  const params = searchParams ? await searchParams : {};
  const rawNextPath = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = normalizeDashboardReturnPath(rawNextPath);

  return (
    <main className="dashboard-auth-surface relative min-h-screen overflow-hidden bg-slate-950">
      <div className="dashboard-auth-backdrop pointer-events-none absolute inset-0" />
      <div className="dashboard-auth-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <AuthThemeControl locale={locale} />

      <div className="container-shell relative z-10 grid min-h-dvh place-items-center py-20 sm:py-24">
        <section
          aria-labelledby="session-recovery-title"
          className="dashboard-auth-card w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 p-5 shadow-2xl sm:p-8 md:p-10"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
            <BrandLockup size={58} variant="ripple" theme="dark" className="brand-surface-auth" />
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-100">
              Sesión protegida
            </span>
          </div>

          <SessionRecoveryClient clerkEnabled={isClerkConfiguredForRuntime()} nextPath={nextPath} />
        </section>
      </div>
    </main>
  );
}

export const runtime = "nodejs";
