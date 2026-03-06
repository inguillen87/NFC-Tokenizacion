import Link from "next/link";
import { BrandLockup, Button, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";

export default async function RegisterPage() {
  const { t } = await getDashboardI18n();

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-lg p-8">
        <BrandLockup size={34} variant="pulse" theme="dark" />
        <h1 className="mt-4 text-3xl font-bold text-white">{t.common.register}</h1>
        <p className="mt-2 text-sm text-slate-400">{t.dashboard.auth.registerBody}</p>

        <div className="mt-6 grid gap-3">
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.companyPlaceholder} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.emailPlaceholder} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.dashboard.forms.fields.tenantSlug} />
          <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.passwordPlaceholder} />
          <Button className="w-full">{t.common.register}</Button>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          <Link href="/login" className="text-cyan-300">{t.common.login}</Link>
        </p>
      </Card>
    </main>
  );
}
