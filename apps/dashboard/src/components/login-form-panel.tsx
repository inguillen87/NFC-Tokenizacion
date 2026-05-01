"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@product/ui";
import type { AccessProfile } from "../lib/access-profiles";

type Props = {
  emailPlaceholder: string;
  passwordPlaceholder: string;
  loginAction: string;
  registerLabel: string;
  forgotLabel: string;
  inviteLabel: string;
  profiles: AccessProfile[];
  demoLoginAllowed: boolean;
};

type DemoRole = "super-admin" | "tenant-admin" | "viewer";

const DEMO_ROLES: Array<{
  key: DemoRole;
  title: string;
  label: string;
  description: string;
  tone: string;
}> = [
  {
    key: "super-admin",
    title: "SuperAdmin",
    label: "Entrar como SuperAdmin",
    description: "Tenants, CRM, analiticas, seguridad y operaciones globales.",
    tone: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300/50 hover:bg-emerald-500/15",
  },
  {
    key: "tenant-admin",
    title: "DemoBodega",
    label: "Entrar como DemoBodega",
    description: "Lotes, tags reales, taps, portal de cliente y marketplace.",
    tone: "border-cyan-300/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-300/50 hover:bg-cyan-500/15",
  },
  {
    key: "viewer",
    title: "Auditor",
    label: "Entrar solo lectura",
    description: "Vista segura para revisar sin modificar datos.",
    tone: "border-violet-300/30 bg-violet-500/10 text-violet-100 hover:border-violet-300/50 hover:bg-violet-500/15",
  },
];

export function LoginFormPanel({
  emailPlaceholder,
  passwordPlaceholder,
  loginAction,
  registerLabel,
  forgotLabel,
  inviteLabel,
  profiles,
  demoLoginAllowed,
}: Props) {
  const LOGIN_TIMEOUT_MS = 10_000;
  const firstAvailable = profiles.find((profile) => profile.available) || profiles[0];
  const hasAvailableProfiles = profiles.some((profile) => profile.available);
  const [email, setEmail] = useState(firstAvailable?.email || "");
  const [password, setPassword] = useState(firstAvailable?.password || "");
  const [role, setRole] = useState(firstAvailable?.role || "super-admin");
  const [mfaCode, setMfaCode] = useState("");
  const [status, setStatus] = useState("");
  const [opsStatus, setOpsStatus] = useState("");
  const [pending, setPending] = useState(false);

  function formatDiagnostics(input: unknown) {
    if (!input || typeof input !== "object") return "";
    const diagnostics = input as Record<string, unknown>;
    const missingEnvNames = Array.isArray(diagnostics.missingEnvNames)
      ? diagnostics.missingEnvNames.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
    const parts: string[] = [];
    if (diagnostics.apiBaseConfigured === false) parts.push("API base no configurada.");
    if (diagnostics.upstreamReachable === false) parts.push("Upstream auth no disponible.");
    if (diagnostics.demoLoginAllowed === false) parts.push("Demo login deshabilitado.");
    if (missingEnvNames.length) parts.push(`Faltan env: ${missingEnvNames.join(", ")}`);
    return parts.join(" ");
  }

  function useProfile(profile: AccessProfile) {
    setEmail(profile.email);
    setPassword(profile.password);
    setRole(profile.role);
    setMfaCode("");
    setStatus("");
    setOpsStatus("");
  }

  async function submit() {
    setPending(true);
    setStatus("");
    setOpsStatus("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
    const res = await fetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, mfaCode }),
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      const diagnosticsNote = formatDiagnostics(data?.diagnostics);
      if (diagnosticsNote) setOpsStatus(diagnosticsNote);
      if (data?.mfaRequired) {
        setStatus("Ingresa tu codigo MFA de 6 digitos para continuar.");
      } else if (res?.status === 502) {
        setStatus("Servicio de autenticacion no disponible temporalmente.");
      } else if (res?.status === 403) {
        setStatus("Acceso denegado por politica de entorno (demo/scope).");
      } else if (res?.status === 401) {
        setStatus("Credenciales invalidas.");
      } else if (res?.status && res.status >= 500) {
        setStatus("Error interno al autenticar.");
      } else if (!res) {
        setStatus("El login tardo demasiado o no hubo respuesta. Reintenta en unos segundos.");
      } else {
        setStatus(data?.reason || "Credenciales invalidas.");
      }
      setPending(false);
      return;
    }
    window.location.href = "/";
  }

  async function enterDemoRole(demoRole: DemoRole) {
    setPending(true);
    setStatus("");
    setOpsStatus("");
    const res = await fetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demoLogin: true, demoRole }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      const diagnosticsNote = formatDiagnostics(data?.diagnostics);
      if (diagnosticsNote) setOpsStatus(diagnosticsNote);
      setStatus(data?.reason || "No se pudo iniciar sesion demo.");
      setPending(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div>
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 shadow-[0_18px_60px_rgba(8,145,178,0.16)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Admin demo operativo</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Entrar en 1 click</h2>
            <p className="mt-1 text-sm text-slate-300">Crea una sesion demo por 12h sin depender de credenciales locales.</p>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            listo para preview
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {DEMO_ROLES.map((demoRole) => (
            <button suppressHydrationWarning
              key={demoRole.key}
              type="button"
              disabled={pending || !demoLoginAllowed}
              onClick={() => void enterDemoRole(demoRole.key)}
              className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${demoRole.tone}`}
            >
              <p className="text-sm font-semibold">{demoRole.title}</p>
              <p className="mt-1 text-xs opacity-80">{demoRole.description}</p>
              <span className="mt-3 inline-flex rounded-full border border-current/20 px-2 py-1 text-[11px] font-semibold">
                {demoRole.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {!demoLoginAllowed ? (
        <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Login demo deshabilitado por politica del entorno. Activa DASHBOARD_ALLOW_DEMO_LOGIN para usar accesos 1-click.
        </p>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Presets de credenciales</p>
            <p className="mt-1 text-xs text-slate-400">Opcional: autocompleta usuarios reales si las variables del server estan configuradas.</p>
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
              onClick={() => useProfile(profile)}
              className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-left transition hover:border-cyan-300/30 hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-white">{profile.label}</p>
              <p className="mt-1 text-xs text-cyan-200">{profile.email || "Configurar en variables de entorno del server"}</p>
              <p className="mt-1 text-xs text-slate-400">{profile.note}</p>
            </button>
          ))}
        </div>
      </div>

      {!hasAvailableProfiles ? (
        <p className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          Los presets solo completan email/password. El 1-click demo sigue disponible para preview, QA y reuniones comerciales.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3">
        <div className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
          Ingresa con cuenta de <span className="text-cyan-200">dashboard admin</span>. Este login no corresponde al portal de consumidores.
        </div>
        <input suppressHydrationWarning
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none"
          placeholder={emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input suppressHydrationWarning
          type="password"
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none"
          placeholder={passwordPlaceholder}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <input suppressHydrationWarning
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none"
          placeholder="MFA / TOTP code (optional)"
          value={mfaCode}
          onChange={(event) => setMfaCode(event.target.value)}
        />
        <div className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300">
          Role preset: <span className="text-cyan-200">{role}</span>
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {loginAction}
        </Button>
        {status ? <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{status}</p> : null}
        {opsStatus ? <p className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">{opsStatus}</p> : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Link href="/register" className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-cyan-300">
          {registerLabel}
        </Link>
        <Link href="/forgot-password" className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-cyan-300">
          {forgotLabel}
        </Link>
        <Link href="/invite-user" className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-cyan-300">
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
