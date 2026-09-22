"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, ChevronDown, MessageSquareWarning } from "lucide-react";
import { useSunLocale } from "./sun-locale-provider";
import { reportProblemCopy } from "./report-problem-copy";
import { REPORT_CATEGORIES, createReportProblemRunner, readReportProblemResponse, reportContextAvailable, type ReportAttempt, type ReportDraft, type ReportFieldErrors, type ReportOutcome, type ReportProblemProps } from "./report-problem-model";
import styles from "./report-problem-form.module.css";

export type { ReportProblemProps } from "./report-problem-model";

export function ReportProblemForm(props: ReportProblemProps) {
  // Changing the product context closes the old in-memory attempt. A renewed
  // support credential for the same reading can retry the existing request.
  return <ReportProblemSession key={JSON.stringify([props.bid, props.eventId, props.isDemoPreview])} {...props} />;
}

function ReportProblemSession(props: ReportProblemProps) {
  const { locale: activeLocale } = useSunLocale();
  const locale = activeLocale || props.locale;
  const copy = reportProblemCopy[locale];
  const available = reportContextAvailable(props);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<ReportDraft>({ category: "tap_review", description: "", contact: "" });
  const [review, setReview] = useState<ReportAttempt | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ReportFieldErrors>({});
  const [preparationError, setPreparationError] = useState<"context_unavailable" | "resolve_attempt" | "request_id_unavailable" | null>(null);
  const [outcome, setOutcome] = useState<ReportOutcome | null>(null);
  const [sending, setSending] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const description = useRef<HTMLTextAreaElement>(null);
  const requestLock = useRef(false);
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const runner = useRef<ReturnType<typeof createReportProblemRunner> | null>(null);
  if (!runner.current) runner.current = createReportProblemRunner(async (body, signal) => {
    const response = await fetch("/api/public-cta/report-problem", { method: "POST", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
    const payload = await readReportProblemResponse(response).catch(() => null);
    return { status: response.status, payload };
  }, () => crypto.randomUUID());

  useEffect(() => {
    mounted.current = true;
    setReady(true);
    const reveal = () => {
      if (window.location.hash !== "#report-problem" || !details.current) return;
      details.current.open = true;
      details.current.scrollIntoView({ block: "start" });
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => { mounted.current = false; controller.current?.abort(); window.removeEventListener("hashchange", reveal); };
  }, []);
  useEffect(() => { if (review) reviewHeading.current?.focus(); }, [review]);

  const errorText = outcome && outcome.kind !== "received"
    ? outcome.kind === "invalid" ? copy.errors.invalid_response : copy.errors[outcome.kind]
    : preparationError ? copy.errors[preparationError] : null;
  const lockedDetails = sending || runner.current.current().unresolved || (outcome && ["uncertain", "unavailable", "rate_limited"].includes(outcome.kind));
  const received = outcome?.kind === "received" ? outcome : null;
  const productName = typeof props.productName === "string" && props.productName.trim() ? props.productName.trim().slice(0, 256) : copy.unknownProduct;

  function prepare(event: FormEvent) {
    event.preventDefault();
    if (!ready || requestLock.current) return;
    const prepared = runner.current!.prepare(props, draft, locale);
    setFieldErrors(prepared.ok ? {} : prepared.errors);
    setPreparationError(!prepared.ok && prepared.reason ? prepared.reason : null);
    if (prepared.ok) { setReview(prepared.attempt); setOutcome(null); }
    else description.current?.focus();
  }
  async function confirm() {
    if (!ready || !review || requestLock.current) return;
    requestLock.current = true;
    setSending(true);
    controller.current = new AbortController();
    const timer = window.setTimeout(() => controller.current?.abort(), 12000);
    try {
      const result = await runner.current!.submit(props, controller.current.signal);
      if (mounted.current && result) setOutcome(result);
    } finally {
      window.clearTimeout(timer);
      requestLock.current = false;
      if (mounted.current) setSending(false);
    }
  }
  function edit() {
    if (requestLock.current || lockedDetails) return;
    setReview(null);
    setOutcome(null);
    setPreparationError(null);
  }
  const fieldError = (field: "description" | "contact") => fieldErrors[field] === "required" ? copy.errors.required
    : fieldErrors[field] === "too_long" ? field === "description" ? copy.errors.tooLongDescription : copy.errors.tooLongContact : copy.errors.invalid;

  return <section id="report-problem" className={styles.root} aria-labelledby="report-problem-title" data-testid="report-problem-form" data-report-step={received ? "received" : review ? "review" : "description"} data-report-ready={ready} data-sun-server-evidence="true">
    <details ref={details} className={styles.details}>
      <summary className={styles.summary} data-testid="report-problem-summary"><h2 id="report-problem-title"><MessageSquareWarning size={19} aria-hidden="true" /><span>{copy.title}</span><ChevronDown size={18} aria-hidden="true" /></h2></summary>
      <div className={styles.content}>
        {props.isDemoPreview ? <p className={styles.note}>{copy.demo}</p> : received ? <div role="status" className={styles.receipt} data-testid="report-problem-receipt">
          <CheckCircle2 size={24} aria-hidden="true" /><h3>{received.existing ? copy.existing : copy.received}</h3>
          <p>{copy[received.ticket.status]}</p>
          <dl><div><dt>{copy.reference}</dt><dd translate="no">{received.ticket.id}</dd></div><div><dt>{copy.createdAt}</dt><dd><time dateTime={received.ticket.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC", hourCycle: "h23" }).format(new Date(received.ticket.createdAt))} UTC</time></dd></div></dl>
          <p>{copy.receivedHelp}</p>
        </div> : !available ? <p className={styles.note}>{copy.unavailable}</p> : <>
          <p className={styles.note}>{copy.intro}</p>
          {errorText ? <p className={styles.error} role="alert">{errorText}</p> : null}
          {runner.current.current().unresolved && outcome?.kind !== "uncertain" ? <p className={styles.note}>{copy.earlierUncertain}</p> : null}
          {review ? <div className={styles.review}>
            <h3 ref={reviewHeading} tabIndex={-1}>{copy.reviewTitle}</h3>
            <dl className={styles.context}>
              <div><dt>{copy.product}</dt><dd translate="no">{productName}</dd></div>
              <div><dt>{copy.batch}</dt><dd translate="no">{review.bid}</dd></div>
              <div><dt>{copy.reading}</dt><dd translate="no">#{review.event_id}</dd></div>
              <div><dt>{copy.category}</dt><dd>{copy.categories[review.category]}</dd></div>
            </dl>
            <dl className={styles.detailsText}><div><dt>{copy.description}</dt><dd translate="no">{review.description}</dd></div><div><dt>{copy.contact}</dt><dd translate="no">{review.contact || copy.noContact}</dd></div></dl>
            <p className={styles.privacy}>{copy.privacy}</p>
            <div className={styles.actions}>
              {outcome?.kind === "conflict" ? <button type="button" className={styles.primary} onClick={edit} disabled={Boolean(lockedDetails)}>{copy.reviewAgain}</button>
                : outcome?.kind === "invalid" && !lockedDetails ? <button type="button" className={styles.primary} onClick={edit}>{copy.edit}</button>
                : (outcome?.kind !== "expired" || props.supportToken !== review.support_token) && outcome?.kind !== "context_unavailable" ? <button type="button" className={styles.primary} onClick={() => void confirm()} disabled={!ready || sending} aria-busy={sending}>{sending ? copy.sending : outcome ? copy.retry : copy.confirm}</button> : null}
              {!lockedDetails && !outcome ? <button type="button" className={styles.secondary} onClick={edit}>{copy.edit}</button> : null}
            </div>
          </div> : <form onSubmit={prepare} noValidate>
            <label className={styles.field} htmlFor="report-category"><span>{copy.category}</span><select id="report-category" value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} aria-invalid={Boolean(fieldErrors.category)}>{REPORT_CATEGORIES.map(category => <option key={category} value={category}>{copy.categories[category]}</option>)}</select></label>
            <label className={styles.field} htmlFor="report-description"><span>{copy.description}</span><textarea ref={description} id="report-description" rows={5} maxLength={1500} required value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} aria-describedby={`report-description-help${fieldErrors.description ? " report-description-error" : ""}`} aria-invalid={Boolean(fieldErrors.description)} /></label>
            <p id="report-description-help" className={styles.help}>{copy.descriptionHelp} <span>{draft.description.length}/1500</span></p>
            {fieldErrors.description ? <p id="report-description-error" className={styles.fieldError}>{fieldError("description")}</p> : null}
            <label className={styles.field} htmlFor="report-contact"><span>{copy.contact}</span><input id="report-contact" type="text" autoComplete="off" maxLength={320} value={draft.contact} onChange={event => setDraft({ ...draft, contact: event.target.value })} aria-describedby={`report-contact-help${fieldErrors.contact ? " report-contact-error" : ""}`} aria-invalid={Boolean(fieldErrors.contact)} /></label>
            <p id="report-contact-help" className={styles.help}>{copy.contactHelp}</p>
            {fieldErrors.contact ? <p id="report-contact-error" className={styles.fieldError}>{fieldError("contact")}</p> : null}
            <p className={styles.privacy}>{copy.privacy}</p>
            <button type="submit" className={styles.primary} disabled={!ready}>{copy.review}</button>
          </form>}
        </>}
      </div>
    </details>
  </section>;
}
