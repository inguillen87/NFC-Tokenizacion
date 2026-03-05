import Link from "next/link";
import { Button, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";

export default async function ResetPasswordPage() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-white">{copy.auth.resetTitle}</h1>
        <p className="mt-2 text-sm text-slate-400">{copy.auth.resetBody}</p>

        <div className="mt-6 grid gap-3">
          <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.passwordPlaceholder} />
          <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.passwordPlaceholder} />
          <Button className="w-full">{copy.auth.resetAction}</Button>
        </div>

        <p className="mt-4 text-xs">
          <Link href="/login" className="text-cyan-300">{t.common.login}</Link>
        </p>
      </Card>
    </main>
  );
}
