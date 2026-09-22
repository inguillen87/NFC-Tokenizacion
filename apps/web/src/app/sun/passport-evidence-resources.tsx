"use client";

import { ArrowUpRight, FileText, ScanLine } from "lucide-react";
import { useSunLocale } from "./sun-locale-provider";
import { CurrentEditorialResources } from "./current-editorial-resources";
import { passportEvidenceCopy, passportEvidenceResourcesModel, type PassportEvidenceResourcesProps } from "./passport-evidence-resources-model";
import styles from "./passport-evidence-resources.module.css";

export type { PassportEvidenceResourcesProps } from "./passport-evidence-resources-model";

export function PassportEvidenceResources(props: PassportEvidenceResourcesProps) {
  const { locale, text } = useSunLocale();
  const copy = passportEvidenceCopy[locale];
  const view = passportEvidenceResourcesModel(props, locale);

  return <><section id="passport-evidence-resources" className={styles.root} aria-labelledby="passport-evidence-title" data-testid="passport-evidence-resources" data-evidence-mode={view.mode} data-sun-server-evidence="true">
    <header className={styles.header}><FileText size={17} aria-hidden="true" /><h2 id="passport-evidence-title">{copy.title}</h2></header>
    <div className={styles.record}>
      <div className={styles.reading}>
        <span className={styles.kind}><ScanLine size={14} aria-hidden="true" />{view.title}</span>
        {view.statusLabel ? <strong>{text(view.statusLabel)}</strong> : null}
        <p>{view.explanation}</p>
      </div>
      {view.reading ? <dl className={styles.facts}>
        <div><dt>{copy.registered}</dt><dd>{view.recordedAt ? <time dateTime={view.recordedAt.iso}>{view.recordedAt.label}</time> : copy.missingDate}</dd></div>
        {view.reference ? <div><dt>{copy.reference}</dt><dd>#{view.reference}</dd></div> : null}
      </dl> : null}
    </div>
    <p className={styles.declared}>{view.mode === "demo" ? copy.demoDeclared : copy.declared}</p>
    {view.resources.length ? <nav aria-label={copy.resources}><ul className={styles.resources}>
      {view.resources.map(resource => <li key={resource.kind}><a href={resource.href} className={styles.resource} data-resource-kind={resource.kind} rel={resource.external ? "noopener noreferrer" : undefined} referrerPolicy="no-referrer">
        <span><strong>{resource.label}</strong><small>{resource.detail}{resource.external ? ` · ${copy.external}` : ""}</small></span><ArrowUpRight size={17} aria-hidden="true" />
      </a></li>)}
    </ul></nav> : <p className={styles.empty}>{copy.empty}</p>}
    {view.hasDocuments ? <p className={styles.boundary}>{view.documentBoundary}</p> : null}
  </section>
  {view.mode !== "demo" ? <CurrentEditorialResources currentEditorial={props.currentEditorial} /> : null}</>;
}
