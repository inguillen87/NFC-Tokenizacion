"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { associationCopy, associationLocale, type AssociationLocale } from "./tap-association-copy";
import { createTapAssociationRunner, TAP_ASSOCIATION_ACTIONS, tapAssociationContext, tapAssociationLoginHref, tapAssociationSession,
  type TapAssociationAction, type TapAssociationContext, type TapAssociationState, type TapAssociationSession } from "./tap-association-model";
import styles from "./tap-association-banner.module.css";

async function actionTransport(path: string, body: Record<string, unknown>, signal: AbortSignal) {
  const response = await fetch(path, { method: "POST", credentials: "include", signal,
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

function AssociationCard({ context }: { context: TapAssociationContext }) {
  const [locale, setLocale] = useState<AssociationLocale>("es-AR");
  const [selected, setSelected] = useState<TapAssociationAction | null>(context.preferred);
  const [session, setSession] = useState<TapAssociationSession>("checking");
  const [sessionRevision, setSessionRevision] = useState(0);
  const [state, setState] = useState<TapAssociationState>({ pending: null, results: {} });
  const runner = useRef<ReturnType<typeof createTapAssociationRunner> | null>(null);
  const resultFocus = useRef<HTMLHeadingElement>(null);
  const copy = associationCopy[locale];

  useEffect(() => {
    const update = () => setLocale(associationLocale(document.documentElement.lang));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // A fresh runner for every effect setup also supports React StrictMode.
    const current = createTapAssociationRunner(context, actionTransport);
    runner.current = current;
    const unsubscribe = current.subscribe(setState);
    return () => { unsubscribe(); current.dispose(); if (runner.current === current) runner.current = null; };
    // The parent keys this card by the complete context, so unrelated renders
    // cannot reset completed actions and allow them to be submitted twice.
  }, [context.key]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setSession("checking");
    void fetch("/api/consumer/session", { cache: "no-store", credentials: "include", signal: controller.signal })
      .then(async response => {
        const value = await response.json().catch(() => null);
        if (current) setSession(tapAssociationSession(response.status, value));
      }).catch(() => { if (current) setSession("unavailable"); })
      .finally(() => clearTimeout(timeout));
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [sessionRevision]);

  useEffect(() => {
    if (!state.pending && Object.keys(state.results).length) resultFocus.current?.focus();
  }, [state]);

  async function confirm() {
    const current = runner.current;
    if (!current || !selected || session !== "active") return;
    const result = await current.run(selected, locale);
    if (!result || runner.current !== current) return;
    if (result.outcome === "session_required") setSession("none");
  }

  const selectedResult = selected ? state.results[selected] : null;
  const hasResults = Object.keys(state.results).length > 0;
  const loginHref = tapAssociationLoginHref({ ...context, preferred: selected });
  return <section className={styles.panel} data-testid="tap-association" aria-labelledby="tap-association-title" lang={locale}>
    <header><span className={styles.eyebrow}>{copy.eyebrow}</span><h2 id="tap-association-title">{copy.title}</h2>
      <p>{copy.intro}</p><p className={styles.reference}>{copy.reference}: <span>{context.eventId}</span></p></header>
    <fieldset className={styles.choices} disabled={Boolean(state.pending)}>
      <legend>{copy.choose}</legend>
      {TAP_ASSOCIATION_ACTIONS.map(action => <label key={action} className={styles.choice} data-selected={selected === action}>
        <input type="radio" name="tap-association-action" data-testid={`tap-association-option-${action}`} value={action} checked={selected === action} onChange={() => setSelected(action)} />
        <span><strong>{copy.actions[action].label}</strong><small>{copy.actions[action].detail}</small></span>
      </label>)}
    </fieldset>
    <div className={styles.confirmation}>
      <p role="status">{session === "checking" ? copy.checking : session === "active" ? copy.active : session === "none" ? copy.loginNeeded : copy.checkError}</p>
      {session === "none" ? <Link className={styles.primary} href={loginHref} data-testid="tap-association-login" prefetch={false}>{copy.login}</Link> : null}
      {session === "unavailable" ? <button type="button" className={styles.secondary} onClick={() => setSessionRevision(value => value + 1)}>{copy.checkAgain}</button> : null}
      {session === "active" && selected ? <button type="button" className={styles.primary} disabled={Boolean(state.pending) || selectedResult?.retryable === false}
        onClick={() => void confirm()} data-testid="tap-association-confirm">
        {state.pending ? copy.sending : selectedResult?.retryable === false ? copy.done : selectedResult ? `${copy.retry}: ${copy.actions[selected].label}` : copy.actions[selected].button}
      </button> : null}
      <p className={styles.help}>{copy.freshHelp}</p>
    </div>
    {hasResults ? <section className={styles.results} aria-labelledby="tap-association-results">
      <h3 id="tap-association-results" tabIndex={-1} ref={resultFocus}>{copy.results}</h3>
      <ul aria-live="polite">{TAP_ASSOCIATION_ACTIONS.map(action => state.results[action] ? <li key={action} data-testid={`tap-association-result-${action}`} data-outcome={state.results[action]?.outcome}>
        <strong>{copy.actions[action].label}</strong><p>{copy.outcomes[state.results[action]!.outcome]}</p>
      </li> : null)}</ul>
      <Link href="/me/products" prefetch={false}>{copy.products}</Link>
    </section> : null}
  </section>;
}

export function TapAssociationBanner() {
  const params = useSearchParams();
  const context = tapAssociationContext(new URLSearchParams(params.toString()));
  // Changing context unmounts the old runner and clears results before paint.
  // Query parameters select UI; they never grant authenticity or permissions.
  return context ? <AssociationCard key={context.key} context={context} /> : null;
}
