"use client";

import { useState } from "react";
import { Button } from "@product/ui";

export function ForgotPasswordPanel({
  emailPlaceholder,
  actionLabel,
  deliveryEnabled,
}: {
  emailPlaceholder: string;
  actionLabel: string;
  deliveryEnabled: boolean;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!deliveryEnabled) {
      setMessage("La recuperacion automatica no esta habilitada. Contacta al administrador de tu tenant.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setMessage("Ingresa un correo valido.");
      return;
    }

    setPending(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);

    if (!res) {
      setPending(false);
      setMessage("No se pudo contactar el servicio de recuperacion. Contacta al administrador del tenant.");
      return;
    }

    const data = await res.json().catch(() => null);
    const deliveryStatus = String(data?.deliveryStatus || data?.delivery?.status || "").toLowerCase();
    setPending(false);
    setMessage(
      res.ok && ["sent", "delivered", "queued"].includes(deliveryStatus)
        ? "Si la cuenta existe, el proveedor de entrega acepto la solicitud. Revisa el canal configurado."
        : "No hay confirmacion de entrega del reset. Contacta al administrador del tenant; no se emitio ningun envio desde esta pantalla.",
    );
  }

  return (
    <div className="mt-6 grid gap-3">
      <input
        suppressHydrationWarning
        disabled={!deliveryEnabled || pending}
        type="email"
        autoComplete="email"
        className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        placeholder={emailPlaceholder}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button className="w-full" disabled={!deliveryEnabled || pending} onClick={submit}>
        {!deliveryEnabled ? "Recuperacion no disponible" : pending ? "Solicitando..." : actionLabel}
      </Button>
      {!deliveryEnabled ? (
        <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
          No existe un proveedor de email o SMS confirmado para este despliegue. Solicita el cambio de acceso a un administrador del tenant.
        </p>
      ) : null}
      {message ? <p className="text-xs text-cyan-200">{message}</p> : null}
    </div>
  );
}
