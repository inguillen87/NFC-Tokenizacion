import { Button, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";

export default async function InviteUserPage() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-white">{copy.auth.inviteTitle}</h1>
        <p className="mt-2 text-sm text-slate-400">{copy.auth.inviteBody}</p>

        <div className="mt-6 grid gap-3">
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={t.web.auth.emailPlaceholder} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.auth.inviteTenantLabel} />
          <select className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" aria-label={copy.auth.inviteRoleLabel}>
            {Object.entries(copy.roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Button className="w-full">{copy.auth.inviteAction}</Button>
        </div>
      </Card>
    </main>
  );
}
