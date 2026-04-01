import Link from "next/link";
import { BrandLockup, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";
import { ResetPasswordPanel } from "../../components/reset-password-panel";

export default async function ResetPasswordPage() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-md p-8">
        <Link href="/" aria-label="nexID home" className="inline-flex items-center"><BrandLockup size={30} variant="pulse" theme="dark" /></Link>
        <h1 className="mt-4 text-2xl font-bold text-white">{copy.auth.resetTitle}</h1>
        <p className="mt-2 text-sm text-slate-400">{copy.auth.resetBody}</p>
        <ResetPasswordPanel passwordPlaceholder={t.web.auth.passwordPlaceholder} actionLabel={copy.auth.resetAction} />
        <p className="mt-4 text-xs"><Link href="/login" className="text-cyan-300">{t.common.login}</Link></p>
      </Card>
    </main>
  );
}
