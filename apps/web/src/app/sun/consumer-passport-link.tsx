"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useSunLocale } from "./sun-locale-provider";

const copy = {
  "es-AR": { open: "Mis productos y avisos", preparing: "Preparando acceso…", prepared: "Acceso preparado", opening: "Abriendo la página…", slow: "La página está tardando en abrir. Podés volver a abrirla sin repetir la preparación del acceso.", navigationFailed: "No pudimos abrir la página. Podés volver a abrirla sin repetir la preparación del acceso.", reopen: "Volver a abrir la página", failed: "No pudimos preparar el acceso. Podés reintentar o abrir tus productos guardados.", retry: "Reintentar acceso", freshRequired: "Esta lectura ya no permite preparar el acceso. Acercá de nuevo el teléfono a la etiqueta. También podés consultar tus productos guardados.", newReading: "Nueva lectura necesaria", readOnly: "Abrir mis productos guardados" },
  en: { open: "My products and notices", preparing: "Preparing access…", prepared: "Access prepared", opening: "Opening the page…", slow: "The page is taking a while to open. You can open it again without repeating access preparation.", navigationFailed: "We could not open the page. You can open it again without repeating access preparation.", reopen: "Open the page again", failed: "We could not prepare access. You can retry or open your saved products.", retry: "Retry access", freshRequired: "This reading can no longer prepare access. Tap the tag again with your phone. You can also view your saved products.", newReading: "New reading needed", readOnly: "Open my saved products" },
  "pt-BR": { open: "Meus produtos e avisos", preparing: "Preparando acesso…", prepared: "Acesso preparado", opening: "Abrindo a página…", slow: "A página está demorando para abrir. Você pode abri-la novamente sem repetir a preparação do acesso.", navigationFailed: "Não foi possível abrir a página. Você pode abri-la novamente sem repetir a preparação do acesso.", reopen: "Abrir a página novamente", failed: "Não foi possível preparar o acesso. Você pode tentar novamente ou abrir seus produtos salvos.", retry: "Tentar acesso novamente", freshRequired: "Esta leitura não permite mais preparar o acesso. Aproxime o celular da etiqueta novamente. Você também pode consultar seus produtos salvos.", newReading: "Nova leitura necessária", readOnly: "Abrir meus produtos salvos" },
} as const;

