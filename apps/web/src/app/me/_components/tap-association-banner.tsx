"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { associationCopy, associationLocale, type AssociationLocale } from "./tap-association-copy";
import { associationEligibilityCopy } from "./tap-association-eligibility-copy";
import { createTapEligibilityReader, tapEligibilityAllows, type TapEligibility } from "./tap-association-eligibility";
import { createTapAssociationRunner, normalizeTapAssociationClaimPin, TAP_ASSOCIATION_ACTIONS, tapAssociationContext, tapAssociationLoginHref, tapAssociationSession,
  type TapAssociationAction, type TapAssociationContext, type TapAssociationState, type TapAssociationSession } from "./tap-association-model";
import styles from "./tap-association-banner.module.css";

async function actionTransport(path: string, body: Record<string, unknown>, signal: AbortSignal) {
  const response = await fetch(path, { method: "POST", credentials: "include", signal,
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

function AssociationCard({ context }: { context: TapAssociationContext }) {
  const router = useRouter();
  const refreshPortal = useRef(router.refresh);
  refreshPortal.current = router.refresh;
  const [locale, setLocale] = useState<AssociationLocale>("es-AR");
  const [selected, setSelected] = useState<TapAssociationAction | null>(context.preferred);
  const [claimPin, setClaimPin] = useState("");
  const [pinInputInvalid, setPinInputInvalid] = useState(false);
  const [session, setSession] = useState<TapAssociationSession>("checking");
  const [sessionRevision, setSessionRevision] = useState(0);
  const [eligibility, setEligibility] = useState<TapEligibility | null>(null);
  const [eligibilityRevision, setEligibilityRevision] = useState(0);
  const [state, setState] = useState<TapAssociationState>({ pending: null, results: {} });
  const runner = useRef<ReturnType<typeof createTapAssociationRunner> | null>(null);
  const resultFocus = useRef<HTMLHeadingElement>(null);
  const feedbackFocus = useRef<{ owner: ReturnType<typeof createTapAssociationRunner>; action: TapAssociationAction;
    trigger: HTMLButtonElement; permitted: boolean; release: () => void } | null>(null);
  const copy = associationCopy[locale];
  const eligibilityCopy = associationEligibilityCopy[locale];
  const visibleSession = eligibility?.state === "session_required" ? "none" : session;
  const needsPin = selected === "claim" && tapEligibilityAllows(eligibility, "claim")
    && (eligibility?.actions.claim.nextStep === "enter_pin" || state.results.claim?.outcome === "pin_input_required");

  useEffect(() => {
    const update = () => setLocale(associationLocale(document.documentElement.lang));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // A fresh runner for every effect setup also supports React StrictMode.
    const current = createTapAssociationRunner(context, actionTransport, () => {
      if (runner.current === current) refreshPortal.current();
    });
    runner.current = current;
    const unsubscribe = current.subscribe(setState);
    return () => {
      unsubscribe(); current.dispose();
      if (feedbackFocus.current?.owner === current) { feedbackFocus.current.release(); feedbackFocus.current = null; }
      if (runner.current === current) runner.current = null;
    };
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
    const reader = createTapEligibilityReader(async (path, init) => {
      const response = await fetch(path, init);
      return { status: response.status, payload: await response.json().catch(() => null) };
    });
    setEligibility(null);
    void reader.read(context).then(value => { if (value) setEligibility(value); });
    return () => reader.dispose();
  }, [context.key, eligibilityRevision]);

  useEffect(() => {
    if (visibleSession !== "active" || !tapEligibilityAllows(eligibility, "claim")) {
      setClaimPin(""); setPinInputInvalid(false);
    }
  }, [visibleSession, eligibility]);

  useEffect(() => {
    const request = feedbackFocus.current;
    if (!state.pending && request && state.results[request.action]) {
      feedbackFocus.current = null;
      request.release();
      // Announce every result, but move only the initiating user's focus. A
      // delayed receipt must not undo a newer interaction elsewhere in the portal.
      if (runner.current !== request.owner || !request.permitted
        || (document.activeElement !== request.trigger && document.activeElement !== document.body)) return;
      resultFocus.current?.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
      resultFocus.current?.focus({ preventScroll: true });
    }
  }, [state]);

  async function confirm(trigger: HTMLButtonElement) {
    const current = runner.current;
    if (!current || !selected || visibleSession !== "active" || !tapEligibilityAllows(eligibility, selected)
      || current.state().pending || current.state().results[selected]?.retryable === false) return;
    const submittedPin = selected === "claim" ? normalizeTapAssociationClaimPin(claimPin) : "";
    if (submittedPin === null || needsPin && !submittedPin) { setPinInputInvalid(true); return; }
    setPinInputInvalid(false);
    setClaimPin("");
    feedbackFocus.current?.release();
    const request = { owner: current, action: selected, trigger,
      permitted: document.activeElement === trigger || document.activeElement === document.body, release: () => {} };
    const movedFocus = (event: FocusEvent) => {
      if (event.target !== document.body && event.target !== trigger && !trigger.contains(event.target as Node)) request.permitted = false;
    };
    const movedPointer = (event: PointerEvent) => {
      if (event.target !== trigger && !trigger.contains(event.target as Node)) request.permitted = false;
    };
    const movedScroll = () => { request.permitted = false; };
    const scrollKey = (event: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) movedScroll(); };
    document.addEventListener("focusin", movedFocus, true);
    document.addEventListener("pointerdown", movedPointer, true);
    document.addEventListener("touchmove", movedScroll, { capture: true, passive: true });
    document.addEventListener("keydown", scrollKey, true);
    window.addEventListener("wheel", movedScroll, { capture: true, passive: true });
    request.release = () => {
      document.removeEventListener("focusin", movedFocus, true);
      document.removeEventListener("pointerdown", movedPointer, true);
      document.removeEventListener("touchmove", movedScroll, true);
      document.removeEventListener("keydown", scrollKey, true);
      window.removeEventListener("wheel", movedScroll, true);
    };
    feedbackFocus.current = request;
    const result = await current.run(selected, locale, submittedPin);
    if (!result || runner.current !== current) {
      if (feedbackFocus.current === request) { request.release(); feedbackFocus.current = null; }
      return;
    }
    if (result.outcome === "session_required") setSession("none");
    // Re-read advisory options once after a receipt. Never renew or resend a POST.
    setEligibility(null);
    setEligibilityRevision(value => value + 1);
  }

  const selectedResult = selected ? state.results[selected] : null;
  const hasResults = Object.keys(state.results).length > 0;
  const loginHref = tapAssociationLoginHref({ ...context, preferred: selected });
  const renderChoice = (action: TapAssociationAction) => {
    const available = visibleSession === "active" && tapEligibilityAllows(eligibility, action);
    const reason = eligibility?.state === "ready" && !eligibility.actions[action].allowed
      ? eligibilityCopy.reasons[eligibility.actions[action].reason] ?? eligibilityCopy.unavailable : null;
    return <label key={action} className={styles.choice} data-selected={selected === action} data-primary={action === "save"} data-available={available}>
      <input type="radio" name="tap-association-action" data-testid={`tap-association-option-${action}`} value={action} checked={selected === action}
        disabled={!available || state.results[action]?.retryable === false} aria-describedby={reason ? `tap-association-reason-${action}` : undefined}
        onChange={() => { setSelected(action); setClaimPin(""); setPinInputInvalid(false); }} />
      <span><strong>{copy.actions[action].label}</strong><small>{copy.actions[action].detail}</small>
        {reason ? <small id={`tap-association-reason-${action}`} className={styles.availabilityReason}>{reason}</small> : null}</span>
    </label>;
  };
  return <section className={styles.panel} data-testid="tap-association" aria-labelledby="tap-association-title" lang={locale}>
    <header><span className={styles.eyebrow}>{copy.eyebrow}</span><h2 id="tap-association-title">{copy.title}</h2>
      <p>{copy.subtitle}</p></header>
    <div className={styles.availability} data-testid="tap-association-eligibility" data-state={eligibility?.state ?? "checking"} aria-live="polite" aria-atomic="true">
      <p>{eligibility ? eligibilityCopy[eligibility.state] : eligibilityCopy.checking}</p>
      {visibleSession === "active" && eligibility && eligibility.state !== "fresh_required" && eligibility.state !== "blocked" ?
        <button type="button" className={styles.availabilityRefresh} data-testid="tap-association-eligibility-refresh" disabled={Boolean(state.pending)} onClick={() => {
          setEligibility(null); setEligibilityRevision(value => value + 1);
        }}>{eligibilityCopy.refresh}</button> : null}
    </div>
    <fieldset className={styles.choices} disabled={Boolean(state.pending)}>
      <legend>{copy.choose}</legend>
      {renderChoice("save")}
      <details className={styles.alternatives} open={context.preferred !== null && context.preferred !== "save"}>
        <summary>{copy.alternatives}</summary>
        <div className={styles.alternativeChoices}>{TAP_ASSOCIATION_ACTIONS.filter(action => action !== "save").map(renderChoice)}</div>
      </details>
    </fieldset>
    {needsPin && selectedResult?.retryable !== false ? <div className={styles.pinEntry}>
      <label htmlFor="tap-association-claim-pin">{copy.pinLabel}</label>
      <input id="tap-association-claim-pin" data-testid="tap-association-claim-pin" type="password" autoComplete="off"
        maxLength={128} spellCheck={false} autoCapitalize="none" value={claimPin} required disabled={Boolean(state.pending)}
        aria-describedby={`tap-association-pin-help${pinInputInvalid ? " tap-association-pin-error" : ""}`} aria-invalid={pinInputInvalid || undefined}
        onChange={event => { setClaimPin(event.target.value); setPinInputInvalid(false); }} />
      <p id="tap-association-pin-help">{copy.pinHelp}</p>
      {pinInputInvalid ? <p id="tap-association-pin-error" role="alert">{claimPin.trim() ? copy.pinInputError : eligibilityCopy.pinMissing}</p> : null}
    </div> : null}
    <div className={styles.confirmation}>
      <p role="status">{state.pending ? copy.sending : visibleSession === "checking" ? copy.checking : visibleSession === "active" ? copy.active : visibleSession === "none" ? copy.loginNeeded : copy.checkError}</p>
      {visibleSession === "none" ? <Link className={styles.primary} href={loginHref} data-testid="tap-association-login" prefetch={false}>{copy.login}</Link> : null}
      {visibleSession === "unavailable" ? <button type="button" className={styles.secondary} onClick={() => setSessionRevision(value => value + 1)}>{copy.checkAgain}</button> : null}
      {visibleSession === "active" && selected ? <button type="button" className={styles.primary} disabled={Boolean(state.pending) || selectedResult?.retryable === false
        || !tapEligibilityAllows(eligibility, selected) || needsPin && !claimPin.trim()}
        onClick={event => void confirm(event.currentTarget)} data-testid="tap-association-confirm">
        {state.pending ? copy.sending : selectedResult?.retryable === false ? copy.titles[selectedResult.outcome] : selectedResult ? `${copy.retry}: ${copy.actions[selected].label}` : copy.actions[selected].button}
      </button> : null}
    </div>
    {hasResults ? <section className={styles.results} aria-labelledby="tap-association-results">
      <h3 id="tap-association-results" tabIndex={-1} ref={resultFocus}>{copy.results}</h3>
      <ul aria-live="polite">{TAP_ASSOCIATION_ACTIONS.map(action => state.results[action] ? <li key={action} data-testid={`tap-association-result-${action}`} data-outcome={state.results[action]?.outcome}>
        <span className={styles.resultAction}>{copy.actions[action].label}</span><h4>{copy.titles[state.results[action]!.outcome]}</h4><p>{copy.outcomes[state.results[action]!.outcome]}</p>
      </li> : null)}</ul>
      <Link href={`/me/products?focus=${context.eventId}`} className={styles.collectionLink} prefetch={false}>{copy.products}</Link>
      <Link href="/me/taps" className={styles.historyLink} prefetch={false}>{copy.history}</Link>
    </section> : null}
    <details className={styles.readingDetails}>
      <summary>{copy.readingDetails}</summary>
      <div><p>{copy.intro}</p><p className={styles.help}>{copy.freshHelp}</p>
        <p className={styles.reference}>{copy.reference}: <span>{context.eventId}</span></p></div>
    </details>
  </section>;
}

export function TapAssociationBanner() {
  const params = useSearchParams();
  const context = tapAssociationContext(new URLSearchParams(params.toString()));
  // Changing context unmounts the old runner and clears results before paint.
  // Query parameters select UI; they never grant authenticity or permissions.
  return context ? <AssociationCard key={context.key} context={context} /> : null;
}
