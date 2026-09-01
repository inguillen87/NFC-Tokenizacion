import Link from "next/link";
import { Card } from "@product/ui";
import { InviteUserPanel } from "../../components/invite-user-panel";
import { requireDashboardSession } from "../../lib/session";
import { getDashboardI18n } from "../../lib/locale";
import { AuthThemeControl } from "../../components/auth-theme-control";

export default async function InviteUserPage() {
  await requireDashboardSession("users:manage");
  const { locale } = await getDashboardI18n();
  return (
    <main className="dashboard-auth-surface relative grid min-h-screen place-items-center overflow-hidden px-4 pb-10 pt-24 md:py-10">
      <div className="dashboard-auth-backdrop pointer-events-none absolute inset-0" />
      <AuthThemeControl locale={locale} />
      <Card className="dashboard-auth-card relative z-10 w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-white">Invitar usuario</h1>
        <p className="mt-2 text-sm text-slate-400">Creá invitaciones reales con expiración y activación inicial.</p>
        <InviteUserPanel />
        <p className="mt-4 text-xs text-slate-400">También podés administrar usuarios desde <Link href="/users" className="text-cyan-300">/users</Link>.</p>
      </Card>
    </main>
  );
}
