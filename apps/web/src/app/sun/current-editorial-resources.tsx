"use client";

import { ArrowUpRight, BookOpen, ChevronDown } from "lucide-react";
import { useSunLocale } from "./sun-locale-provider";
import { currentEditorialCopy, currentEditorialResourcesModel, type CurrentEditorialResourcesProps } from "./current-editorial-resources-model";
import styles from "./current-editorial-resources.module.css";

export type { CurrentEditorialResourcesProps } from "./current-editorial-resources-model";

export function CurrentEditorialResources({ currentEditorial }: CurrentEditorialResourcesProps) {
  const { locale } = useSunLocale();
  const copy = currentEditorialCopy[locale];
  const view = currentEditorialResourcesModel(currentEditorial, locale);
  const publication = view.publication;
  return <section id="current-editorial-resources" className={styles.root} aria-labelledby="current-editorial-title" data-testid="current-editorial-resources" data-editorial-state={view.state} data-sun-server-evidence="true">
    <header className={styles.header}><BookOpen size={17} aria-hidden="true" /><h2 id="current-editorial-title">{copy.title}</h2></header>
    {publication ? <details className={styles.details}>
      <summary className={styles.summary} data-testid="current-editorial-summary">
        <span><strong>{copy.version} {publication.version}</strong><span className={styles.summaryDate}>{copy.publishedAt}: <time dateTime={publication.publishedAt.iso}>{publication.publishedAt.label}</time></span><span className={styles.expand}>{copy.expand}</span></span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className={styles.content}>
        <p className={styles.explanation}>{view.description}</p>
        <dl className={styles.metadata}>
          <div><dt>{copy.language}</dt><dd>{publication.language}</dd></div>
          {view.observedAt ? <div><dt>{copy.observedAt}</dt><dd><time dateTime={view.observedAt.iso}>{view.observedAt.label}</time></dd></div> : null}
        </dl>
        {publication.identity.length ? <dl className={styles.identity}>
          {publication.identity.map(field => <div key={field.key}><dt>{field.label}</dt><dd lang={publication.locale} translate="no">{field.value}</dd></div>)}
        </dl> : <p className={styles.explanation}>{copy.identityMissing}</p>}
        <p className={styles.boundary}>{copy.boundary}</p>
        {publication.resources.length ? <nav aria-label={copy.documents}><ul className={styles.resources}>
          {publication.resources.map(resource => <li key={resource.kind}><a href={resource.href} className={styles.resource} rel="noopener noreferrer" referrerPolicy="no-referrer" data-current-resource-kind={resource.kind}>
            <span><strong>{resource.label}</strong><small>{resource.host} · {copy.external}</small></span><ArrowUpRight size={17} aria-hidden="true" />
          </a></li>)}
        </ul></nav> : !publication.omittedResource ? <p className={styles.explanation}>{copy.empty}</p> : null}
        {publication.omittedResource ? <p className={styles.explanation}>{copy.omitted}</p> : null}
        <p className={styles.boundary}>{copy.documentBoundary}</p>
      </div>
    </details> : <div className={styles.unavailable}><strong>{view.status}</strong><p>{view.description}</p></div>}
  </section>;
}
