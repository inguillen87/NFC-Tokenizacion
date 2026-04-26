import Link from "next/link";
import { BrandLockup, Button, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";

export default async function RegisterPage() {
  const { t } = await getDashboardI18n();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.09)_1px,transparent_1px),radial-gradient(circle_at_20%_8%,rgba(6,182,212,.2),transparent_34%)] [background-size:32px_32px,32px_32px,auto]" />
      <div className="container-shell relative z-10 grid min-h-screen place-items-center py-10">
        <Card className="w-full max-w-6xl p-3 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1.05fr_1fr]">
            <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href="/" aria-label="nexID home" className="inline-flex items-center"><BrandLockup size={56} variant="pulse" theme="dark" className="brand-surface-auth" /></Link>
                <Link href="https://nexid.lat" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100">← Volver al landing</Link>
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
            <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-6">
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.companyPlaceholder} />
                <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.emailPlaceholder} />
                <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.dashboard.forms.fields.tenantSlug} />
                <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.passwordPlaceholder} />
                <select className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" defaultValue="tenant-admin">
                  <option value="tenant-admin">Tenant Admin</option>
                  <option value="reseller">Reseller</option>
                  <option value="viewer">Viewer / Cliente</option>
                </select>
                <Button className="w-full md:col-span-2">{t.common.register}</Button>
              </div>
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
