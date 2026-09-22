"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import type { TicketLookupLocale } from "../lib/ticket-reference-lookup";
import { createTicketWorkflowReader, createTicketWorkflowWriter, type WorkflowCommand, type WorkflowCurrent, type WorkflowHistory, type WorkflowOutcome } from "../lib/ticket-workflow";
import { ticketWorkflowCopy } from "../lib/ticket-workflow-copy";

const buttonClass = "min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60";
const inputClass = "min-h-11 w-full rounded-xl border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white disabled:opacity-70";
type Phase = "draft" | "review" | "submitting" | "invalid" | WorkflowOutcome["status"];

export function TicketWorkflow({ ticket, tenantScope, locale, onCurrent }: {
  ticket: Record<string, unknown>; tenantScope: string; locale: TicketLookupLocale; onCurrent: (current: WorkflowCurrent) => void;
}) {
  const copy = ticketWorkflowCopy[locale];
  const reference = String(ticket.id);
  const formId = useId();
  const reader = useRef<ReturnType<typeof createTicketWorkflowReader> | null>(null);
  const writer = useRef<ReturnType<typeof createTicketWorkflowWriter> | null>(null);
  if (!reader.current) reader.current = createTicketWorkflowReader(reference, tenantScope);
  if (!writer.current) writer.current = createTicketWorkflowWriter(reference, tenantScope);
  const onCurrentRef = useRef(onCurrent); onCurrentRef.current = onCurrent;
  const [history, setHistory] = useState<WorkflowHistory | null>(null);
  const [readState, setReadState] = useState<"idle" | "loading" | "ready" | "unavailable" | "forbidden">("idle");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState<Phase>("draft");
  const [command, setCommand] = useState<WorkflowCommand | null>(null);
  const [reloadNotice, setReloadNotice] = useState(false);
  useEffect(() => () => { reader.current?.cancel(); writer.current?.dispose(); }, []);
  const statusLabel = (value: string) => ["open", "pending", "closed"].includes(value) ? copy[value as "open"] : value || copy.unknown;
  const moment = (value: string) => `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`;

  async function load(cursor?: string, afterConflict = false) {
    if (writer.current!.isBusy()) return;
    setReadState("loading");
    const next = await reader.current!.read(cursor);
    if (!next) return;
    setReadState(next.status);
    if (next.status !== "ready") return;
    const nextHistory = next.history;
    setHistory(previous => cursor && previous ? {
      ...nextHistory, items: [...previous.items, ...nextHistory.items.filter(item => !previous.items.some(old => old.operationId === item.operationId))],
    } : nextHistory);
    onCurrentRef.current(nextHistory.current);
    const matched = writer.current!.reconcile(nextHistory);
    if (matched) setPhase("saved");
    else if (afterConflict && writer.current!.canEdit()) { writer.current!.clear(); setCommand(null); setPhase("draft"); setReloadNotice(true); }
  }
  function review(event: React.FormEvent) {
    event.preventDefault();
    if (!history || readState !== "ready") return;
    let requestId = "";
    try { requestId = crypto.randomUUID(); } catch { /* A change requires a cryptographic request identifier. */ }
    const prepared = writer.current!.prepare(history.current, target, reason, requestId);
    if (!prepared) { setPhase("invalid"); return; }
    setCommand(prepared); setPhase("review"); setReloadNotice(false);
  }
  async function confirm() {
    if (!history || phase === "submitting" || writer.current!.isBusy()) return;
    reader.current!.cancel();
    // The canceled read will return no result. Keep the last confirmed snapshot
    // visible while the write is pending and when its outcome arrives.
    setReadState("ready");
    const pending = writer.current!.submit();
    setPhase("submitting");
    const result = await pending;
    if (!result) return;
    setPhase(result.status);
    if (result.status === "saved") {
      onCurrentRef.current(result.current);
      setHistory(previous => previous ? { ...previous, current: result.current, items: [result.receipt, ...previous.items.filter(item => item.operationId !== result.receipt.operationId)].sort((left, right) => BigInt(left.sequence) > BigInt(right.sequence) ? -1 : 1) } : previous);
    }
  }
  const unresolved = writer.current.isUnresolved();
  const locked = !writer.current.canEdit() || phase === "review" || phase === "saved" || phase === "conflict" || phase === "blocked";
  const actionAvailable = history?.current.canUpdate && readState === "ready";
  const message = phase === "invalid" ? copy.invalid : phase === "submitting" ? copy.submitting : phase === "saved" ? copy.saved : phase === "uncertain" ? copy.uncertain
    : phase === "conflict" ? copy.conflict : phase === "blocked" ? copy.blocked : phase === "forbidden" ? copy.denied : phase === "rejected" ? copy.unavailableAction : null;
  return (
    <details className="mt-6 min-w-0 rounded-xl border border-white/15 p-4" data-testid="ticket-workflow" onToggle={event => { if (event.currentTarget.open && readState === "idle") void load(); }}>
      <summary className="min-h-11 cursor-pointer text-base font-semibold text-white">{copy.heading}</summary>
      <p className="mt-2 text-sm leading-6 text-slate-300">{copy.hint}</p>
      <div className="mt-3 text-sm text-slate-300" role="status" data-history-state={readState}>{readState === "loading" ? copy.loading : readState === "unavailable" ? copy.unavailable : readState === "forbidden" ? copy.denied : null}</div>
      {readState === "unavailable" || readState === "forbidden" ? <button type="button" className={buttonClass + " mt-3"} onClick={() => void load()}>{copy.refresh}</button> : null}
      {history && readState === "ready" ? (
        <>
          <p className="mt-4 text-sm text-slate-200">{copy.current}: <strong data-testid="workflow-current-status">{statusLabel(history.current.status)}</strong></p>
          {!history.current.canUpdate ? <p className="mt-3 text-sm leading-6 text-slate-300">{copy.blocked} {history.current.blockedReason ? copy[history.current.blockedReason] : ""}</p> : null}
          {actionAvailable ? (
            <form onSubmit={review} className="mt-5 space-y-4">
              <div><label htmlFor={`${formId}-status`} className="mb-2 block text-sm font-semibold text-slate-200">{copy.target}</label>
                <select id={`${formId}-status`} value={target} onChange={event => { setTarget(event.target.value); setPhase("draft"); }} disabled={locked} className={inputClass}>
                  <option value="">{copy.choose}</option>{(["open", "pending", "closed"] as const).map(value => <option key={value} value={value} disabled={value === history.current.status}>{copy[value]}</option>)}
                </select></div>
              <div><label htmlFor={`${formId}-reason`} className="mb-2 block text-sm font-semibold text-slate-200">{copy.reason}</label>
                <textarea id={`${formId}-reason`} rows={4} maxLength={1000} value={reason} disabled={locked} onChange={event => { setReason(event.target.value); setPhase("draft"); }} aria-describedby={`${formId}-help`} className={inputClass + " resize-y"} />
                <p id={`${formId}-help`} className="mt-2 text-xs leading-5 text-slate-400">{copy.reasonHelp} {reason.length}/1000</p></div>
              {!locked ? <button type="submit" className={buttonClass}>{copy.review}</button> : null}
            </form>
          ) : null}
          {reloadNotice ? <p className="mt-3 text-sm text-slate-300">{copy.reloadHint}</p> : null}
          {phase === "review" && command ? (
            <section className="mt-5 rounded-xl border border-cyan-300/25 p-4" aria-label={copy.reviewTitle} data-testid="ticket-workflow-review">
              <h5 className="font-bold text-white">{copy.reviewTitle}</h5>
              <dl className="mt-3 space-y-3 text-sm text-slate-300">
                <div><dt className="font-semibold">{copy.reference}</dt><dd className="break-all font-mono">{reference}</dd></div>
                <div><dt className="font-semibold">{copy.tenant}</dt><dd className="break-all">{String(ticket.tenant_name || ticket.tenant_slug || copy.notProvided)}</dd></div>
                <div><dt className="font-semibold">{copy.batch}</dt><dd className="break-all">{String(ticket.bid || copy.notProvided)}</dd></div>
                <div><dt className="font-semibold">{copy.from} → {copy.to}</dt><dd>{statusLabel(writer.current.getAttempt()!.fromStatus)} → {statusLabel(command.status)}</dd></div>
                <div><dt className="font-semibold">{copy.reason}</dt><dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{command.reason}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => void confirm()} className={buttonClass}>{copy.confirm}</button><button type="button" onClick={() => setPhase("draft")} className={buttonClass}>{copy.edit}</button></div>
            </section>
          ) : null}
          <div role="status" aria-live="polite" className="mt-4 text-sm leading-6 text-slate-300" data-workflow-state={phase}>{message}</div>
          {unresolved && phase !== "uncertain" ? <p className="mt-3 text-sm leading-6 text-slate-300">{copy.sticky}</p> : null}
          {unresolved && phase !== "submitting" ? <button type="button" onClick={() => void confirm()} className={buttonClass + " mt-3"}>{copy.retry}</button> : null}
          {phase === "conflict" || phase === "blocked" ? <button type="button" onClick={() => void load(undefined, true)} className={buttonClass + " mt-3"}>{copy.reload}</button> : null}
          {phase === "saved" ? <button type="button" onClick={() => { writer.current!.clear(); setCommand(null); setTarget(""); setReason(""); setPhase("draft"); void load(); }} className={buttonClass + " mt-3"}>{copy.refresh}</button> : null}
          <section className="mt-6" aria-label={copy.history}>
            <h5 className="font-semibold text-white">{copy.history}</h5>
            {!history.items.length ? <p className="mt-2 text-sm text-slate-300">{copy.empty}</p> : <ol className="mt-3 space-y-3" data-testid="ticket-workflow-history">{history.items.map(item => <li key={item.operationId} className="rounded-xl border border-white/10 p-4 text-sm text-slate-300">
              <p className="font-semibold">{statusLabel(item.fromStatus)} → {statusLabel(item.toStatus)}</p><p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.reason}</p>
              <p className="mt-2 break-all">{copy.actor}: {item.actor.label || item.actor.id || copy.actorMissing}</p><p className="mt-1">{copy.at}: <time dateTime={item.createdAt}>{moment(item.createdAt)}</time></p>
            </li>)}</ol>}
            {history.page.hasMore ? <button type="button" disabled={phase === "submitting"} onClick={() => void load(history.page.nextCursor!)} className={buttonClass + " mt-3"}>{copy.older}</button> : null}
          </section>
        </>
      ) : null}
    </details>
  );
}
