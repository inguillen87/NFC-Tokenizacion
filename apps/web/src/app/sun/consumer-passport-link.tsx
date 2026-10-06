"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useSunLocale } from "./sun-locale-provider";

const copy = {
  "es-AR": { open: "Mis productos y avisos", preparing: "Preparando acceso…", failed: "No pudimos preparar el acceso. Podés reintentar o abrir tus productos guardados.", retry: "Reintentar acceso", freshRequired: "Esta lectura ya no permite preparar el acceso. Acercá de nuevo el teléfono a la etiqueta. También podés consultar tus productos guardados.", newReading: "Nueva lectura necesaria", readOnly: "Abrir mis productos guardados" },
  en: { open: "My products and notices", preparing: "Preparing access…", failed: "We could not prepare access. You can retry or open your saved products.", retry: "Retry access", freshRequired: "This reading can no longer prepare access. Tap the tag again with your phone. You can also view your saved products.", newReading: "New reading needed", readOnly: "Open my saved products" },
  "pt-BR": { open: "Meus produtos e avisos", preparing: "Preparando acesso…", failed: "Não foi possível preparar o acesso. Você pode tentar novamente ou abrir seus produtos salvos.", retry: "Tentar acesso novamente", freshRequired: "Esta leitura não permite mais preparar o acesso. Aproxime o celular da etiqueta novamente. Você também pode consultar seus produtos salvos.", newReading: "Nova leitura necessária", readOnly: "Abrir meus produtos salvos" },
} as const;

type HandoffContext = {
  active: boolean;
  href: string;
  eventId: string;
  freshToken: string;
  request: { controller: AbortController; timer: number; allowFeedbackFocus: boolean; releaseFocusTracking: () => void } | null;
};

// The URL carries a reference, never the fresh capability. A deliberate click
// transfers that capability to a short-lived HttpOnly, event-scoped cookie.
// Preparing navigation does not save, enroll or claim anything.
export function ConsumerTapLink({ href, eventId, freshToken, children, className }: { href: string; eventId: string; freshToken: string; children: ReactNode; className?: string }) {
  const { locale } = useSunLocale();
  const labels = copy[locale];
  const router = useRouter();
  const context = useRef<HandoffContext | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const focusFeedback = useRef(false);
  const feedbackId = useId();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<"retryable" | "fresh_required" | null>(null);
  useEffect(() => {
    const current: HandoffContext = { active: true, href, eventId, freshToken, request: null };
    context.current = current;
    setReady(true);
    setPending(false);
    setFailure(null);
    focusFeedback.current = false;
    return () => {
      current.active = false;
      if (current.request) {
        window.clearTimeout(current.request.timer);
        current.request.controller.abort();
        current.request.releaseFocusTracking();
      }
    };
  }, [href, eventId, freshToken]);
  useEffect(() => {
    if (failure && focusFeedback.current && (document.activeElement === button.current || document.activeElement === document.body)) feedback.current?.focus();
    focusFeedback.current = false;
  }, [failure]);
  async function prepare() {
    const current = context.current;
    if (!ready || !current?.active || current.request || failure === "fresh_required"
      || current.href !== href || current.eventId !== eventId || current.freshToken !== freshToken) return;
    const controller = new AbortController();
    const request = {
      controller,
      timer: window.setTimeout(() => controller.abort(), 8000),
      allowFeedbackFocus: document.activeElement === button.current,
      releaseFocusTracking: () => {},
    };
    const focusMoved = (event: Event) => {
      if (event.target !== button.current && !button.current?.contains(event.target as Node)) request.allowFeedbackFocus = false;
    };
    document.addEventListener("focusin", focusMoved);
    document.addEventListener("pointerdown", focusMoved);
    request.releaseFocusTracking = () => {
      document.removeEventListener("focusin", focusMoved);
      document.removeEventListener("pointerdown", focusMoved);
    };
    current.request = request;
    const isCurrent = () => current.active && context.current === current && current.request === request;
    const showFailure = (nextFailure: "retryable" | "fresh_required") => {
      focusFeedback.current = request.allowFeedbackFocus;
      setFailure(nextFailure);
    };
    setPending(true);
    setFailure(null);
    try {
      const response = await fetch("/api/consumer/tap-handoff", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, freshToken }), signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!isCurrent()) return;
      if (controller.signal.aborted) throw new Error("handoff_unavailable");
      if (response.status === 400 && result?.ok === false && result?.error === "tap_handoff_invalid_or_expired") {
        showFailure("fresh_required");
        return;
      }
      if (!response.ok || result?.ok !== true || result?.eventId !== eventId) throw new Error("handoff_unavailable");
      router.push(href);
    } catch {
      if (isCurrent()) showFailure("retryable");
    } finally {
      window.clearTimeout(request.timer);
      request.releaseFocusTracking();
      if (isCurrent()) {
        current.request = null;
        setPending(false);
      }
    }
  }
  if (!freshToken || !/^\/me(?:[/?#]|$)/.test(href)) return <Link prefetch={false} href={href} className={className}>{children}</Link>;
  return <div data-testid="consumer-passport-handoff">
    <button ref={button} type="button" className={className} onClick={() => void prepare()} disabled={!ready || pending || failure === "fresh_required"} aria-busy={!ready || pending} aria-describedby={failure ? feedbackId : undefined}>{pending ? labels.preparing : failure === "fresh_required" ? labels.newReading : failure === "retryable" ? labels.retry : children}</button>
    {failure && <div ref={feedback} id={feedbackId} role="alert" tabIndex={-1} data-handoff-failure={failure} className="mt-2 rounded-lg text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><p>{failure === "fresh_required" ? labels.freshRequired : labels.failed}</p><Link prefetch={false} href="/me/products" className="sun-account-entry inline-flex min-h-11 items-center underline">{labels.readOnly}</Link></div>}
  </div>;
}

export function ConsumerPassportLink(props: { href: string; eventId: string; freshToken: string }) {
  const { locale } = useSunLocale();
  return <div data-testid="consumer-passport-primary"><ConsumerTapLink {...props} className="sun-account-entry flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-cyan-300/25 px-3 py-2 text-left text-xs font-bold text-cyan-100 disabled:opacity-60"><span>{copy[locale].open}</span><ChevronRight size={16} aria-hidden="true" /></ConsumerTapLink></div>;
}
