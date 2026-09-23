import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, LockKeyhole } from "lucide-react";
import type { BatchWorkspaceNavigationModel } from "../lib/batch-workspace-navigation";
import { batchWorkspaceCopy } from "../lib/batch-workspace-copy";
import styles from "./batch-workspace-navigation.module.css";

export function BatchWorkspaceNavigation({ model, locale = "es-AR" }: {
  model: BatchWorkspaceNavigationModel; locale?: keyof typeof batchWorkspaceCopy;
}) {
  const copy = batchWorkspaceCopy[locale];
  if (model.reason !== "ready") return <aside className={styles.root} data-testid="batch-workspace-navigation" data-state={model.reason}>
    <p className={styles.notice} role="status">{copy[model.reason]}</p>
  </aside>;
  return <nav className={styles.root} aria-label={copy.label} data-testid="batch-workspace-navigation" data-state="ready">
    <div className={styles.top}>
      <div><p className={styles.eyebrow}>{copy.label}</p><p className={styles.context}>{copy.context}: <strong>{model.tenant}</strong></p></div>
      {model.listHref && <Link className={styles.back} href={model.listHref} prefetch={false}><ArrowLeft size={15} aria-hidden="true" />{copy.all}</Link>}
    </div>
    <p className={styles.reference}>{copy.bid}: <code>{model.bid}</code></p>
    <ul className={styles.items}>{model.items.map(item => <li key={item.view} data-destination={item.view}>
      {item.current && item.href ? <span className={styles.current} aria-current="page"><strong>{copy[item.view]}</strong><small>{copy.current}</small></span>
        : item.href ? <Link href={item.href} prefetch={false} className={styles.link}><span>{copy[item.view]}</span><ArrowUpRight size={15} aria-hidden="true" /></Link>
        : <span className={styles.disabled} aria-disabled="true"><span><LockKeyhole size={14} aria-hidden="true" />{copy[item.view]}</span><small>{copy[item.blocked ?? "permission"]}</small></span>}
    </li>)}</ul>
    <p className={styles.hint}>{copy.hint}</p>
  </nav>;
}
