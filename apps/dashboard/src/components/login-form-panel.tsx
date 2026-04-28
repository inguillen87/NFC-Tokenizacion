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

export function LoginFormPanel({ emailPlaceholder, passwordPlaceholder, loginAction, registerLabel, forgotLabel, inviteLabel, profiles, demoLoginAllowed }: Props) {
  const LOGIN_TIMEOUT_MS = 10_000;
  const firstAvailable = profiles.find((profile) => profile.available) || profiles[0];
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
        setStatus("Ingresá tu código MFA de 6 dígitos para continuar.");
      } else if (res?.status === 502) {
        setStatus("Servicio de autenticación no disponible temporalmente.");
      } else if (res?.status === 403) {
        setStatus("Acceso denegado por política de entorno (demo/scope).");
      } else if (res?.status === 401) {
        setStatus("Credenciales inválidas.");
      } else if (res?.status && res.status >= 500) {
        setStatus("Error interno al autenticar.");
      } else if (!res) {
        setStatus("El login tardó demasiado o no hubo respuesta. Reintentá en unos segundos.");
      } else {
        setStatus(data?.reason || "Credenciales inválidas.");
      }
      setPending(false);
      return;
    }
    window.location.href = "/";
  }

  async function enterReadonlyDemo() {
    setPending(true);
    setStatus("");
    setOpsStatus("");
    const res = await fetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demoLogin: true, demoRole: "viewer" }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      const diagnosticsNote = formatDiagnostics(data?.diagnostics);
      if (diagnosticsNote) setOpsStatus(diagnosticsNote);
      setStatus(data?.reason || "No se pudo iniciar demo readonly.");
      setPending(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div>
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Quick access presets (admin demo)</p>
        <div className="mt-4 grid gap-3">
          {profiles.map((profile) => (
            <button
              key={profile.key}
              type="button"
              disabled={!profile.available || !demoLoginAllowed}
              onClick={() => useProfile(profile)}
              className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-left transition hover:border-emerald-300/30 hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-white">{profile.label}</p>
              <p className="mt-1 text-xs text-cyan-200">{profile.email || "Configurar en variables de entorno del server"}</p>
              <p className="mt-1 text-xs text-slate-400">{profile.note}</p>
            </button>
          ))}
        </div>
      </div>

      {!profiles.some((profile) => profile.available) ? (
        <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          No hay presets disponibles. Configurá SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD (u otros perfiles) en variables de entorno del servidor.
        </p>
      ) : null}

      {!demoLoginAllowed ? (
        <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Presets demo deshabilitados por política del entorno.
        </p>
      ) : null}

      <div className="mt-3">
        <button
          type="button"
          disabled={pending || !demoLoginAllowed}
          onClick={enterReadonlyDemo}
          className="w-full rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Entrar demo solo lectura (sin credenciales)
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
          Ingresá con cuenta de <span className="text-cyan-200">dashboard admin</span>. Este login no corresponde al portal de consumidores.
        </div>
        <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none" placeholder={emailPlaceholder} value={email} onChange={(event) => setEmail(event.target.value)} />
        <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none" placeholder={passwordPlaceholder} value={password} onChange={(event) => setPassword(event.target.value)} />
        <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none" placeholder="MFA / TOTP code (optional)" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} />
        <div className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300">Role preset: <span className="text-cyan-200">{role}</span></div>
        <Button className="w-full" onClick={submit} disabled={pending}>{loginAction}</Button>
        {status ? <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{status}</p> : null}
        {opsStatus ? <p className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">{opsStatus}</p> : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Link href="/register" className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-cyan-300">{registerLabel}</Link>
        <Link href="/forgot-password" className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-cyan-300">{forgotLabel}</Link>
        <Link href="/invite-user" className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-cyan-300">{inviteLabel}</Link>
      </div>
      <div className="mt-2 grid gap-2 text-center text-xs">
        <a href="https://nexid.lat/login" className="rounded-lg border border-cyan-300/20 bg-cyan-500/5 px-2 py-2 text-cyan-200">Ir al login del portal consumidor</a>
      </div>
    </div>
  );
}
