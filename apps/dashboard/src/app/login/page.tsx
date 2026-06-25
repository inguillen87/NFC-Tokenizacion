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
  viewer: "Solo lectura para auditoria, cliente o revisión comercial.",
};

function dashboardOneClickAccessAllowed() {
  const explicitPublicSession = String(process.env.ENABLE_PUBLIC_DEMO_SESSION || "").toLowerCase();
  if (explicitPublicSession === "1" || explicitPublicSession === "true") return true;
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  if (isProduction) return false;
  const configured = String(process.env.DASHBOARD_ALLOW_DEMO_LOGIN || "").trim().toLowerCase();
  if (configured === "") return true;
  return configured === "1" || configured === "true";
}

export default async function LoginPage() {
  const { t, locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const profiles = getAccessProfiles();
  const demoLoginAllowed = dashboardOneClickAccessAllowed();
  const session = await getDashboardSession();
  if (session) redirect("/");

  return (
    <main className="dashboard-auth-surface relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.09)_1px,transparent_1px),radial-gradient(circle_at_78%_15%,rgba(6,182,212,.18),transparent_34%)] [background-size:32px_32px,32px_32px,auto]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_22%_18%,rgba(45,212,191,0.22),transparent_34%),radial-gradient(circle_at_70%_12%,rgba(129,140,248,0.20),transparent_38%)]" />

      <div className="container-shell relative z-10 grid min-h-screen place-items-center py-10">
        <Card className="dashboard-auth-card w-full max-w-6xl p-3 md:p-10">
          <div className="grid gap-10 md:grid-cols-[1.08fr_1fr]">
            <div className="dashboard-auth-intro rounded-2xl border border-white/10 bg-slate-950/40 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href="/" aria-label="nexID home" className="inline-flex items-center">
                  <BrandLockup size={64} variant="ripple" theme="dark" className="brand-surface-auth" />
                </Link>
                <Link
                  href="https://nexid.lat"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-50 shadow-[0_18px_40px_rgba(6,182,212,0.16)] transition hover:border-cyan-200/70 hover:bg-cyan-400/16"
                >
                  <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-cyan-300/15 text-cyan-100">{"<-"}</span>
                  <span>Volver a nexID</span>
                </Link>
              </div>

              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Centro de control enterprise</p>
              <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">{t.common.login}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Ingreso exclusivo para operaciones nexID: tenants, tags, taps en vivo, CRM, marketplace, antifraude y analytics.
                El portal de consumidores vive separado para mantener clara la experiencia del comprador final.
              </p>

              <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                Consola lista para venta: ingreso controlado, metricas en vivo, exportacion de reportes y flujo completo para operar
                tenants, tags y clientes sin mezclar el portal consumidor.
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
              clerkEnabled={Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)}
            />
          </div>
        </Card>
      </div>
    </main>
  );
}
