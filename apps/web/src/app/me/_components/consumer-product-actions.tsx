"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareText, Wine } from "lucide-react";
import { fetchConsumerJson } from "./consumer-bounded-fetch";
import { consumerFeedbackAvailability, CONSUMER_FEEDBACK_UNAVAILABLE, type ConsumerFeedbackAvailability } from "./consumer-feedback-policy";
import { consumerSommelierAvailability, consumerSommelierEventId, type ConsumerSommelierAvailability } from "../sommelier/consumer-sommelier-scope";

/** One current, uncached publication read per open account product. Both
 * destinations independently recheck evidence, tenant and current permission. */
export function ConsumerProductActions({ eventId, tenant, href, className }: { eventId: string; tenant: string; href: string; className?: string }) {
  const [resolved, setResolved] = useState<{ eventId: string; tenant: string; feedback: ConsumerFeedbackAvailability; sommelier: ConsumerSommelierAvailability } | null>(null);
  const canonicalEvent = consumerSommelierEventId(eventId);
  const validTenant = /^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenant) ? tenant : null;
  const current = canonicalEvent && validTenant && resolved?.eventId === canonicalEvent && resolved.tenant === validTenant ? resolved : null;
  const feedback = current?.feedback ?? "checking";
  useEffect(() => {
    setResolved(null);
    if (!canonicalEvent || !validTenant) return;
    let active = true;
    let controller: AbortController | null = null;
    let busy = false, lastStarted = 0;
    const refresh = () => {
      // A focus/visibility pair shares one bounded read; no background polling.
      if (!active || busy || document.visibilityState !== "visible" || Date.now() - lastStarted < 750) return;
      busy = true; lastStarted = Date.now(); setResolved(null);
      const requestController = new AbortController(); controller = requestController;
      let deadlineSignal: AbortSignal | null | undefined;
      const abortAtDeadline = () => requestController.abort();
      void fetchConsumerJson(`/api/public/passport/${encodeURIComponent(canonicalEvent)}/configuration`, {
        method: "GET", cache: "no-store", credentials: "omit", redirect: "error",
      }, { fetchImpl: (url, init) => {
        deadlineSignal = init?.signal;
        if (deadlineSignal?.aborted) requestController.abort();
        else deadlineSignal?.addEventListener("abort", abortAtDeadline, { once: true });
        return fetch(url, { ...init, signal: requestController.signal });
      } }).then(result => {
        if (!active) return;
        const body = result.status === "ready" && result.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data as Record<string, unknown> : null;
        const configuration = body?.ok === true ? body.configuration : null;
        setResolved({ eventId: canonicalEvent, tenant: validTenant,
          feedback: consumerFeedbackAvailability(configuration, validTenant),
          sommelier: consumerSommelierAvailability(configuration, validTenant) });
      }).finally(() => { busy = false; deadlineSignal?.removeEventListener("abort", abortAtDeadline); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false; controller?.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [canonicalEvent, validTenant]);
  if (!canonicalEvent || !validTenant) return <p role="status">{CONSUMER_FEEDBACK_UNAVAILABLE.unavailable}</p>;
  return <>
    {feedback === "available"
      ? <Link prefetch={false} className={className} href={href}><MessageSquareText size={17} aria-hidden="true" />Compartir experiencia</Link>
      : <p role="status">{CONSUMER_FEEDBACK_UNAVAILABLE[feedback]}</p>}
    {current?.sommelier === "available" && <Link prefetch={false} className={className} href={`/me/sommelier?eventId=${encodeURIComponent(canonicalEvent)}`}><Wine size={17} aria-hidden="true" />Asistente de vinos</Link>}
  </>;
}
