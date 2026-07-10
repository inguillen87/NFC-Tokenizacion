"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

type SecureDashboardLogoutButtonProps = {
  clerkEnabled?: boolean;
  className?: string;
  label?: string;
  onStart?: () => void;
  pendingLabel?: string;
  testId?: string;
};

const DEFAULT_CLASS_NAME =
  "flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-500/18 disabled:cursor-wait disabled:opacity-70";

function LocalDashboardLogoutButton({
  className = DEFAULT_CLASS_NAME,
  label = "Cerrar sesion segura",
  testId = "dashboard-secure-logout",
}: SecureDashboardLogoutButtonProps) {
  return (
    <form method="post" action="/logout">
      <button type="submit" data-testid={testId} className={className}>
        <LogOut className="h-4 w-4" />
        {label}
      </button>
    </form>
  );
}

function ClerkDashboardLogoutButton({
  className = DEFAULT_CLASS_NAME,
  label = "Cerrar sesion segura",
  onStart,
  pendingLabel = "Cerrando sesion...",
  testId = "dashboard-secure-logout",
}: SecureDashboardLogoutButtonProps) {
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    onStart?.();

    await fetch("/logout", { method: "POST", cache: "no-store" }).catch(() => null);

    try {
      await signOut({ redirectUrl: "/login?logged_out=1" });
    } catch {
      window.location.href = "/login?logged_out=1";
    }
  }

  return (
    <button
      type="button"
      data-testid={testId}
      className={className}
      disabled={pending}
      onClick={() => void handleLogout()}
    >
      <LogOut className="h-4 w-4" />
      {pending ? pendingLabel : label}
    </button>
  );
}

export function SecureDashboardLogoutButton(props: SecureDashboardLogoutButtonProps) {
  if (props.clerkEnabled) return <ClerkDashboardLogoutButton {...props} />;
  return <LocalDashboardLogoutButton {...props} />;
}
