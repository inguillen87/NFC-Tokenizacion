import Link from "next/link";
import { siteConfig } from "@product/config";
import { Badge, Button, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";

export default async function LoginPage() {
  const { t, locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-5xl p-3 md:p-10">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6">
            <Badge tone="green">{siteConfig.productName}</Badge>
            <h1 className="mt-5 text-3xl font-bold text-white">{t.common.login}</h1>
            <p className="mt-2 text-sm text-slate-400">{t.dashboard.auth.loginBody}</p>
          </div>

          <div>
            <div className="grid gap-3">
              <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.emailPlaceholder} />
              <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.passwordPlaceholder} />
              <select className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm">
                {Object.entries(copy.roles).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <Link href="/">
                <Button className="w-full">{copy.auth.loginAction}</Button>
              </Link>
            </div>

            <div className="mt-4 flex justify-between text-xs">
              <Link href="/register" className="text-cyan-300">{t.common.register}</Link>
              <Link href="/forgot-password" className="text-cyan-300">{t.dashboard.forgotPassword}</Link>
              <Link href="/invite-user" className="text-cyan-300">{copy.auth.inviteTitle}</Link>
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}
