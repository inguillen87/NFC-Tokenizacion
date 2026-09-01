"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@product/ui";
import { ArrowRight, Building2, CheckCircle2, CircleAlert, KeyRound, LockKeyhole, ShieldCheck, UserCheck } from "lucide-react";
import type { PublicAccessProfile } from "../lib/access-profiles";
import { ClerkGoogleSuperAdminButton } from "./clerk-google-super-admin-button";

type Props = {
  emailPlaceholder: string;
  passwordPlaceholder: string;
  loginAction: string;
  registerLabel: string;
  forgotLabel: string;
  inviteLabel: string;
  profiles: PublicAccessProfile[];
  bodegaDemoAllowed: boolean;
  clerkEnabled?: boolean;
  authNotice?: string;
};

export function LoginFormPanel({
  emailPlaceholder,
  passwordPlaceholder,
  loginAction,
  registerLabel,
  forgotLabel,
  inviteLabel,
  profiles,
  bodegaDemoAllowed,
  clerkEnabled,
  authNotice,
}: Props) {
  const LOGIN_TIMEOUT_MS = 10_000;
  const firstAvailable = profiles.find((profile) => profile.available) || profiles[0];
  const hasAvailableProfiles = profiles.some((profile) => profile.available);
  const [email, setEmail] = useState(firstAvailable?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(firstAvailable?.role || "tenant-admin");
  const [profileLabel, setProfileLabel] = useState(firstAvailable?.label || "Perfil operativo");
  const [status, setStatus] = useState("");
  const [opsStatus, setOpsStatus] = useState("");
  const [pending, setPending] = useState(false);
  const accessPaths = [
    {
      label: "Demo tenant",
      value: bodegaDemoAllowed ? "Lista para mostrar" : "Pendiente",
      detail: "Bodega Balmec abre CRM, mapa de eventos reportados, proof, marketplace y campañas sin permisos globales.",
      ok: bodegaDemoAllowed,
    },
    {
      label: "Super Admin",
      value: clerkEnabled ? "Google configurado" : "Setup pendiente",
      detail: "La presencia de configuración habilita el intento; solo una sesión verificada y un email fundador allowlisted conceden acceso global.",
      ok: Boolean(clerkEnabled),
    },
    {
      label: "Equipo operativo",
      value: hasAvailableProfiles ? "Credenciales activas" : "Manual",
      detail: "Admins y empleados entran con cuentas tenant; no usan el portal consumidor.",
      ok: hasAvailableProfiles,
    },
  ];

  function formatDiagnostics(input: unknown) {
    if (!input || typeof input !== "object") return "";
    const diagnostics = input as Record<string, unknown>;
    const missingEnvNames = Array.isArray(diagnostics.missingEnvNames)
      ? diagnostics.missingEnvNames.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
    const parts: string[] = [];
    if (diagnostics.apiBaseConfigured === false) parts.push("API base no configurada.");
    if (diagnostics.upstreamReachable === false) parts.push("Upstream auth no disponible.");
    if (diagnostics.demoLoginAllowed === false) parts.push("Acceso temporal deshabilitado.");
    if (missingEnvNames.length) parts.push(`Faltan env: ${missingEnvNames.join(", ")}`);
    return parts.join(" ");
  }

  function useProfile(profile: PublicAccessProfile) {
    setEmail(profile.email);
    setPassword("");
    setRole(profile.role);
    setProfileLabel(profile.label);
    setStatus("");
    setOpsStatus("");
  }

  async function submit(input?: { email?: string; password?: string }) {
    setPending(true);
    setStatus("");
    setOpsStatus("");
    const loginEmail = input?.email ?? email;
    const loginPassword = input?.password ?? password;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
    const res = await fetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      const diagnosticsNote = formatDiagnostics(data?.diagnostics);
      if (diagnosticsNote) setOpsStatus(diagnosticsNote);
      if (res?.status === 502) {
        setStatus("Servicio de autenticación no disponible temporalmente.");
      } else if (res?.status === 403) {
        setStatus("Acceso denegado por política y alcance del entorno.");
      } else if (res?.status === 401) {
        setStatus("Credenciales inválidas.");
      } else if (res?.status && res.status >= 500) {
        setStatus("Error interno al autenticar.");
      } else if (!res) {
        setStatus("El login tardo demasiado o no hubo respuesta. Reintenta en unos segundos.");
      } else {
        setStatus(data?.reason || "Credenciales inválidas.");
      }
      setPending(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div data-testid="login-enterprise-access-panel" className="dashboard-auth-access-flow">
      <div data-testid="login-access-status" className="dashboard-auth-access-status mb-3 grid gap-2 sm:grid-cols-3">
        {accessPaths.map((item) => (
          <div
            key={item.label}
            data-state={item.ok ? "ready" : "attention"}
            className={`rounded-2xl border px-3 py-3 ${
              item.ok
                ? "border-emerald-300/20 bg-emerald-400/10"
                : "border-amber-300/24 bg-amber-400/10"
            } dashboard-auth-status-card`}
          >
            <div className="flex items-center gap-2">
              {item.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
              ) : (
                <CircleAlert className="h-4 w-4 shrink-0 text-amber-200" />
              )}
              <p className="min-w-0 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{item.label}</p>
            </div>
            <p className="mt-2 text-sm font-black text-white">{item.value}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="dashboard-auth-primary-actions grid gap-3">
        <div data-testid="login-bodega-demo-card" className="dashboard-auth-feature-card rounded-2xl border border-cyan-300/25 p-4 shadow-[0_20px_70px_rgba(8,145,178,0.18)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-300/10 text-cyan-100">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Demo comercial autorizada</p>
                <h2 className="mt-1 text-xl font-black text-white">Bodega Balmec</h2>
                <p className="mt-1 text-sm leading-5 text-slate-300">
                  Entrada directa para mostrar el tenant completo: CRM, mapa de eventos reportados, tags, campañas, proof y marketplace sin tocar Super Admin.
                </p>
              </div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bodegaDemoAllowed ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-amber-300/30 bg-amber-400/10 text-amber-100"}`}>
              {bodegaDemoAllowed ? "habilitado 12h" : "requiere env"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            {bodegaDemoAllowed ? (
              <Link
                href="/api/session/demo?role=tenant-admin"
                prefetch={false}
                data-testid="login-bodega-demo-button"
                title="Entrar como Bodega Balmec"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_18px_50px_rgba(34,211,238,.22)] transition hover:bg-cyan-200"
              >
                <span>Entrar como Bodega Balmec</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-3 text-sm text-amber-100">
                Demo Bodega Balmec deshabilitada en este entorno.
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-100/80">
              <span className="dashboard-auth-feature-chip rounded-lg border border-white/10 bg-white/5 px-2 py-2">Tenant</span>
              <span className="dashboard-auth-feature-chip rounded-lg border border-white/10 bg-white/5 px-2 py-2">Eventos demo</span>
              <span className="dashboard-auth-feature-chip rounded-lg border border-white/10 bg-white/5 px-2 py-2">CRM</span>
            </div>
          </div>
        </div>

        <div data-testid="login-superadmin-google-card" className="dashboard-auth-panel dashboard-auth-panel--elevated grid gap-3 rounded-2xl border border-cyan-300/20 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Super Admin fundador</p>
              <p className="mt-1 text-sm leading-5 text-slate-300">
                Google prueba identidad. nexID emite sesión Super Admin solo si el email está en allowlist server-side.
                La demo Bodega no otorga permisos globales.
              </p>
            </div>
          </div>
          {authNotice ? (
            <p className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100">
              {authNotice}
            </p>
          ) : null}
          {clerkEnabled ? (
            <>
              <ClerkGoogleSuperAdminButton label="Continuar con Google allowlisted" />
              <Link
                href="/sign-in"
                title="Abrir la pantalla completa de Google/Clerk si el flujo redirect no aparece."
                className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100"
              >
                Abrir login seguro en pantalla completa
              </Link>
            </>
          ) : (
            <p data-testid="login-clerk-config-warning" className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
              Google/Clerk todavía no está activo en este entorno: faltan claves Clerk live o no están asociadas a este deploy.
            </p>
          )}
        </div>
      </div>

      <div data-testid="login-credentials-panel" className="dashboard-auth-panel dashboard-auth-panel--soft mt-4 rounded-2xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Credenciales de tenant y equipo</p>
            <p className="mt-1 text-xs text-slate-400">Para empleados, operadores y admins de empresa. Super Admin entra por Google/Clerk.</p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              hasAvailableProfiles
                ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                : "border-amber-300/30 bg-amber-400/10 text-amber-100"
            }`}
          >
            {hasAvailableProfiles ? "presets activos" : "sin presets locales"}
          </span>
        </div>
        <div className="mt-4 grid gap-3">
          {profiles.map((profile) => (
            <button suppressHydrationWarning
              key={profile.key}
              type="button"
              disabled={!profile.available}
              data-availability={profile.available ? "available" : "unavailable"}
              onClick={() => useProfile(profile)}
              title={profile.available ? `Entrar como ${profile.label}` : `${profile.label}: requiere configuración server-side`}
              className="dashboard-auth-profile-card group rounded-xl border border-white/10 p-3 text-left transition hover:border-cyan-300/30 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-200 group-disabled:text-slate-500">
                  {profile.role === "super-admin" ? <LockKeyhole className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span data-profile-title className="text-sm font-semibold">{profile.label}</span>
                    <span className="dashboard-auth-profile-availability">
                      {profile.available ? "Disponible" : "No configurado"}
                    </span>
                  </span>
                  <span data-profile-credential className="mt-1 block text-xs">
                    {profile.email || "Configurar en variables de entorno del server"}
                  </span>
                </span>
              </div>
              <p data-profile-note className="mt-2 text-xs">{profile.note}</p>
            </button>
          ))}
        </div>
      </div>

      {!hasAvailableProfiles ? (
        <p className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          Los presets solo muestran perfiles habilitados. La contraseña queda server-side y se ingresa manualmente o por Google/Clerk.
        </p>
      ) : null}

      <form
        className="dashboard-auth-manual-access mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="dashboard-auth-field-note flex items-start gap-3 rounded-xl border border-white/10 px-3 py-3 text-xs text-slate-300">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
          <span>
            Ingresa con cuenta de <span className="text-cyan-200">dashboard admin</span>. Este login no corresponde al portal de consumidores.
          </span>
        </div>
        <input suppressHydrationWarning
          type="email"
          name="email"
          inputMode="email"
          autoComplete="username"
          className="dashboard-auth-input rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none"
          placeholder={emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input suppressHydrationWarning
          type="password"
          name="password"
          autoComplete="current-password"
          className="dashboard-auth-input rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none"
          placeholder={passwordPlaceholder}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
          TOTP nexID está temporalmente bloqueado. Super Admin usa Google/Clerk allowlisted; las cuentas tenant usan sesión y permisos nexID.
        </p>
        <div className="dashboard-auth-field-note rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300">
          Perfil activo: <span className="text-cyan-200">{profileLabel}</span>
          <span className="ml-2 text-slate-500">({role})</span>
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {loginAction}
        </Button>
        {status ? <p aria-live="polite" className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{status}</p> : null}
        {opsStatus ? <p aria-live="polite" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">{opsStatus}</p> : null}
      </form>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Link href="/register" className="dashboard-auth-secondary-link rounded-lg border border-white/10 px-2 py-2 text-cyan-300">
          {registerLabel}
        </Link>
        <Link href="/forgot-password" className="dashboard-auth-secondary-link rounded-lg border border-white/10 px-2 py-2 text-cyan-300">
          {forgotLabel}
        </Link>
        <Link href="/invite-user" className="dashboard-auth-secondary-link rounded-lg border border-white/10 px-2 py-2 text-cyan-300">
          {inviteLabel}
        </Link>
      </div>
      <div className="mt-2 grid gap-2 text-center text-xs">
        <a href="https://nexid.lat/login" className="rounded-lg border border-cyan-300/20 bg-cyan-500/5 px-2 py-2 text-cyan-200">
          Ir al login del portal consumidor
        </a>
      </div>
    </div>
  );
}
