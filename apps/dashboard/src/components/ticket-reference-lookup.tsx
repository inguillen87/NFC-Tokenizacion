"use client";

import React, { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { TicketLookupLocale } from "../lib/ticket-reference-lookup";
import { useTicketReferenceLookup } from "../lib/use-ticket-reference-lookup";
import { ticketLookupCopy } from "../lib/ticket-reference-lookup-copy";
import { projectSupportTicket } from "../lib/support-ticket-projection";
import { SupportTicketDetails } from "./support-ticket-details";
import { TicketWorkflow } from "./ticket-workflow";

export type TicketReferenceLookupHandle = { open: (reference: string) => boolean; isNavigationLocked: () => boolean };

export const TicketReferenceLookup = forwardRef<TicketReferenceLookupHandle, {
  tenantScope: string; locale?: TicketLookupLocale; isDemo?: boolean; canLookup?: boolean; onNavigationLockChange?: (locked: boolean) => void;
}>(function TicketReferenceLookup({ tenantScope, locale = "es-AR", isDemo = false, canLookup = false, onNavigationLockChange }, ref) {
  const copy = ticketLookupCopy[locale];
  const inputId = useId();
  const lookup = useTicketReferenceLookup(tenantScope, isDemo, canLookup, onNavigationLockChange);
  const { context, reference, state, locked } = lookup;
  const section = useRef<HTMLElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useImperativeHandle(ref, () => ({
    open(value) {
      if (!lookup.open(value, true)) return false;
      setFocusRequest(value => value + 1);
      return true;
    },
    isNavigationLocked: lookup.isLocked,
  }));
  useEffect(() => { if (focusRequest) section.current?.focus(); }, [focusRequest]);
  function search(event: React.FormEvent) {
    event.preventDefault();
    lookup.open(reference);
  }
  const ticket = state.status === "found" ? state.ticket : null;
  const projection = ticket ? projectSupportTicket(ticket) : null;
  const category = ticket && typeof ticket.category === "string" && ["tap_review", "seal_opened", "product_problem", "other"].includes(ticket.category) ? copy[ticket.category as "other"] : null;
  const statusLabel = ticket && ["open", "pending", "closed"].includes(String(ticket.status)) ? copy[ticket.status as "open"]
    : ticket && typeof ticket.status === "string" && ticket.status.trim() ? ticket.status : copy.unknownStatus;
  return (
    <section ref={section} tabIndex={-1} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500" data-testid="ticket-reference-lookup" aria-labelledby={`${inputId}-heading`}>
      <h3 id={`${inputId}-heading`} className="text-lg font-bold text-white">{copy.title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{copy.hint}</p>
      <p className="mt-2 break-words text-xs text-slate-400">{tenantScope ? `${copy.scope}: ${tenantScope}` : copy.global}</p>
      {isDemo || !canLookup ? <p className="mt-4 text-sm text-slate-300" role="status">{isDemo ? copy.demo : copy.denied}</p> : (
        <form onSubmit={search} className="mt-5 space-y-3">
          <label htmlFor={inputId} className="block text-sm font-semibold text-slate-200">{copy.label}</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input id={inputId} value={reference} disabled={locked} maxLength={64} autoComplete="off" spellCheck={false} autoCapitalize="none" aria-invalid={state.status === "invalid"} aria-describedby={`${inputId}-result`} onChange={event => lookup.edit(event.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-white/20 bg-slate-950 px-3 py-2 font-mono text-sm text-white sm:flex-1 disabled:opacity-60" />
            <button type="submit" disabled={locked || state.status === "loading"} className="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-5 py-2 font-semibold text-cyan-100 disabled:opacity-60">{state.status === "unconfirmed" ? copy.retry : copy.search}</button>
            {state.status === "loading" ? <button type="button" onClick={() => lookup.reset()} className="min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-200">{copy.cancel}</button> : null}
          </div>
        </form>
      )}
      <div id={`${inputId}-result`} role="status" aria-live="polite" aria-atomic="true" className="mt-4 text-sm leading-6 text-slate-300" data-lookup-state={state.status}>
        {state.status !== "idle" ? <p>{copy[state.status]}</p> : null}
        {state.reference ? <p className="mt-1 break-all font-mono text-xs">{copy.reference}: {state.reference}</p> : null}
      </div>
      {ticket && projection ? (
        <article className="mt-4 min-w-0 rounded-xl border border-white/10 bg-slate-950/60 p-4" data-testid="ticket-lookup-result">
          <h4 className="break-words text-base font-bold text-white">{typeof ticket.title === "string" && ticket.title.trim() ? ticket.title : copy.untitled}</h4>
          <SupportTicketDetails ticket={projection} locale={locale} />
          {ticket.detail_state !== "available" ? <p className="mt-4 text-sm text-slate-300">{ticket.detail_state === "unavailable" ? copy.detailUnavailable : copy.detailMissing}</p> : null}
          <dl className="mt-4 space-y-3 text-sm text-slate-300">
            <div><dt className="font-semibold">{copy.status}</dt><dd>{statusLabel}</dd></div>
            <div><dt className="font-semibold">{copy.created}</dt><dd><time dateTime={String(ticket.created_at)}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(String(ticket.created_at)))} UTC</time></dd></div>
            <div><dt className="font-semibold">{copy.tenant}</dt><dd className="break-all">{String(ticket.tenant_name || ticket.tenant_slug || copy.noContact)}</dd></div>
            {category ? <div><dt className="font-semibold">{copy.category}</dt><dd>{category}</dd></div> : null}
            <div><dt className="font-semibold">{copy.contact}</dt><dd className="break-all">{projection.contact || copy.noContact}</dd></div>
          </dl>
          {!isDemo && canLookup ? <TicketWorkflow key={`${context}|${ticket.id}`} ticket={ticket} tenantScope={tenantScope} locale={locale}
            onNavigationLockChange={lookup.setLocked} onCurrent={current => lookup.updateStatus(current.ticketId, current.status)} /> : null}
        </article>
      ) : null}
    </section>
  );
});
