"use client";

import React, { useId } from "react";
import type { CustomerActivityKind, CustomerActivitySummary as Summary } from "../lib/customer-activity-summary";
import { customerActivityCopy } from "../lib/customer-activity-copy";
import styles from "./customer-activity-summary.module.css";

export function CustomerActivitySummary({ summary, locale, onOpen, controls }: {
  summary: Summary; locale: keyof typeof customerActivityCopy;
  onOpen: (kind: CustomerActivityKind) => void; controls: string;
}) {
  const copy = customerActivityCopy[locale];
  const id = useId();
  const format = new Intl.NumberFormat(locale);
  return <section className={styles.root} aria-labelledby={`${id}-heading`} data-testid="customer-activity-summary">
    <header className={styles.header}>
      <div><h2 id={`${id}-heading`}>{copy.title}</h2><p>{summary.scope ? `${copy.scope}: ${summary.scope}` : copy.global}</p></div>
      {summary.demo ? <strong className={styles.badge}>{copy.demo}</strong> : null}
    </header>
    <p className={styles.hint}>{copy.hint}</p>
    <div className={styles.grid}>
      {summary.cards.map(card => <article className={styles.card} key={card.kind} data-activity-kind={card.kind} data-availability={card.availability} data-source={card.source} aria-labelledby={`${id}-${card.kind}`}>
        <h3 id={`${id}-${card.kind}`}>{copy[card.kind]}</h3>
        <p className={styles.provenance}>{card.count !== null ? (card.source === "demo" ? copy.demo : copy.production) : copy[card.availability === "ready" ? "invalid_payload" : card.availability]}</p>
        <p className={styles.count} data-testid={`activity-count-${card.kind}`}>{card.count === null ? "—" : format.format(card.count)}</p>
        {card.count !== null ? <p className={styles.caption}>{copy.loaded}</p> : null}
        {card.count === 0 ? <p className={styles.caption}>{copy.empty}</p> : null}
        {card.statuses.length ? <details className={styles.details}>
          <summary>{copy.statuses}</summary>
          <p className={styles.caption}>{copy.literal}</p>
          <dl tabIndex={0} aria-label={copy.statuses}>{card.statuses.map(bucket => <div key={JSON.stringify(bucket.value)}><dt>{bucket.value ?? copy.missing}</dt><dd>{format.format(bucket.count)}</dd></div>)}</dl>
        </details> : null}
        <button type="button" className={styles.action} disabled={card.count === null} aria-controls={controls} onClick={() => onOpen(card.kind)}>
          {card.kind === "leads" ? copy.openLeads : card.kind === "tickets" ? copy.openTickets : copy.openOrders}
        </button>
      </article>)}
    </div>
    <p className={styles.limit}>{copy.limits}</p><p className={styles.caption}>{copy.filterHint}</p>
  </section>;
}
