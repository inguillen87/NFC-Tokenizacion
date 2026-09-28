"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileCheck2, Layers3, Search } from 'lucide-react';
import { filterPilotBatches, type PilotLaunchpadModel } from '../lib/pilot-launchpad-model';
import styles from './pilot-launchpad.module.css';
const copy = {
 tenant_required: ['Elegí una empresa para comenzar', 'La vista global no mezcla lotes de empresas distintas. Consultá una empresa concreta para abrir su recorrido.'],
 forbidden: ['No se confirmó acceso a los lotes', 'La sesión o los permisos actuales no permiten esta consulta. No se muestran registros anteriores ni cantidades de reemplazo.'],
 demo: ['Este recorrido requiere una empresa real', 'La sesión de demostración no consulta lotes productivos ni acredita publicación, calidad o lecturas físicas.'],
 invalid: ['No se pudo validar la consulta', 'El alcance o la respuesta no coincide con el contrato esperado. No se muestra una selección parcial ni datos de otra empresa.'],
 unavailable: ['Los lotes no están disponibles en esta consulta', 'No significa que la empresa no tenga lotes. Volvé a consultar antes de continuar.'],
 timeout: ['La consulta de lotes no terminó a tiempo', 'No se reintenta automáticamente. Podés volver a consultar sin iniciar ninguna operación.'],
 selected: ['Consulta pendiente', 'Todavía no hay una respuesta confirmada.'],
 ready: ['', ''],
} as const;
const number = (v: number) => v.toLocaleString('es-AR');
export function PilotLaunchpad({ model }: { model: PilotLaunchpadModel }) {
 // Every changed scope, permission projection or source resets the local selection, including A → B → A.
 return <PilotWorkspace key={JSON.stringify(model)} model={model} />;
}
function PilotWorkspace({ model }: { model: PilotLaunchpadModel }) {
 const [query, setQuery] = useState(''), [bid, setBid] = useState<string | null>(null);
 const heading = useRef<HTMLHeadingElement | null>(null);
 const visible = filterPilotBatches(model.batches, query);
 const selected = model.state === 'ready' ? model.batches.find(row => row.bid === bid) : undefined;
 useEffect(() => { if (bid) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' }); } }, [bid]);
 const scoped = model.tenant ? `/onboarding?${new URLSearchParams({ tenant: model.tenant })}` : '/onboarding';
 const stamp = model.checkedAt ? `${model.checkedAt.slice(0, 10)} · ${model.checkedAt.slice(11, 19)} UTC` : null;
 return <section className={styles.launchpad} data-testid="pilot-launchpad" aria-labelledby="pilot-title">
  <header className={styles.hero}>
   <div><p className={styles.eyebrow}><FileCheck2 aria-hidden="true" /> Puesta en marcha · NexID</p><h1 id="pilot-title">Del lote al pasaporte digital</h1><p>Elegí el lote y abrí la tarea que necesitás. Su expediente conserva el contenido, las unidades y la evidencia de cada etapa.</p></div>
   <span className={styles.badge}>Guía de operación</span>
  </header>
  <div className={styles.scope} data-testid="pilot-scope"><strong>{model.tenant ? `Empresa: ${model.tenant}` : 'Sin empresa seleccionada'}</strong><span>Cada tarea conserva el contexto de esta empresa y del lote elegido.</span></div>
  {model.canSelect ? <form action="/onboarding" method="GET" className={styles.companyForm} data-testid="pilot-tenant-form">
   <label htmlFor="pilot-tenant">Identificador de empresa<input id="pilot-tenant" name="tenant" defaultValue={model.tenant} required maxLength={128} autoCapitalize="none" spellCheck={false} placeholder="Identificador de la empresa" /></label>
   <button className={styles.primary} type="submit">Consultar empresa</button>
   {model.links.tenants ? <Link prefetch={false} className={styles.button} href={model.links.tenants}>Directorio de empresas</Link> : null}
  </form> : null}
  {model.state !== 'ready' ? <div className={styles.notice} data-testid="pilot-source-notice" role="status"><h2>{copy[model.state][0]}</h2><p>{copy[model.state][1]}</p>{model.tenant ? <Link prefetch={false} className={styles.button} href={scoped}>Volver a consultar lotes</Link> : null}</div> : <>
   <div className={styles.sectionHeading}><div><h2>Elegí un lote</h2><p data-testid="pilot-count">{number(model.batches.length)} lotes cargados en esta respuesta; no es un total histórico.</p>{stamp ? <p className={styles.muted}>Consulta: <time dateTime={model.checkedAt!}>{stamp}</time>. No es una lectura en vivo.</p> : null}</div><Link prefetch={false} className={styles.button} href={scoped}>Actualizar lotes</Link></div>
   {!model.batches.length ? <div className={styles.notice} data-testid="pilot-empty">
    <h3>La consulta no devolvió lotes</h3><p>No hay un lote seleccionable en esta respuesta. Revisá el registro de la empresa o su circuito de recepción; abrirlos no crea ni activa unidades.</p>
    {model.links.batches ? <Link prefetch={false} className={styles.button} href={model.links.batches}>Abrir registro de lotes</Link> : null}
    {model.links.reception ? <Link prefetch={false} className={styles.button} href={model.links.reception}>Revisar recepción y pedidos</Link> : null}
   </div> : <div className={styles.workspace}>
    <section className={styles.picker} aria-labelledby="pilot-picker-title">
     <h3 id="pilot-picker-title"><Layers3 aria-hidden="true" /> Lotes de la empresa</h3>
     <label htmlFor="pilot-search"><span className={styles.searchLabel}><Search aria-hidden="true" /> Buscar en esta respuesta</span><input id="pilot-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Producto, lote, SKU o soporte" /></label>
     <p className={styles.muted} role="status">{visible.length} de {model.batches.length} lotes cargados coinciden.</p>
     {!visible.length ? <div className={styles.noMatches} data-testid="pilot-no-matches"><p>No hay coincidencias en los lotes cargados.</p><button type="button" className={styles.button} onClick={() => setQuery('')}>Limpiar búsqueda</button></div> : null}
     <ul className={styles.batchList}>{visible.map(row => <li key={row.bid}>
      <button type="button" className={styles.batchChoice} aria-pressed={selected?.bid === row.bid} data-testid="pilot-batch-choice" onClick={() => setBid(row.bid)}>
       <strong>{row.name || 'Producto sin nombre registrado'}</strong><span className={styles.code}>Lote {row.bid}</span><span>{row.sku ? `SKU ${row.sku}` : 'Sin SKU informado'}</span><span className={styles.muted}>{row.carrier || 'Soporte no informado'}</span>
      </button>
     </li>)}</ul>
    </section>
    <section className={styles.detail} aria-labelledby="pilot-selected-title" data-testid="pilot-selected">
     <h3 id="pilot-selected-title" ref={heading} tabIndex={-1}>{selected ? selected.name || 'Lote seleccionado' : 'Seleccioná el lote que vas a trabajar'}</h3>
     {!selected ? <p>La selección es explícita. No se abre automáticamente el primer lote ni se inicia una operación al entrar.</p> : <>
      <p className={styles.code} data-testid="pilot-selected-reference">{selected.tenant} · {selected.bid}</p>
      {!visible.some(row => row.bid === selected.bid) ? <p className={styles.notice} data-testid="pilot-selection-filtered">El lote seleccionado no coincide con la búsqueda actual. La selección no cambió.</p> : null}
      <dl className={styles.metrics}><div><dt>Unidades registradas</dt><dd>{number(selected.quantity)}</dd></div><div><dt>Activas</dt><dd>{number(selected.active)}</dd></div><div><dt>Inactivas</dt><dd>{number(selected.inactive)}</dd></div><div><dt>Revocadas</dt><dd>{number(selected.revoked)}</dd></div></dl>
      <p className={styles.muted}>Estados del registro de este lote. No prueban recepción física, contenido del producto ni aprobación del pasaporte.</p>
      <div className={styles.tasks}>{selected.tasks.map(task => <article key={task.view} className={styles.task} data-testid={`pilot-task-${task.view}`}>
       <div><h4>{task.title}</h4><p>{task.description}</p></div>
       {task.href ? <Link prefetch={false} className={task.view === 'passport' ? styles.primary : styles.button} href={task.href}>Abrir {task.title.toLowerCase()}<ArrowRight aria-hidden="true" /></Link> : <p className={styles.restricted}>No disponible con los permisos actuales.</p>}
      </article>)}</div>
     </>}
    </section>
   </div>}
  </>}
  <footer className={styles.resources}>
   <h2>Herramientas de la empresa</h2><p>Revisá el contenido editorial, los informes y el consumo según los permisos de tu cuenta.</p>
   <div className={styles.resourceLinks}>
    {model.links.editorial ? <Link prefetch={false} className={styles.button} href={model.links.editorial}>Bandeja de revisión de pasaportes</Link> : null}
    {model.links.report ? <Link prefetch={false} className={styles.button} href={model.links.report}>Informe del piloto de la empresa</Link> : null}
    {model.links.usage ? <Link prefetch={false} className={styles.button} href={model.links.usage}>Uso y estado de servicios</Link> : null}
    {model.links.settings ? <Link prefetch={false} className={styles.button} href={model.links.settings}>Configuración de la cuenta</Link> : null}
   </div>
   <p className={styles.muted}>La publicación del pasaporte, las pruebas NFC y la aceptación del piloto se verifican por separado. Esta guía no modifica contenidos, unidades, permisos ni claves.</p>
  </footer>
 </section>;
}
