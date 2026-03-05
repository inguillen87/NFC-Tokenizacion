import Link from "next/link";
import { BrandLockup, Button, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";

export default async function ForgotPasswordPage() {
  const { t, locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-md p-8">
        <BrandLockup size={30} variant="pulse" theme="dark" />
        <h1 className="mt-4 text-2xl font-bold text-white">{t.dashboard.forgotPassword}</h1>
        <p className="mt-2 text-sm text-slate-400">{t.dashboard.auth.forgotBody}</p>

        <div className="mt-6 grid gap-3">
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.emailPlaceholder} />
          <Button className="w-full">{copy.auth.forgotAction}</Button>
        </div>

        <p className="mt-4 text-xs">
          <Link href="/login" className="text-cyan-300">{t.common.login}</Link>
        </p>
        <p className="mt-2 text-xs">
          <Link href="/reset-password" className="text-cyan-300">{copy.auth.resetTitle}</Link>
        </p>
      </Card>
    </main>
  );
}
