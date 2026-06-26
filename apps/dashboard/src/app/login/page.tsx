import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLockup, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";
import { dashboardContent } from "../../lib/dashboard-content";
import { getAccessProfiles } from "../../lib/access-profiles";
import { LoginFormPanel } from "../../components/login-form-panel";
import { getDashboardSession } from "../../lib/session";
import { dashboardOneClickAccessAllowed } from "../../lib/dashboard-access-flags";

const visibleRoleCards = [
  {
    label: "Super Admin",
    description: "Control global de tenants, seguridad, permisos, infraestructura, CRM, leads y analytics cross-tenant.",
  },
  {
    label: "Owner del tenant",
    description: "Dueño operativo de la empresa: lotes, tags, taps, marketplace, rewards, empleados y reportes del tenant.",
  },
  {
    label: "Empleado Operaciones NFC",
    description: "Opera batches, tags, validaciones, eventos en vivo y canjes sin tocar seguridad global ni facturación.",
  },
  {
    label: "Empleado CRM & Growth",
    description: "Trabaja sobre clientes, campañas, vouchers, segmentos, marketplace y performance comercial del tenant.",
  },
];

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
                  ¿Buscás el portal de consumidor con wallet, rewards y marketplace? Entrá en{" "}
                  <a className="font-semibold text-cyan-200 underline-offset-2 hover:underline" href="https://nexid.lat/login">
                    nexid.lat/login
                  </a>
                  .
                </div>
                {visibleRoleCards.map((item) => (
                  <div key={item.label} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-300">
                    <span className="font-semibold text-cyan-300">{item.label}</span>
                    <span className="ml-2">{item.description}</span>
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
