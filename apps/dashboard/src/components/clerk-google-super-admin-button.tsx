"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs/legacy";
import { normalizeDashboardReturnPath } from "../lib/dashboard-return-path";

type Props = {
  className?: string;
  label?: string;
  compact?: boolean;
  nextPath?: string;
};

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "No se pudo iniciar Google OAuth. Reintenta en unos segundos.";
  const maybeErrors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
  const first = Array.isArray(maybeErrors) ? maybeErrors[0] : null;
  return first?.longMessage || first?.message || "No se pudo iniciar Google OAuth. Revisa que Google este habilitado en Clerk.";
}

function isAlreadySignedIn(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("already signed in") || message.includes("ya iniciaste sesion") || message.includes("ya estas conectado");
}

export function ClerkGoogleSuperAdminButton({
  className,
  label = "Entrar con Google como Super Admin",
  compact,
  nextPath = "/",
}: Props) {
  const { isLoaded, signIn } = useSignIn();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const safeNextPath = normalizeDashboardReturnPath(nextPath);

  async function startGoogleOauth() {
    if (!isLoaded || !signIn || pending) return;
    setPending(true);
    setError("");

    try {
      const origin = window.location.origin;
      const completeUrl = new URL("/auth/clerk/super-admin", origin);
      completeUrl.searchParams.set("next", safeNextPath);
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${origin}/sso-callback`,
        redirectUrlComplete: completeUrl.toString(),
        continueSignIn: true,
      });
    } catch (err) {
      if (isAlreadySignedIn(err)) {
        window.location.assign(`/auth/clerk/super-admin?next=${encodeURIComponent(safeNextPath)}`);
        return;
      }
      setPending(false);
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className={compact ? "grid gap-2" : "grid gap-3"}>
      <div id="clerk-captcha" className="empty:hidden" />
      <button
        type="button"
        title="Entrar como Super Admin con Google, Clerk y allowlist server-side de nexID."
        onClick={() => void startGoogleOauth()}
        disabled={!isLoaded || pending}
        className={
          className ||
          "dashboard-auth-oauth-button flex w-full items-center justify-center gap-3 rounded-xl border border-cyan-400/35 px-4 py-3 text-sm font-bold shadow-[0_18px_40px_rgba(6,182,212,0.12)] transition disabled:cursor-wait disabled:opacity-70"
        }
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-slate-950">
          G
        </span>
        {pending ? "Abriendo Google..." : label}
      </button>
      {error ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}
