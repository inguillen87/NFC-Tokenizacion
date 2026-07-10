import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  FileSearch,
  FlaskConical,
  KeyRound,
  LifeBuoy,
  Network,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";
import { Badge, Card, SectionHeading } from "@product/ui";
import { SecureDashboardLogoutButton } from "../../../components/secure-dashboard-logout-button";
import { isClerkConfiguredForRuntime } from "../../../lib/clerk-env";
import { requireDashboardSession } from "../../../lib/session";

type SettingsTile = {
  href: string;
  label: string;
  eyebrow: string;
  body: string;
  proof: string;
  tone: "cyan" | "green" | "amber" | "violet" | "rose";
  icon: ReactNode;
};

const toneClasses: Record<SettingsTile["tone"], string> = {
  cyan: "border-cyan-300/25 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/60",
  green: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100 hover:border-emerald-200/60",
  amber: "border-amber-300/25 bg-amber-500/10 text-amber-100 hover:border-amber-200/60",
  violet: "border-violet-300/25 bg-violet-500/10 text-violet-100 hover:border-violet-200/60",
  rose: "border-rose-300/25 bg-rose-500/10 text-rose-100 hover:border-rose-200/60",
};

function tenantNameFromSlug(slug?: string | null) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (normalized === "demobodega" || normalized === "bodegabalmec" || normalized === "bodega-balmec") return "Bodega Balmec";
  if (!normalized) return "Workspace global";
  return normalized.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roleLabel(role: string) {
  if (role === "super-admin") return "Super Admin";
  if (role === "tenant-admin") return "Admin tenant";
  if (role === "reseller") return "Reseller";
  return "Viewer";
}

function permissionSummary(permissions: string[]) {
  if (permissions.includes("*")) return "Acceso completo";
  if (!permissions.length) return "Scope limitado";
  return permissions.slice(0, 3).join(" / ");
}

