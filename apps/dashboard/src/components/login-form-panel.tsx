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
};

export function LoginFormPanel({ emailPlaceholder, passwordPlaceholder, loginAction, registerLabel, forgotLabel, inviteLabel, profiles }: Props) {
  const LOGIN_TIMEOUT_MS = 10_000;
  const firstAvailable = profiles.find((profile) => profile.available) || profiles[0];
  const [email, setEmail] = useState(firstAvailable?.email || "");
  const [password, setPassword] = useState(firstAvailable?.password || "");
  const [role, setRole] = useState(firstAvailable?.role || "super-admin");
  const [mfaCode, setMfaCode] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

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
      if (data?.mfaRequired) {
        setStatus("Ingresá tu código MFA de 6 dígitos para continuar.");
      } else if (res?.status && res.status >= 500) {
        setStatus("Servicio de autenticación temporalmente no disponible. Usá un preset demo para ingresar igual.");
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

  return (
    <div>
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Quick access presets</p>
        <div className="mt-4 grid gap-3">
          {profiles.map((profile) => (
            <button
              key={profile.key}
              type="button"
              disabled={!profile.available}
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

      <div className="mt-4 grid gap-3">
        <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={emailPlaceholder} value={email} onChange={(event) => setEmail(event.target.value)} />
        <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={passwordPlaceholder} value={password} onChange={(event) => setPassword(event.target.value)} />
        <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="MFA / TOTP code (optional)" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} />
        <div className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300">Role preset: <span className="text-cyan-200">{role}</span></div>
        <Button className="w-full" onClick={submit} disabled={pending}>{loginAction}</Button>
        {status ? <p className="text-sm text-rose-300">{status}</p> : null}
      </div>

      <div className="mt-4 flex justify-between text-xs">
        <Link href="/register" className="text-cyan-300">{registerLabel}</Link>
        <Link href="/forgot-password" className="text-cyan-300">{forgotLabel}</Link>
        <Link href="/invite-user" className="text-cyan-300">{inviteLabel}</Link>
      </div>
    </div>
  );
}
