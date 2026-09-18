"use client";
import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Boxes, ClipboardList, FileText, Layers, ScanLine, Settings2, ShieldCheck } from "lucide-react";
import { batchStateLabel, dossierTabFromHash, dossierTasks, nextDossierTab, type BatchDossier, type DossierAccess, type DossierTab } from "../lib/batch-dossier-model";
import styles from "./batch-dossier.module.css";
const TABS = [
  {id:"overview",label:"Resumen",icon:ClipboardList},
  {id:"product",label:"Producto",icon:FileText},
  {id:"units",label:"Unidades y recepción",icon:Layers},
  {id:"readings",label:"Lecturas",icon:ScanLine},
  {id:"operations",label:"Operación y calidad",icon:Settings2},
] as const;
export function dossierNumber(value:number|null) { return value===null?"—":value.toLocaleString("es-AR"); }
export function dossierDate(value:string|null) { return value?new Intl.DateTimeFormat("es-AR",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(value))+" UTC":"No informado"; }
type Props = {model:BatchDossier;access:DossierAccess;product:ReactNode;units:ReactNode;readings:ReactNode;operations:ReactNode};
export function BatchDossierShell({model,access,product,units,readings,operations}:Props) {
  const [active,setActive]=useState<DossierTab>("overview");
  const [focused,setFocused]=useState<DossierTab>("overview");
  const buttons=useRef<Partial<Record<DossierTab,HTMLButtonElement|null>>>({});
  useEffect(()=>{
    const restore=()=>{const tab=dossierTabFromHash(window.location.hash);if(tab){setActive(tab);setFocused(tab);}};
    restore();window.addEventListener("hashchange",restore);return()=>window.removeEventListener("hashchange",restore);
  },[]);
  function select(tab:DossierTab,focus=false) {
    setActive(tab);setFocused(tab);
    window.history.replaceState(window.history.state,"",`#dossier-${tab}`);
    if(focus)buttons.current[tab]?.focus({preventScroll:true});
  }
  function followLocalAction(event:MouseEvent<HTMLElement>) {
    const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href^="#"]'):null;
    const tab=link?dossierTabFromHash(link.hash):null;
    if(!tab || !link)return;
    event.preventDefault();select(tab,true);
    requestAnimationFrame(()=>{const target=document.getElementById(link.hash.slice(1));if(target instanceof HTMLDetailsElement)target.open=true;target?.scrollIntoView({block:"nearest"});});
  }
  const metrics=[["Registradas",model.imported,"Conteo informado por el lote"],["Activas",model.active,"No certifica aceptación de calidad"],["No activas",model.pending,"No equivale a incidencias"],["Solicitadas",model.expected,"Declarada en la configuración"]] as const;
  const panels={overview:<Overview model={model} access={access} select={tab=>select(tab,true)} />,product,units,readings,operations};
  return <main className={styles.root} data-testid="batch-dossier" onClickCapture={followLocalAction}>
    <div className={styles.topline}><Link href={`/batches/${encodeURIComponent(model.bid)}/passport`} prefetch={false}>Passport Studio <ArrowUpRight size={14} aria-hidden="true"/></Link><Link href="/batches" prefetch={false}><ArrowLeft size={14} aria-hidden="true"/>Rollos y productos</Link><span>Consultado: {dossierDate(model.checkedAt)} · sin actualización automática</span></div>
    <div className={styles.hero}>
      <span className={styles.mark}><Boxes size={26} aria-hidden="true"/></span>
      <div className={styles.heroCopy}><p className={styles.eyebrow}>Expediente del lote · {access.demo?"entorno de demostración":model.tenant}</p><h1 className={styles.title}>{model.name || "Producto por completar"}</h1><p className={styles.meta}><span>BID <code>{model.bid}</code></span><span>SKU: {model.sku||"No configurado"}</span><span>Lote comercial: {model.publicLot||"No configurado"}</span></p></div>
      <span className={styles.badge} data-warning={model.status==="revoked"||model.status==="blocked"}>{batchStateLabel(model.status)}</span>
    </div>
    <div className={styles.metrics}>{metrics.map(([label,value,detail])=><div className={styles.metric} key={label}><span>{label}</span><strong>{dossierNumber(value)}</strong><small>{detail}</small></div>)}</div>
    {model.countIssue&&<p className={styles.notice} data-warning="true" role="status">La fuente informa más etiquetas activas que registradas. Revisá el lote; no se calcula un saldo artificial.</p>}
    <div role="tablist" aria-label="Secciones del expediente" className={styles.tabs} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setFocused(active);}}>
      {TABS.map(tab=><button key={tab.id} ref={element=>{buttons.current[tab.id]=element;}} type="button" role="tab" id={`dossier-tab-${tab.id}`} aria-controls={`dossier-${tab.id}`} aria-selected={active===tab.id} tabIndex={focused===tab.id?0:-1} onClick={()=>select(tab.id)} onKeyDown={event=>{const next=nextDossierTab(tab.id,event.key);if(next){event.preventDefault();setFocused(next);buttons.current[next]?.focus();}}}><tab.icon size={16} aria-hidden="true"/>{tab.label}</button>)}
    </div>
    {TABS.map(tab=><section key={tab.id} id={`dossier-${tab.id}`} role="tabpanel" aria-labelledby={`dossier-tab-${tab.id}`} tabIndex={0} hidden={active!==tab.id} className={styles.panel}>{panels[tab.id]}</section>)}
  </main>;
}
function Overview({model,access,select}:{model:BatchDossier;access:DossierAccess;select:(tab:DossierTab)=>void}) {
  const keyStatus=model.hasMetaKey===null || model.hasFileKey===null ? "Estado no informado" : model.hasMetaKey && model.hasFileKey ? "Ambas referencias registradas" : model.hasMetaKey || model.hasFileKey ? "Referencias incompletas" : "Sin referencias registradas";
  return <div className={styles.grid}>
    <div className={styles.stack}>
      <section className={styles.card}><h2>El siguiente paso, sin salir del lote.</h2><p>Cada sección conserva su función. No se activa una etiqueta por completar esta ficha.</p>
        {dossierTasks(model,access).map((task,index)=><article className={styles.task} key={task.tab}>
          <span className={styles.stepNumber} aria-hidden="true">0{index+1}</span><div><h3>{task.title}</h3><p>{task.detail}</p><span className={styles.badge}>{task.state}</span></div>
          <button type="button" className={styles.button} onClick={()=>select(task.tab)}>{task.action}<ArrowUpRight size={14} aria-hidden="true"/></button>
        </article>)}
      </section>
      <section className={styles.card}><h2>Identidad compartida</h2><p>Estos datos corresponden al producto del lote, no a la posición o custodia de cada unidad.</p><dl className={styles.facts}>
        {[["Marca / fabricante",model.brand],["Lote comercial visible",model.publicLot],["Región declarada",model.region],["Creado",dossierDate(model.createdAt)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"No informado"}</dd></div>)}
      </dl></section>
    </div>
    <aside className={styles.stack} aria-label="Evidencia y alcance del expediente">
      <section className={styles.card}><p className={styles.eyebrow}>Datos, no supuestos</p><h2>Contexto técnico</h2><dl className={styles.facts} style={{gridTemplateColumns:"1fr"}}>
        <div><dt>Perfil NFC</dt><dd>{model.carrier||"No informado"}</dd></div><div><dt>Referencias de claves</dt><dd>{keyStatus}</dd></div><div><dt>Metadata de unidades</dt><dd>{dossierNumber(model.metadataUnits)} registros</dd></div><div><dt>Excepciones de producto por UID</dt><dd>{dossierNumber(model.overrides)}</dd></div>
      </dl><p>La presencia de referencias no demuestra que el chip esté correctamente personalizado ni aprueba el control físico.</p></section>
      <section className={styles.card}><h2>Vincular la operación</h2><p>Las referencias de caja, pallet o contenedor solo se muestran si están declaradas en la muestra del manifiesto. No se inventa un recorrido GPS.</p><div className={styles.actions}>
        {access.map&&<Link href={`/analytics/map?tenant=${encodeURIComponent(model.tenant)}&bid=${encodeURIComponent(model.bid)}`} prefetch={false} className={`${styles.button} ${styles.primary}`}>Mapa del lote<ArrowUpRight size={14} aria-hidden="true"/></Link>}
        {access.supplier&&<Link href="/batches/supplier#supplier-order-console" prefetch={false} className={styles.button}>Protocolo de calidad</Link>}
      </div></section>
      <p className={styles.notice}><ShieldCheck size={17} aria-hidden="true"/><span>Fuente: resumen administrativo del lote. Un registro activo no certifica contenido, compra, propiedad ni aprobación de QA.</span></p>
    </aside>
  </div>;
}
