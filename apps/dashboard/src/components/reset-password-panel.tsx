"use client";

import { useState } from "react";
import { Button } from "@product/ui";
import { useSearchParams } from "next/navigation";


export function ResetPasswordPanel({ passwordPlaceholder, actionLabel }: { passwordPlaceholder: string; actionLabel: string }) {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");

  async function submit() {
    if (!token || password.length < 8 || password !== confirm) {
      setStatus("Verificá token, contraseña de 8+ caracteres y confirmación.");
      return;
    }
    const res = await fetch(`/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => null);
    setStatus(res.ok ? "Contraseña actualizada. Volvé a iniciar sesión." : (data?.reason || "No se pudo restablecer la contraseña."));
  }

  return (
    <div className="mt-6 grid gap-3">
      <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Reset token" value={token} onChange={(e) => setToken(e.target.value)} />
      <input suppressHydrationWarning type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={passwordPlaceholder} value={password} onChange={(e) => setPassword(e.target.value)} />
      <input suppressHydrationWarning type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button className="w-full" onClick={submit}>{actionLabel}</Button>
      {status ? <p className="text-xs text-cyan-200">{status}</p> : null}
    </div>
  );
}
