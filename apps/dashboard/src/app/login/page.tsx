import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLockup, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";
import { getAccessProfiles } from "../../lib/access-profiles";
import { LoginFormPanel } from "../../components/login-form-panel";
import { getDashboardSession } from "../../lib/session";

const roleDescriptions: Record<string, string> = {
  "super-admin": "Control total de tenants, seguridad, CRM, leads y analytics global.",
  "tenant-admin": "Gestiona lotes, tags, taps, portal consumidor y marketplace del tenant.",
  reseller: "Opera canal, clientes, revenue share y rollout comercial.",
  viewer: "Solo lectura para auditoria, cliente o demo comercial.",
};

export default async function LoginPage() {
  const { t, locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const profiles = getAccessProfiles();
  const demoLoginAllowed = true;
  const session = await getDashboardSession();
  if (session) redirect("/");

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.09)_1px,transparent_1px),radial-gradient(circle_at_78%_15%,rgba(6,182,212,.18),transparent_34%)] [background-size:32px_32px,32px_32px,auto]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_22%_18%,rgba(45,212,191,0.22),transparent_34%),radial-gradient(circle_at_70%_12%,rgba(129,140,248,0.20),transparent_38%)]" />

      <div className="container-shell relative z-10 grid min-h-screen place-items-center py-10">
        <Card className="w-full max-w-6xl p-3 md:p-10">
          <div className="grid gap-10 md:grid-cols-[1.08fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href="/" aria-label="nexID home" className="inline-flex items-center">
                  <BrandLockup size={64} variant="ripple" theme="dark" className="brand-surface-auth" />
                </Link>
                <Link
                  href="https://nexid.lat"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100"
                >
                  {"<-"} Volver al landing
                </Link>
              </div>

              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Centro de control enterprise</p>
              <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">{t.common.login}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Ingreso exclusivo para operaciones nexID: tenants, tags, taps en vivo, CRM, marketplace, antifraude y analytics.
                El portal de consumidores vive separado para mantener clara la experiencia del comprador final.
              </p>

              <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                Demo listo para venta: entra en 1 click, revisa metricas, exporta reportes y muestra el flujo completo sin depender
                de credenciales locales.
              </div>

              <div className="mt-5 grid gap-2 text-xs">
                <div className="rounded-lg border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-violet-100">
                  Buscas el portal de consumidor con wallet, rewards y marketplace? Entra en{" "}
                  <a className="font-semibold text-cyan-200 underline-offset-2 hover:underline" href="https://nexid.lat/login">
                    nexid.lat/login
                  </a>
                  .
                </div>
                {Object.entries(copy.roles).map(([key, label]) => (
                  <div key={key} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-300">
                    <span className="font-semibold text-cyan-300">{label}</span>
                    <span className="ml-2">{roleDescriptions[key] || "Acceso operativo segun permisos configurados."}</span>
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
              demoLoginAllowed={demoLoginAllowed}
            />
          </div>
        </Card>
      </div>
    </main>
  );
}