export default async function SettingsPage() {
  const session = await requireDashboardSession();
  const tenantSlug = String(session.tenantSlug || "").trim().toLowerCase();
  const tenantQuery = tenantSlug ? `?tenant=${encodeURIComponent(tenantSlug)}` : "";
  const tenantHref = tenantSlug ? `/tenants/${encodeURIComponent(tenantSlug)}` : "/tenants";
  const tenantName = tenantNameFromSlug(tenantSlug);
  const isClerkSuperAdminSession = session.role === "super-admin" && !session.mfaVerified;
  const clerkEnabled = isClerkConfiguredForRuntime();
  const sessionSecurityLabel = isClerkSuperAdminSession
    ? "SSO Google/Clerk, MFA pendiente"
    : session.mfaVerified
      ? "MFA verificado"
      : "MFA pendiente";
  const securityBadgeTone = session.mfaVerified ? "green" : "amber";
  const canManageUsers = session.role === "super-admin"
    || session.permissions.includes("*")
    || session.permissions.includes("users:manage")
    || session.permissions.includes("employees:*");
  const setupStatus = session.setupCompleted === false ? "Setup pendiente" : "Setup completo";
  const workspaceMode = session.role === "super-admin" ? "Global workspace" : "Tenant workspace";

  const primaryAction = session.setupCompleted === false && session.role === "tenant-admin"
    ? { href: "/onboarding", label: "Completar setup", meta: "Datos base, equipo e integraciones iniciales" }
    : !session.mfaVerified
      ? { href: "/mfa", label: "Reforzar seguridad", meta: "Activar segundo factor antes de escalar permisos" }
      : { href: tenantHref, label: "Abrir workspace", meta: "Perfil, plan, health y acciones del tenant" };

  const tiles: SettingsTile[] = [
    {
      href: "/proof",
      label: "Proof, IOTA y anchors",
      eyebrow: "Trust layer",
      body: "Verificador de hashes, Merkle roots, decoder para explorer y recibos publicos hash-only.",
      proof: "Auditoria externa sin exponer UIDs, rutas ni datos privados.",
      tone: "green",
      icon: <FileSearch className="h-5 w-5" />,
    },
    {
      href: "/tokenization",
      label: "Polygon ownership",
      eyebrow: "Ownership",
      body: "Certificados, claims, garantia transferible y propiedad separados de la prueba IOTA.",
      proof: "Polygon no reemplaza proof: prueba derechos y ownership.",
      tone: "violet",
      icon: <Network className="h-5 w-5" />,
    },
    {
      href: "/demo-lab",
      label: "Demo Lab enterprise",
      eyebrow: "Sales demo",
      body: "Secure Delivery, pharma, agro, proof verifier y mobile flows para explicar valor en vivo.",
      proof: "Ruta comercial para clientes, inversores y C-level.",
      tone: "cyan",
      icon: <FlaskConical className="h-5 w-5" />,
    },
    {
      href: "/sdk-vision",
      label: "SDK/API integration",
      eyebrow: "Developers",
      body: "Guia para conectar taps, ERP, CRM, POS, webhooks, mobile verifier y backend privado.",
      proof: "Camino tecnico desde demo a integracion real.",
      tone: "amber",
      icon: <Terminal className="h-5 w-5" />,
    },
    {
      href: tenantHref,
      label: tenantSlug ? `Perfil ${tenantName}` : "Directorio de tenants",
      eyebrow: "Workspace",
      body: "Plan, vertical, region, health operativo, quick actions y playbook de expansion.",
      proof: tenantSlug ? "La cuenta abre directo en su contexto." : "Superadmin ve cartera completa.",
      tone: "cyan",
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      href: canManageUsers ? "/users" : "/settings",
      label: canManageUsers ? "Usuarios y permisos" : "Permisos del workspace",
      eyebrow: "IAM",
      body: "Alta, roles, permisos por recurso, reset de acceso y control de MFA.",
      proof: canManageUsers ? "Gestionable desde consola." : "Solicitudes visibles sin exponer IAM.",
      tone: "green",
      icon: <Users className="h-5 w-5" />,
    },
    {
      href: "/mfa",
      label: "Seguridad y MFA",
      eyebrow: "Security",
      body: "Segundo factor, postura de sesion y preparacion para acceso enterprise real.",
      proof: sessionSecurityLabel,
      tone: session.mfaVerified ? "green" : "amber",
      icon: <ShieldCheck className="h-5 w-5" />,
    },
    {
      href: `/api-keys${tenantQuery}`,
      label: "API keys y webhooks",
      eyebrow: "Integraciones",
      body: "Conectar ERP, CRM, verificador, proof anchors y streams de eventos externos.",
      proof: tenantSlug ? `Scope: ${tenantSlug}` : "Scope global disponible.",
      tone: "violet",
      icon: <KeyRound className="h-5 w-5" />,
    },
    {
      href: `/subscriptions${tenantQuery}`,
      label: "Plan y facturacion",
      eyebrow: "Revenue",
      body: "Plan contratado, renovacion, uso, upgrade path y alcance comercial del tenant.",
      proof: "MRR, renovacion y expansion en una vista.",
      tone: "cyan",
      icon: <CreditCard className="h-5 w-5" />,
    },
    {
      href: "/leads-tickets",
      label: "Soporte y tickets",
      eyebrow: "Account ops",
      body: "Conversaciones, oportunidades, incidencias y seguimiento comercial.",
      proof: "Soporte conectado al CRM operativo.",
      tone: "amber",
      icon: <LifeBuoy className="h-5 w-5" />,
    },
  ];

  return (
    <main className="space-y-8" data-testid="settings-command-center">
      <SectionHeading
        eyebrow="Configuracion enterprise"
        title={tenantName}
        description="Centro de administracion del workspace: cuenta, miembros, seguridad, integraciones, plan, soporte y salida segura."
      />

      <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_80%_0%,rgba(34,211,238,.18),transparent_38%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,8,23,.94))] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Cuenta operativa</p>
                <h2 className="mt-2 text-3xl font-black leading-tight text-white">{session.label || tenantName}</h2>
                <p className="mt-1 break-all text-sm text-slate-400">{session.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={session.role === "super-admin" ? "amber" : "cyan"}>{roleLabel(session.role)}</Badge>
                <Badge tone={securityBadgeTone}>{sessionSecurityLabel}</Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Modo</p>
                <p className="mt-2 text-sm font-bold text-white">{workspaceMode}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Tenant</p>
                <p className="mt-2 text-sm font-bold text-white">{tenantSlug || "global"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Permisos</p>
                <p className="mt-2 truncate text-sm font-bold text-white">{permissionSummary(session.permissions)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-[1fr_.75fr]">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-200/30 bg-cyan-300/10 text-cyan-100">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black text-white">Siguiente accion recomendada</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{primaryAction.meta}</p>
                </div>
              </div>
              <Link
                href={primaryAction.href}
                data-testid="settings-primary-action"
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/15 px-4 py-2 text-sm font-black text-cyan-50 transition hover:border-cyan-200/70 hover:bg-cyan-400/24"
              >
                {primaryAction.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Estado de cuenta</p>
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex items-center justify-between gap-3 text-slate-300">
                  <span>Setup</span>
                  <b className="text-white">{setupStatus}</b>
                </p>
                <p className="flex items-center justify-between gap-3 text-slate-300">
                  <span>Sesion</span>
                  <b className="text-white">{isClerkSuperAdminSession ? "Google SSO + nexID" : "nexID session"}</b>
                </p>
                <p className="flex items-center justify-between gap-3 text-slate-300">
                  <span>Perfil</span>
                  <b className="text-white">{roleLabel(session.role)}</b>
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5" data-testid="settings-session-actions">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Acciones de cuenta</p>
          <h2 className="mt-2 text-2xl font-black text-white">Administracion clara, no escondida.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Desde aca un admin puede volver al tablero, cambiar de perfil, revisar seguridad y cerrar sesion sin depender de menus flotantes.
          </p>

          <div className="mt-5 grid gap-2 text-sm">
            <Link
              href="/"
              className="flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 font-bold text-slate-100 transition hover:border-cyan-300/40 hover:text-cyan-100"
            >
              Volver al dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <SecureDashboardLogoutButton
              clerkEnabled={clerkEnabled}
              label="Cambiar cuenta o perfil"
              pendingLabel="Cerrando cuenta..."
              testId="settings-change-account"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 font-bold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-400/16 disabled:cursor-wait disabled:opacity-70"
            />
            <Link
              href={tenantHref}
              className="flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 font-bold text-slate-100 transition hover:border-cyan-300/40 hover:text-cyan-100"
            >
              Ver workspace asociado
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/proof"
              className="flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 font-bold text-slate-100 transition hover:border-emerald-300/40 hover:text-emerald-100"
            >
              Abrir Proof Verifier
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo-lab"
              className="flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 font-bold text-slate-100 transition hover:border-cyan-300/40 hover:text-cyan-100"
            >
              Abrir Demo Lab
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5">
            <SecureDashboardLogoutButton
              clerkEnabled={clerkEnabled}
              testId="settings-logout"
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:bg-slate-900/80 ${toneClasses[tile.tone]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-slate-950/45 text-current">
                {tile.icon}
              </span>
              <Badge tone={tile.tone === "rose" ? "red" : tile.tone}>{tile.eyebrow}</Badge>
            </div>
            <h3 className="mt-4 text-lg font-black text-white group-hover:text-cyan-100">{tile.label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{tile.body}</p>
            <p className="mt-4 border-t border-white/10 pt-3 text-xs font-bold uppercase tracking-[0.12em] text-current">{tile.proof}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
