"use client";
import React, { useId, useRef, useState } from "react";
import type { AssistantLedger } from "../lib/assistant-records";
import { assistantRecordMatches } from "../lib/assistant-records";
import { customerRecordDate } from "../lib/customer-inbox-state";
import { customerInboxCopy } from "../lib/customer-inbox-copy";
import { CustomerInboxNotice } from "./customer-inbox-notice";
import styles from "./customer-inbox.module.css";

const PAGE_SIZE = 20;
export function AssistantRecords({ ledger, query, locale, onRetry, pending, onClear }: {
  ledger: AssistantLedger; query: string; locale: keyof typeof customerInboxCopy;
  onRetry: () => void; pending: boolean; onClear: () => void;
}) {
  const copy = customerInboxCopy[locale], id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [pagination, setPagination] = useState({ rows: ledger.rows, query, page: 0 });
  const matches = ledger.rows.filter(row => assistantRecordMatches(row, query));
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = pagination.rows === ledger.rows && pagination.query === query ? Math.min(pagination.page, pages - 1) : 0;
  const openPage = (next: number) => { setPagination({ rows: ledger.rows, query, page: next }); headingRef.current?.focus(); };
  if (ledger.loadedCount === null) return <CustomerInboxNotice state={ledger} locale={locale} onRetry={onRetry} pending={pending} />;
  return <section className={styles.root} aria-labelledby={`${id}-title`} data-testid="assistant-records">
    <header className={styles.header}>
      <div><h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{copy.assistantTitle}</h2><p>{copy.assistantHint}</p></div>
      <span className={styles.badge}>{ledger.source === "demo" ? copy.demo : copy.production}</span>
    </header>
    <p className={styles.boundary}>{copy.responseBoundary}</p>
    <p role="status" className={styles.summary}>{copy.recorded}: {ledger.loadedCount} · {copy.matching}: {matches.length} · {copy.page} {page + 1}/{pages}</p>
    {matches.length === 0 ? <div className={styles.notice} data-testid="assistant-empty">
      <p>{ledger.loadedCount === 0 ? copy.noRecords : copy.noMatches}</p>
      {query.trim() ? <button type="button" onClick={onClear}>{copy.clear}</button> : null}
    </div> : <div className={styles.records}>
      {matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(row => <article className={styles.record} key={row.key} data-ai-query-source={row.source}>
        <dl className={styles.identity}>
          <div><dt>{copy.reference}</dt><dd>{row.reference}</dd></div>
          <div><dt>{copy.date}</dt><dd>{customerRecordDate(row.createdAt, copy.missing)}</dd></div>
          <div><dt>{copy.company}</dt><dd>{row.company ?? copy.missing}</dd></div>
          <div><dt>{copy.contact}</dt><dd>{row.contact ?? copy.missing}</dd></div>
        </dl>
        <h3>{copy.question}</h3><p className={styles.message} tabIndex={0}>{row.question ?? copy.missing}</p>
        <dl className={styles.identity}>
          <div><dt>{copy.status}</dt><dd>{row.status ?? copy.missing}</dd></div>
          <div><dt>{copy.interest}</dt><dd>{row.interest ?? copy.missing}</dd></div>
          <div><dt>{copy.channel}</dt><dd>{row.channel}</dd></div>
        </dl>
        {row.notes ? <details><summary>{copy.notes}</summary><p className={styles.message} tabIndex={0}>{row.notes}</p></details> : null}
      </article>)}
    </div>}
    {pages > 1 ? <nav className={styles.pagination} aria-label={copy.page}>
      <button type="button" disabled={page === 0} onClick={() => openPage(page - 1)}>{copy.previous}</button>
      <span>{page + 1} / {pages}</span>
      <button type="button" disabled={page + 1 >= pages} onClick={() => openPage(page + 1)}>{copy.next}</button>
    </nav> : null}
    <p className={styles.summary}>{copy.pageHint}</p>
  </section>;
}
