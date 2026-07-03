import Link from "next/link";
import { Badge, Card, SectionHeading } from "@product/ui";
import { requireDashboardSession } from "../../../lib/session";

type SettingsTile = {
  href: string;
  label: string;
  eyebrow: string;
  body: string;
  tone: "cyan" | "green" | "amber" | "violet";
};

function tenantNameFromSlug(slug?: string | null) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (normalized === "demobodega" || normalized === "bodegabalmec" || normalized === "bodega-balmec") return "Bodega Balmec";
  if (!normalized) return "Workspace global";
  return normalized.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function SettingsPage() {
  const session = await requireDashboardSession();
  const tenantSlug = String(session.tenantSlug || "").trim().toLowerCase();
  const tenantQuery = tenantSlug ? `?tenant=${encodeURIComponent(tenantSlug)}` : "";
  const tenantHref = tenantSlug ? `/tenants/${encodeURIComponent(tenantSlug)}` : "/tenants";
  const tenantName = tenantNameFromSlug(tenantSlug);

  const tiles: SettingsTile[] = [
    {
      href: tenantHref,
      label: "Perfil del tenant",
      eyebrow: "Workspace",
      body: "Plan, vertical, región, health operativo, quick actions y playbook de expansión.",
      tone: "cyan",
    },
    {
      href: "/users",
      label: "Usuarios y permisos",
      eyebrow: "IAM",
      body: "Alta, roles, permisos por recurso, reset de acceso y control de MFA.",
      tone: "green",
    },
    {
      href: "/mfa",
      label: "Seguridad de cuenta",
      eyebrow: "Security",
      body: "Segundo factor, postura de sesión y preparación para acceso enterprise real.",
      tone: "amber",
    },
    {
      href: `/api-keys${tenantQuery}`,
      label: "API keys y webhooks",
      eyebrow: "Integraciones",
      body: "Conectar ERP, CRM, verificador, proof anchors y streams de eventos externos.",
      tone: "violet",
    },
    {
      href: `/subscriptions${tenantQuery}`,
      label: "Plan y facturación",
      eyebrow: "Revenue",
      body: "Plan contratado, renovación, upgrade path y alcance comercial del tenant.",
      tone: "cyan",
    },
    {
      href: "/leads-tickets",
      label: "Soporte y tickets",
      eyebrow: "Account ops",
      body: "Gestionar conversaciones, oportunidades, incidencias y seguimiento comercial.",
      tone: "green",
    },
  ];

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow="Configuración enterprise"
        title={tenantName}
        description="Centro de administración del workspace: identidad del tenant, usuarios, seguridad, integraciones, plan y soporte."
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Sesion actual</p>
              <h2 className="mt-2 text-2xl font-black text-white">{session.label || tenantName}</h2>
              <p className="mt-1 text-sm text-slate-400">{session.email}</p>
            </div>
            <Badge tone={session.role === "super-admin" ? "amber" : "cyan"}>{session.role}</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Tenant</p>
              <p className="mt-2 text-sm font-bold text-white">{tenantSlug || "global"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">MFA</p>
              <p className="mt-2 text-sm font-bold text-white">{session.mfaVerified ? "verificado" : "pendiente"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Setup</p>
              <p className="mt-2 text-sm font-bold text-white">{session.setupCompleted === false ? "pendiente" : "completo"}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Patron SaaS enterprise</p>
          <h2 className="mt-2 text-xl font-black text-white">Workspace primero, usuario despues.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Este centro agrupa las mismas decisiones que un comprador enterprise espera encontrar en una consola seria:
            cuenta, miembros, seguridad, integraciones, plan, soporte y salida segura.
          </p>
          <div className="mt-5 grid gap-2 text-sm">
            <Link
              href="/logout"
              className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-center font-black text-cyan-100 transition hover:border-cyan-200/65 hover:bg-cyan-400/16"
            >
              Cambiar cuenta o perfil
            </Link>
            <Link
              href={tenantHref}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-center font-bold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100"
            >
              Ver workspace asociado
            </Link>
          </div>
          <form method="post" action="/logout" className="mt-5">
            <button
              data-testid="settings-logout"
              className="w-full rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-500/18"
            >
              Cerrar sesión segura
            </button>
          </form>
        </Card>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="group rounded-2xl border border-white/10 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-slate-900"
          >
            <Badge tone={tile.tone}>{tile.eyebrow}</Badge>
            <h3 className="mt-4 text-lg font-black text-white group-hover:text-cyan-100">{tile.label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{tile.body}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
