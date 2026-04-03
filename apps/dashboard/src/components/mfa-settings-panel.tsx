"use client";

import { useState } from "react";
import { Button, Card } from "@product/ui";

export function MfaSettingsPanel() {
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function start() {
    const res = await fetch(`/api/iam/mfa/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const data = await res.json();
    setSecret(data.secret || "");
    setOtpauthUrl(data.otpauthUrl || "");
    setStatus(data.secret ? "Escaneá el secret o cargalo en tu app TOTP y luego validá un código." : "No se pudo iniciar MFA.");
  }

  async function confirm() {
    const res = await fetch(`/api/iam/mfa/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, code }) });
    const data = await res.json();
    setRecoveryCodes(data.recoveryCodes || []);
    setStatus(res.ok ? "MFA habilitado." : (data.reason || "No se pudo habilitar MFA."));
  }

  async function disable() {
    const res = await fetch(`/api/iam/mfa/disable`, { method: "POST" });
    setStatus(res.ok ? "MFA deshabilitado." : "No se pudo deshabilitar MFA.");
    if (res.ok) {
      setSecret("");
      setCode("");
      setRecoveryCodes([]);
      setOtpauthUrl("");
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-white">MFA / TOTP</h2>
      <p className="mt-2 text-sm text-slate-400">Segundo factor con TOTP, recovery codes y setup/deshabilitación autenticados por sesión.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={start}>Iniciar setup</Button>
        <Button onClick={disable}>Deshabilitar</Button>
      </div>
      {secret ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
          <p className="text-slate-200">Secret: <code className="text-cyan-200">{secret}</code></p>
          <p className="break-all text-xs text-slate-400">{otpauthUrl}</p>
          <input className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button className="w-full" onClick={confirm}>Confirmar MFA</Button>
        </div>
      ) : null}
      {recoveryCodes.length ? <div className="mt-4 flex flex-wrap gap-2">{recoveryCodes.map((item) => <code key={item} className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">{item}</code>)}</div> : null}
      {status ? <p className="mt-4 text-xs text-cyan-200">{status}</p> : null}
    </Card>
  );
}
