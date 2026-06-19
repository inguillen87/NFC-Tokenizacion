"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

export function ConsumerLogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    await fetch("/api/consumer/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    window.location.assign("/login?next=/me");
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void logout()}
      className="flex items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 md:px-3 md:py-2 text-[11px] font-black uppercase tracking-wider text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-60"
      title={pending ? "Saliendo" : "Salir"}
    >
      <LogOut className="h-4 w-4 md:h-3.5 md:w-3.5" aria-hidden="true" />
      <span className="hidden md:inline">{pending ? "Saliendo" : "Salir"}</span>
    </button>
  );
}
