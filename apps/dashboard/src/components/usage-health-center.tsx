"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowUpRight, ChevronDown, Clock3, Copy, Download, RefreshCw, ShieldCheck } from "lucide-react";
import { diagnosticEvidence, healthSummary, needsAttention, serviceState, type HealthSnapshot, type Reading, type SdkUsage, type ServiceId } from "../lib/usage-health-model";
import { METRIC_LABEL, SERVICE_CATALOG, STATE_LABEL } from "../lib/usage-health-catalog";
import { RUNBOOKS } from "../lib/usage-health-runbooks";
import styles from "./usage-health.module.css";
const number = (value:number|null|undefined) => value==null ? "—" : value.toLocaleString("es-AR");
const percent = (value:number|null) => value===null ? "—" : `${(value*100).toLocaleString("es-AR",{maximumFractionDigits:3})}%`;
const time = (value:string) => new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"medium",timeZone:"UTC"}).format(new Date(value));
const signalValue=(value:number,unit:string)=>unit==="count"?number(value):value<60?`${Math.round(value)} s`:value<3600?`${Math.round(value/60)} min`:`${(value/3600).toFixed(1)} h`;
export function UsageHealthCenter({health,sdk,canExport,loadSdkHref,links}:{health:Reading<HealthSnapshot>;sdk:Reading<SdkUsage>;canExport:boolean;loadSdkHref:string|null;links:Partial<Record<ServiceId,string>>}) {
  const router=useRouter();const [pending,startTransition]=useTransition();const [cooldown,setCooldown]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const [message,setMessage]=useState("");
  const [filter,setFilter]=useState<"all"|"attention"|"sample">("all");
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  const snapshot=health.state==="ready"?health.data:null;const summary=healthSummary(snapshot);
  const services=snapshot?.services||[];
  const visible=services.filter(service=>filter==="all" || (filter==="attention"?needsAttention(serviceState(service)):["no_data","insufficient_data"].includes(serviceState(service))));
  const attention=services.filter(service=>needsAttention(serviceState(service)));
  function refresh(){if(pending||cooldown)return;setCooldown(true);timer.current=setTimeout(()=>setCooldown(false),30000);startTransition(()=>router.refresh());}
  async function copy(){if(!canExport||!snapshot)return;try{await navigator.clipboard.writeText(JSON.stringify(diagnosticEvidence(snapshot,sdk,health.checkedAt),null,2));setMessage("Resumen copiado. No contiene credenciales, UIDs, direcciones ni contenido de eventos.");}catch{setMessage("El navegador no permitió copiar. Podés descargar el mismo resumen.");}}
  function download(){if(!canExport||!snapshot)return;const blob=new Blob([JSON.stringify(diagnosticEvidence(snapshot,sdk,health.checkedAt),null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download="nexid-estado-operativo.json";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("Resumen descargado: incluye la ventana y las limitaciones de la medición.");}
  return <div data-testid="usage-health-center" data-source-state={health.state}>
    <div className={styles.actions}>
      <button type="button" className={`${styles.button} ${styles.primary}`} onClick={refresh} disabled={pending||cooldown} aria-busy={pending}><RefreshCw size={15}/>{pending?"Consultando…":cooldown?"Consulta solicitada · pausa 30 s":"Actualizar estado"}</button>
      <button type="button" className={styles.button} onClick={()=>void copy()} disabled={!canExport||!snapshot} title={!canExport?"Requiere permiso reports.export":undefined}><Copy size={15}/>Copiar para soporte</button>
      <button type="button" className={styles.button} onClick={download} disabled={!canExport||!snapshot} title={!canExport?"Requiere permiso reports.export":undefined}><Download size={15}/>Descargar evidencia</button>
    </div>
    <p className={styles.srStatus} role="status" aria-live="polite">{message}</p>
    <div className={styles.timestamp}><Clock3 size={14}/><span>Consultado: <strong>{time(health.checkedAt)} UTC</strong></span>{snapshot&&<span>Datos observados: <strong>{time(snapshot.observedAt)} UTC</strong></span>}<span>Sin actualización automática</span></div>
    <div className={styles.strip}>
      <div className={styles.metric}><span>Lecturas SUN guardadas</span><strong data-testid="health-sun-count">{number(summary?.sunRecords)}</strong><small>{summary?.sunRecords!=null?`${number(summary.sunComplete)} con evidencia completa en la ventana.`:"Fuente no confirmada; no se infiere cero actividad."}</small></div>
      <div className={styles.metric}><span>Fuentes que respondieron</span><strong>{summary?`${summary.responding} / ${summary.total}`:"—"}</strong><small>Respuesta de las consultas. No representa disponibilidad del servicio.</small></div>
      <div className={styles.metric}><span>Servicios para revisar</span><strong>{number(summary?.attention)}</strong><small>Incluye fuentes no disponibles. No se enviaron avisos automáticos.</small></div>
      <div className={styles.metric}><span>Solicitudes SDK del mes</span><strong data-testid="health-sdk-count">{sdk.state==="ready"?number(sdk.data.monthRequests):"—"}</strong><small>{sdk.state==="ready"?"Registros SDK; no es el total de TAP ni de visitas.":sdk.state==="not_requested"?"Consulta opcional, separada de las métricas de servicio.":"No disponibles para esta consulta."}</small></div>
    </div>
    <div className={styles.notice}><ShieldCheck size={20}/><div><strong>La evidencia guardada no mide toda la disponibilidad.</strong> Los fallos anteriores a la persistencia deben revisarse en los logs del servicio. Esta pantalla no los cuenta como éxitos ni demuestra que no hayan ocurrido.</div></div>
    {!snapshot&&<div className={styles.empty} role="status"><strong>{health.state==="demo"?"No se muestran métricas de demostración como si fueran SLOs.":health.state==="forbidden"?"La sesión no está autorizada para leer esta fuente.":health.state==="timeout"?"La consulta no respondió dentro del plazo.":"No se pudo confirmar un snapshot válido para este alcance."}</strong><p>El tablero no sustituye esa ausencia con ceros ni datos simulados. No se infiere un estado saludable. Conservá la ventana, verificá la sesión y actualizá manualmente.</p></div>}
    <div className={styles.split}><section className={styles.main} aria-labelledby="health-services-title">
      <div className={styles.sectionTitle}><h2 id="health-services-title">Operación por servicio</h2><span className={styles.badge}>Consulta de solo lectura</span></div>
      <div className={styles.filters} role="group" aria-label="Filtrar servicios">{([["all","Todos"],["attention","Requieren revisión"],["sample","Sin muestra suficiente"]] as const).map(([value,label])=><button type="button" key={value} onClick={()=>setFilter(value)} aria-pressed={filter===value}>{label}</button>)}</div>
      {snapshot&&!visible.length&&<p className={styles.empty}>No hay servicios en este filtro dentro del snapshot consultado. No es una certificación global de disponibilidad.</p>}
      {visible.map(service=>{
        const meta=SERVICE_CATALOG[service.id],state=serviceState(service),guide=RUNBOOKS[meta.runbook];
        return <details key={service.id} id={`health-${service.id}`} className={styles.service} data-testid={`health-service-${service.id}`}>
          <summary><span className={styles.icon}>{needsAttention(state)?<AlertTriangle size={17}/>:<Activity size={17}/>}</span><div><h3>{meta.title}</h3><p>{meta.caption}</p></div><span className={styles.badge} data-state={state}>{STATE_LABEL[state]}<ChevronDown size={13} className={styles.chevron} aria-hidden="true"/></span></summary>
          <div className={styles.detail}>
            {service.availability==="unavailable"&&<p>La fuente no respondió con métricas disponibles. Se mantienen los valores desconocidos; no se reemplazan por cero.</p>}
            {service.indicators.map(indicator=><section className={styles.indicator} key={indicator.id}>
              <h4>{METRIC_LABEL[indicator.id]||"Indicador del servicio"}</h4>
              <div className={styles.values}><div><b>{percent(indicator.ratio)}</b><small> · {number(indicator.goodEvents)} de {number(indicator.eligibleEvents)} eventos elegibles</small></div><span className={styles.badge} data-state={indicator.state}>{STATE_LABEL[indicator.state]}</span></div>
              {indicator.ratio!==null&&<div className={styles.progress} aria-hidden="true"><span style={{width:`${indicator.ratio*100}%`}}/></div>}
              <div className={styles.values}><small>Objetivo: {percent(indicator.target)} · muestra mínima: {number(indicator.minimumSample)}</small><small>No conformes: {number(indicator.badEvents)}</small></div>
              <details className={styles.technical}><summary>Definición técnica y margen del objetivo</summary><dl><div><dt>Identificador</dt><dd><code>{indicator.id}</code></dd></div><div><dt>Margen de error restante</dt><dd>{percent(indicator.errorBudgetRemaining)} · no es dinero</dd></div><div><dt>Consumo relativo del margen</dt><dd>{number(indicator.burnRate)}×</dd></div><div><dt>Fuente</dt><dd>Agregado persistido · ventana {snapshot?.window.id}</dd></div></dl></details>
            </section>)}
            {service.signals.map(signal=><div className={styles.indicator} key={signal.id}><h4>{METRIC_LABEL[signal.id]||"Señal operativa"}</h4><div className={styles.values}><b>{signalValue(signal.value,signal.unit)}</b><span className={styles.badge} data-state={signal.state}>{STATE_LABEL[signal.state]}</span></div><p className={styles.footnote}><code>{signal.id}</code> · investigar desde {signalValue(signal.warningThreshold,signal.unit)}; prioridad desde {signalValue(signal.criticalThreshold,signal.unit)}. Estado de la cola al consultar, no un total de eventos del período.</p></div>)}
            <div className={styles.guide}><strong>Qué revisar primero</strong><p>{guide.firstResponse}</p><details><summary>Escalamiento y precauciones</summary><p>{guide.escalation}</p></details><div className={styles.actions}>{links[service.id]&&<Link href={links[service.id]!} prefetch={false} className={styles.button}>{meta.action}<ArrowUpRight size={14}/></Link>}<span className={styles.badge}>Guía · {meta.runbook}</span></div></div>
          </div>
        </details>;
      })}
    </section>
    <aside className={styles.aside} aria-label="Uso y próximos pasos">
      <section className={styles.panel}><h2>Uso mensual del SDK</h2><p>El mes comienza según el corte mensual de la base de datos, no según la ventana seleccionada arriba.</p>
        {sdk.state==="ready"?<dl><dt>Solicitudes registradas</dt><dd>{number(sdk.data.monthRequests)}</dd><dt>Latencia media registrada</dt><dd>{sdk.data.avgLatencyMs===null?"Sin muestra":`${number(sdk.data.avgLatencyMs)} ms`}</dd><dt>Consultado</dt><dd>{time(sdk.checkedAt)} UTC</dd></dl>:<p>{sdk.state==="not_requested"?"Todavía no consultado. Se carga únicamente al pedirlo.":sdk.state==="forbidden"?"Tu rol no tiene permiso para consultar esta fuente.":sdk.state==="demo"?"No se usan datos demo como consumo productivo.":"La fuente de uso no pudo confirmarse; no se infiere consumo cero."}</p>}
        {loadSdkHref&&sdk.state!=="ready"&&<Link prefetch={false} href={loadSdkHref} className={styles.button}>Consultar uso SDK<ArrowUpRight size={14}/></Link>}
        <p>No incluye necesariamente toda la API, los TAP directos ni solicitudes que no llegaron a registrarse. No se suman como si fueran la misma métrica.</p>
      </section>
      <section className={styles.panel}><h2>Capacidad y costos</h2><dl><dt>Uso operativo</dt><dd>Medido por las fuentes disponibles</dd><dt>Almacenamiento y cómputo contratados</dt><dd>No conectados a esta vista</dd><dt>Factura y límite monetario</dt><dd>No disponibles · no se infiere $0</dd></dl><p>Consultar este centro no cambia planes ni límites del proveedor. Una alerta no es un tope de gasto.</p></section>
      <section className={styles.panel}><h2>Prioridades de revisión</h2>{!snapshot?<p>Necesitás una fuente confirmada para evaluar prioridades.</p>:attention.length?attention.map(service=><a key={service.id} className={styles.followup} href={`#health-${service.id}`} onClick={()=>{setFilter("all");requestAnimationFrame(()=>{const element=document.getElementById(`health-${service.id}`) as HTMLDetailsElement|null;if(element){element.open=true;element.querySelector("summary")?.focus();}});}}>{SERVICE_CATALOG[service.id].title}<span>{STATE_LABEL[serviceState(service)]} · abrir guía</span></a>):<p>No hay prioridades en este snapshot. Revisá la muestra y las fuentes antes de concluir que toda la operación está saludable.</p>}
        <p>Son candidatos de revisión, no tickets creados ni notificaciones enviadas.</p>
      </section>
    </aside></div>
    <p className={styles.footnote}>Contratos de respuesta: la evaluación visible corresponde a una sola ventana. Paging automático requiere conectar el endpoint a un sistema de alertas y verificar ambas ventanas: prioridad 1h/24h; investigación 24h/7d. No se inicia desde esta pantalla.</p>
  </div>;
}
