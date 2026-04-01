import Link from "next/link";
import { BrandLockup, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";
import { ForgotPasswordPanel } from "../../components/forgot-password-panel";

export default async function ForgotPasswordPage() {
  const { t, locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-md p-8">
        <Link href="/" aria-label="nexID home" className="inline-flex items-center"><BrandLockup size={30} variant="pulse" theme="dark" /></Link>
        <h1 className="mt-4 text-2xl font-bold text-white">{t.dashboard.forgotPassword}</h1>
        <p className="mt-2 text-sm text-slate-400">{t.dashboard.auth.forgotBody}</p>
        <ForgotPasswordPanel emailPlaceholder={t.web.auth.emailPlaceholder} actionLabel={copy.auth.forgotAction} />
        <p className="mt-4 text-xs"><Link href="/login" className="text-cyan-300">{t.common.login}</Link></p>
        <p className="mt-2 text-xs"><Link href="/reset-password" className="text-cyan-300">{copy.auth.resetTitle}</Link></p>
      </Card>
    </main>
  );
}
