import Link from "next/link";
import { BrandLockup, Button, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";

export default async function RegisterPage() {
  const { t } = await getDashboardI18n();

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-3xl p-8">
        <Link href="/" aria-label="nexID home" className="inline-flex items-center"><BrandLockup size={34} variant="pulse" theme="dark" /></Link>
        <h1 className="mt-4 text-3xl font-bold text-white">{t.common.register}</h1>
        <p className="mt-2 text-sm text-slate-400">{t.dashboard.auth.registerBody}</p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
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

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          <p><strong className="text-cyan-300">Tenant Admin</strong>: operación completa del tenant.</p>
          <p><strong className="text-cyan-300">Reseller</strong>: gestión de canal y clientes.</p>
          <p><strong className="text-cyan-300">Viewer/Cliente</strong>: solo lectura y seguimiento.</p>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          <Link href="/login" className="text-cyan-300">{t.common.login}</Link>
        </p>
      </Card>
    </main>
  );
}