type FeedbackFocus = { owner: HandoffContext; permitted: boolean; scrollX: number; scrollY: number; release: () => void };
type HandoffContext = {
  active: boolean;
  href: string;
  eventId: string;
  freshToken: string;
  prepared: boolean;
  navigation: { timer: number } | null;
  request: { controller: AbortController; timer: number; focus: FeedbackFocus } | null;
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
  const focusFeedback = useRef<FeedbackFocus | null>(null);
  const feedbackId = useId();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<"retryable" | "fresh_required" | null>(null);
  const [navigation, setNavigation] = useState<"opening" | "slow" | "failed" | null>(null);
  useEffect(() => {
    const current: HandoffContext = { active: true, href, eventId, freshToken, prepared: false, navigation: null, request: null };
    context.current = current;
    setReady(true);
    setPending(false);
    setFailure(null);
    setNavigation(null);
    return () => {
      current.active = false;
      if (current.request) {
        window.clearTimeout(current.request.timer);
        current.request.controller.abort();
        current.request.focus.release();
      }
      if (current.navigation) window.clearTimeout(current.navigation.timer);
      if (focusFeedback.current?.owner === current) { focusFeedback.current.release(); focusFeedback.current = null; }
    };
  }, [href, eventId, freshToken]);
  useEffect(() => {
    const intent = focusFeedback.current;
    if (!failure || !intent) return;
    focusFeedback.current = null;
    intent.release();
    if (intent.owner.active && context.current === intent.owner && intent.permitted && window.scrollX === intent.scrollX && window.scrollY === intent.scrollY
      && (document.activeElement === button.current || document.activeElement === document.body)) feedback.current?.focus({ preventScroll: true });
  }, [failure]);
  function openPreparedPage(current: HandoffContext) {
    if (!current.active || context.current !== current || !current.prepared) return;
    if (current.navigation) window.clearTimeout(current.navigation.timer);
    const attempt = { timer: 0 };
    current.navigation = attempt;
    setNavigation("opening");
    // A slow route may still commit. This timer only offers navigation recovery;
    // it never unlocks the capability POST or assumes the route has failed.
    attempt.timer = window.setTimeout(() => {
      if (current.active && context.current === current && current.navigation === attempt) setNavigation("slow");
    }, 8000);
    try { router.push(current.href); }
    catch {
      window.clearTimeout(attempt.timer);
      if (current.active && context.current === current && current.navigation === attempt) setNavigation("failed");
    }
  }
  async function prepare() {
    const current = context.current;
    if (!ready || !current?.active || current.request || current.prepared || failure === "fresh_required"
      || current.href !== href || current.eventId !== eventId || current.freshToken !== freshToken) return;
    const controller = new AbortController();
    focusFeedback.current?.release();
    focusFeedback.current = null;
    const focus: FeedbackFocus = { owner: current, permitted: document.activeElement === button.current || document.activeElement === document.body, scrollX: window.scrollX, scrollY: window.scrollY, release: () => {} };
    const request = {
      controller,
      timer: window.setTimeout(() => controller.abort(), 8000),
      focus,
    };
    const focusMoved = (event: Event) => {
      if (event.target !== document.body && event.target !== button.current && !button.current?.contains(event.target as Node)) focus.permitted = false;
    };
    const pointerMoved = (event: Event) => { if (event.target !== button.current && !button.current?.contains(event.target as Node)) focus.permitted = false; };
    const readingMoved = () => { focus.permitted = false; };
    const keyboardMoved = (event: KeyboardEvent) => { if (["Tab", "Escape", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) readingMoved(); };
    document.addEventListener("focusin", focusMoved, true);
    document.addEventListener("pointerdown", pointerMoved, true);
    document.addEventListener("touchmove", readingMoved, { capture: true, passive: true });
    document.addEventListener("keydown", keyboardMoved, true);
    window.addEventListener("wheel", readingMoved, { capture: true, passive: true });
    window.addEventListener("scroll", readingMoved, { capture: true, passive: true });
    focus.release = () => {
      document.removeEventListener("focusin", focusMoved, true);
      document.removeEventListener("pointerdown", pointerMoved, true);
      document.removeEventListener("touchmove", readingMoved, true);
      document.removeEventListener("keydown", keyboardMoved, true);
      window.removeEventListener("wheel", readingMoved, true);
      window.removeEventListener("scroll", readingMoved, true);
    };
    current.request = request;
    const isCurrent = () => current.active && context.current === current && current.request === request;
    const showFailure = (nextFailure: "retryable" | "fresh_required") => {
      focusFeedback.current = focus;
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
      current.prepared = true;
      openPreparedPage(current);
    } catch {
      if (isCurrent()) showFailure("retryable");
    } finally {
      window.clearTimeout(request.timer);
      if (focusFeedback.current !== focus) focus.release();
      if (isCurrent()) {
        current.request = null;
        setPending(false);
      }
    }
  }
  if (!freshToken || !/^\/me(?:[/?#]|$)/.test(href)) return <Link prefetch={false} href={href} className={className}>{children}</Link>;
  return <div data-testid="consumer-passport-handoff">
    <button ref={button} type="button" className={className} onClick={() => void prepare()} disabled={!ready || pending || Boolean(navigation) || failure === "fresh_required"} aria-busy={!ready || pending || navigation === "opening" || navigation === "slow"} aria-describedby={failure || navigation ? feedbackId : undefined}>{navigation === "failed" ? labels.prepared : navigation ? labels.opening : pending ? labels.preparing : failure === "fresh_required" ? labels.newReading : failure === "retryable" ? labels.retry : children}</button>
    {failure && <div ref={feedback} id={feedbackId} role="alert" tabIndex={-1} data-handoff-failure={failure} className="mt-2 rounded-lg text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><p>{failure === "fresh_required" ? labels.freshRequired : labels.failed}</p><Link prefetch={false} href="/me/products" className="sun-account-entry inline-flex min-h-11 items-center underline">{labels.readOnly}</Link></div>}
    {navigation && <div id={feedbackId} role="status" aria-live="polite" aria-atomic="true" data-handoff-navigation={navigation} className="mt-2 rounded-lg text-sm"><p>{navigation === "slow" ? labels.slow : navigation === "failed" ? labels.navigationFailed : labels.opening}</p>{navigation !== "opening" && <button type="button" className="sun-account-entry inline-flex min-h-11 items-center underline" onClick={() => { const current = context.current; if (current) openPreparedPage(current); }}>{labels.reopen}</button>}</div>}
  </div>;
}

export function ConsumerPassportLink(props: { href: string; eventId: string; freshToken: string }) {
  const { locale } = useSunLocale();
  return <div data-testid="consumer-passport-primary"><ConsumerTapLink {...props} className="sun-account-entry flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-cyan-300/25 px-3 py-2 text-left text-xs font-bold text-cyan-100 disabled:opacity-60"><span>{copy[locale].open}</span><ChevronRight size={16} aria-hidden="true" /></ConsumerTapLink></div>;
}
