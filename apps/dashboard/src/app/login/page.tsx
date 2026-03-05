import Link from "next/link";
import { Badge, Button, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";

export default async function LoginPage() {
  const { t } = await getDashboardI18n();

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-5xl p-3 md:p-10">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6">
            <Badge tone="green">NFC Identity Cloud</Badge>
            <h1 className="mt-5 text-3xl font-bold text-white">{t.common.login}</h1>
            <p className="mt-2 text-sm text-slate-400">{t.dashboard.auth.loginBody}</p>
            <ul className="mt-6 space-y-2 text-sm text-slate-300">
              <li>• Multi-tenant operations and role-based access.</li>
              <li>• Authentication events, anti-fraud analytics and lifecycle actions.</li>
              <li>• API-first platform for NFC Authentication + Digital Product Identity.</li>
            </ul>
          </div>

          <div>
            <div className="grid gap-3">
              <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.emailPlaceholder} />
              <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.passwordPlaceholder} />
              <select className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm">
                <option>super admin</option>
                <option>tenant admin</option>
                <option>reseller</option>
                <option>viewer</option>
              </select>
              <Link href="/">
                <Button className="w-full">{t.common.login}</Button>
              </Link>
            </div>

            <div className="mt-4 flex justify-between text-xs">
              <Link href="/register" className="text-cyan-300">{t.common.register}</Link>
              <Link href="/forgot-password" className="text-cyan-300">{t.dashboard.forgotPassword}</Link>
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}
