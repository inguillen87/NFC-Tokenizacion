"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useSunLocale } from "./sun-locale-provider";

const copy = {
  "es-AR": { open: "Mis productos y avisos", preparing: "Preparando acceso…", failed: "No pudimos preparar esta lectura. Reintentá antes de continuar.", readOnly: "Abrir mis productos guardados" },
  en: { open: "My products and notices", preparing: "Preparing access…", failed: "We could not prepare this reading. Retry before continuing.", readOnly: "Open my saved products" },
  "pt-BR": { open: "Meus produtos e avisos", preparing: "Preparando acesso…", failed: "Não foi possível preparar esta leitura. Tente novamente antes de continuar.", readOnly: "Abrir meus produtos salvos" },
} as const;

// The URL carries a reference, never the fresh capability. A deliberate click
// transfers that capability to a short-lived HttpOnly, event-scoped cookie.
// Preparing navigation does not save, enroll or claim anything.
export function ConsumerTapLink({ href, eventId, freshToken, children, className }: { href: string; eventId: string; freshToken: string; children: ReactNode; className?: string }) {
  const { locale } = useSunLocale();
  const labels = copy[locale];
  const router = useRouter();
  const inFlight = useRef(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setReady(true); }, []);
  async function prepare() {
    if (!ready || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 8000);
    try {
      const response = await fetch("/api/consumer/tap-handoff", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, freshToken }), signal: abort.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true || result?.eventId !== eventId) throw new Error("handoff_unavailable");
      router.push(href);
    } catch {
      setFailed(true);
    } finally {
      window.clearTimeout(timer);
      inFlight.current = false;
      setPending(false);
    }
  }
  if (!freshToken || !/^\/me(?:[/?#]|$)/.test(href)) return <Link prefetch={false} href={href} className={className}>{children}</Link>;
  return <div data-testid="consumer-passport-handoff">
    <button type="button" className={className} onClick={() => void prepare()} disabled={!ready || pending} aria-busy={!ready || pending}>{pending ? labels.preparing : children}</button>
    {failed && <div role="alert" className="mt-2 text-sm"><p>{labels.failed}</p><Link prefetch={false} href="/me/products" className="sun-account-entry inline-flex min-h-11 items-center underline">{labels.readOnly}</Link></div>}
  </div>;
}

export function ConsumerPassportLink(props: { href: string; eventId: string; freshToken: string }) {
  const { locale } = useSunLocale();
  return <div data-testid="consumer-passport-primary"><ConsumerTapLink {...props} className="sun-account-entry flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-cyan-300/25 px-3 py-2 text-left text-xs font-bold text-cyan-100 disabled:opacity-60"><span>{copy[locale].open}</span><ChevronRight size={16} aria-hidden="true" /></ConsumerTapLink></div>;
}
