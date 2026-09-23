"use client";
import React from "react";
import type { CustomerSignalCollectionState } from "../lib/customer-signal-timeline";
import { customerInboxCopy } from "../lib/customer-inbox-copy";
import styles from "./customer-inbox.module.css";

export function CustomerInboxNotice({ state, locale, onRetry, pending = false }: {
  state: CustomerSignalCollectionState; locale: keyof typeof customerInboxCopy; onRetry: () => void; pending?: boolean;
}) {
  if (state.availability === "ready" && state.source !== "unavailable") return null;
  const copy = customerInboxCopy[locale];
  return <section className={`${styles.root} ${styles.notice}`} data-testid="customer-inbox-unavailable" data-availability={state.availability} aria-busy={pending}>
    <h2>{copy.unavailableTitle}</h2>
    <p>{copy[state.availability === "ready" ? "invalid_payload" : state.availability]}</p>
    {state.availability !== "access_denied" ? <>
      <p>{copy.recovery}</p>
      <button type="button" onClick={onRetry} disabled={pending}>{pending ? copy.reloading : copy.retry}</button>
    </> : null}
  </section>;
}
