import Link from "next/link";
import { BrandLockup, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";
import { getAccessProfiles } from "../../lib/access-profiles";
import { LoginFormPanel } from "../../components/login-form-panel";
import { getDashboardSession } from "../../lib/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const { t, locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const profiles = getAccessProfiles();
  const session = await getDashboardSession();
  if (session) redirect("/");

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-5xl p-3 md:p-10">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6">
            <Link href="/" aria-label="nexID home" className="inline-flex items-center"><BrandLockup size={34} variant="ripple" theme="dark" /></Link>
            <h1 className="mt-5 text-3xl font-bold text-white">{t.common.login}</h1>
            <p className="mt-2 text-sm text-slate-400">{t.dashboard.auth.loginBody}</p>
            <div className="mt-5 grid gap-2 text-xs">
              {Object.entries(copy.roles).map(([key, label]) => (
                <div key={key} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-300">
                  <span className="font-semibold text-cyan-300">{label}</span>
                  <span className="ml-2">{key === "super-admin" ? "Control total de tenants y seguridad." : key === "tenant-admin" ? "Gestiona lotes, tags y operación del tenant." : key === "reseller" ? "Gestiona canal, clientes y revenue." : "Solo lectura para auditoría/cliente."}</span>
                </div>
              ))}
            </div>

          </div>

          <LoginFormPanel
            emailPlaceholder={t.web.auth.emailPlaceholder}
            passwordPlaceholder={t.web.auth.passwordPlaceholder}
            loginAction={copy.auth.loginAction}
            registerLabel={t.common.register}
            forgotLabel={t.dashboard.forgotPassword}
            inviteLabel={copy.auth.inviteTitle}
            profiles={profiles}
          />
        </div>
      </Card>
    </main>
  );
}
