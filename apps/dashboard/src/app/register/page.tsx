import Link from "next/link";
import { BrandLockup, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { RegisterAccessPanel } from "../../components/register-access-panel";
import { isClerkConfiguredForRuntime } from "../../lib/clerk-env";
import { AuthThemeControl } from "../../components/auth-theme-control";

export default async function RegisterPage() {
  const { t, locale } = await getDashboardI18n();

  return (
    <main className="dashboard-auth-surface relative min-h-screen overflow-hidden bg-slate-950">
      <div className="dashboard-auth-backdrop pointer-events-none absolute inset-0" />
      <div className="dashboard-auth-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <AuthThemeControl locale={locale} />
      <div className="container-shell relative z-10 grid min-h-screen place-items-center pb-10 pt-24 md:py-10">
        <Card className="dashboard-auth-card w-full max-w-6xl p-3 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1.05fr_1fr]">
            <section className="dashboard-auth-intro rounded-2xl border border-white/10 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href="/" aria-label="nexID home" className="inline-flex items-center">
                  <BrandLockup size={56} variant="pulse" theme="dark" className="brand-surface-auth" />
                </Link>
                <Link href="https://nexid.lat" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-50 shadow-[0_18px_40px_rgba(6,182,212,0.16)] transition hover:border-cyan-200/70 hover:bg-cyan-400/16">
                  <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-cyan-300/15 text-cyan-100">{"<-"}</span>
                  <span>Volver a nexID</span>
                </Link>
              </div>
              <h1 className="mt-6 text-3xl font-bold text-white">{t.common.register}</h1>
              <p className="mt-2 text-sm text-slate-300">Alta de cuentas para operación enterprise por tenant. Creá admins, resellers y perfiles de auditoría en el Centro de Control.</p>
              <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                Este registro es para el <strong>dashboard administrativo</strong>. Para registro de consumidor (wallet/rewards), usá <a className="font-semibold underline-offset-2 hover:underline" href="https://nexid.lat/register">nexid.lat/register</a>.
              </div>
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                <p><strong className="text-cyan-300">Tenant Admin</strong>: operación completa del tenant.</p>
                <p><strong className="text-cyan-300">Reseller</strong>: gestión de canal y clientes.</p>
                <p><strong className="text-cyan-300">Viewer/Cliente</strong>: solo lectura y seguimiento.</p>
              </div>
            </section>
            <section className="dashboard-auth-panel rounded-2xl border border-white/10 p-6">
              <RegisterAccessPanel submitLabel={t.common.register} clerkEnabled={isClerkConfiguredForRuntime()} />
              <p className="mt-4 text-xs text-slate-400">
                ¿Ya tenés cuenta? <Link href="/login" className="text-cyan-300">{t.common.login}</Link>
              </p>
            </section>
          </div>
        </Card>
      </div>
    </main>
  );
}
