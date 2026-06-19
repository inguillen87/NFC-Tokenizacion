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
      className="hidden items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-60 md:flex"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      {pending ? "Saliendo" : "Salir"}
    </button>
  );
}
