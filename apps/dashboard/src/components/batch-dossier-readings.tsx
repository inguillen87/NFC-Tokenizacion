"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, RefreshCw, ScanLine } from "lucide-react";
import { dossierRange, requestDossierReadings, type DossierRange, type DossierReading } from "../lib/batch-dossier-readings";
import { mapLocationDescription } from "../lib/map-location-evidence";
import { dossierDate } from "./batch-dossier-shell";
import styles from "./batch-dossier.module.css";
const ERRORS={forbidden:"La sesión no tiene permiso para consultar estas lecturas.",unavailable:"La fuente no respondió correctamente. No se interpreta como cero lecturas.",invalid:"La respuesta no coincide con el contrato, el lote o la empresa. No se muestran datos de otro alcance.",timeout:"La consulta no respondió a tiempo. Podés volver a solicitarla.",cancelled:"Consulta cancelada. No se modificó ninguna lectura."};
export function BatchDossierReadings({bid,tenant,allowed,canMap,demo}:{bid:string;tenant:string;allowed:boolean;canMap:boolean;demo:boolean}) {
  const [range,setRange]=useState<DossierRange>("24h"),[result,setResult]=useState<DossierReading|null>(null);
  const [pending,setPending]=useState(false),[cooling,setCooling]=useState(false);
  const activeRequest=useRef<AbortController|null>(null),sequence=useRef(0),cooldown=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{sequence.current++;activeRequest.current?.abort();if(cooldown.current)clearTimeout(cooldown.current);},[]);
  async function load() {
    if(!allowed||demo||activeRequest.current||cooling)return;
    const controller=new AbortController();activeRequest.current=controller;const id=++sequence.current;
    const timer=setTimeout(()=>controller.abort(new DOMException("deadline","TimeoutError")),12000);
    setPending(true);setResult(null);
    const next=await requestDossierReadings({fetcher:(url,init)=>fetch(url,init),tenant,bid,range,signal:controller.signal});
    clearTimeout(timer);
    if(id!==sequence.current)return;
    activeRequest.current=null;setPending(false);setResult(next);setCooling(true);
    cooldown.current=setTimeout(()=>setCooling(false),2000);
  }
  const payload=result?.state==="ready"?result.payload:null;
  return <section className={styles.card} data-testid="batch-dossier-readings">
    <h2>Lecturas físicas de este lote</h2><p>Consulta explícita de hasta 20 registros recientes. Cambiar de sección no carga lecturas, ni abre una conexión de tiempo real.</p>
    {!allowed||demo?<p className={styles.notice}>{demo?"La sesión demo no consulta ni simula las lecturas productivas.":"Necesitás events.read_sensitive para consultar las lecturas. El administrador de tu empresa gestiona ese permiso."}</p>:<>
      <div className={styles.toolbar}><label className={styles.field}>Ventana de lecturas<select value={range} disabled={pending} onChange={event=>{setRange(dossierRange(event.target.value));setResult(null);}}><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option></select></label>
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={pending||cooling} onClick={()=>void load()}><RefreshCw size={15} aria-hidden="true"/>{pending?"Consultando…":cooling?"Esperá un momento":"Consultar lecturas del lote"}</button>
        {pending&&<button type="button" className={styles.button} onClick={()=>activeRequest.current?.abort()}>Cancelar consulta</button>}
      </div>
      <p role="status" aria-live="polite" className={styles.note}>{pending?"Consultando el lote autorizado; todavía no se confirma un resultado.":result?.state==="ready"?`${result.payload.rows.length} lecturas en la muestra. Consulta: ${dossierDate(result.checkedAt)}.`:result?ERRORS[result.state]:"Sin consultar. No se interpreta como ausencia de TAP."}</p>
      {payload&&<>
        <div className={styles.notice}><ScanLine size={17} aria-hidden="true"/><span>{payload.summary.total} lecturas en la muestra · {payload.summary.closed} precintos reportados cerrados · {payload.summary.opened} abiertos · {payload.summary.other} sin conclusión. La autenticidad del mensaje y el estado del precinto son evidencias diferentes.</span></div>
        {payload.rows.length?<div className={styles.tableWrap}><table className={styles.table}><caption>Fuente: lecturas persistidas · empresa y lote verificados · muestra, no total histórico</caption><thead><tr><th scope="col">Lectura</th><th scope="col">Mensaje y precinto</th><th scope="col">Ubicación y evidencia</th></tr></thead><tbody>{payload.rows.map(row=><tr key={row.eventId}>
          <td><strong>{dossierDate(row.occurredAt.utc)}</strong><small>UID: {row.uidMasked}</small><small>Evento: {row.eventId}</small></td>
          <td>{row.messageValid&&row.evidence.messageAuthentication==="validated"?"Mensaje validado":"Validación no confirmada"}<small>Precinto: {row.sealState==="closed"?"cerrado reportado":row.sealState==="opened"?"abierto reportado":"sin conclusión"}</small></td>
          <td>{mapLocationDescription({lat:row.location.lat,lng:row.location.lng,locationSource:row.location.source})}<small>{[row.location.city,row.location.country].filter(Boolean).join(", ")||"Ciudad no informada"}</small><details><summary>Ver precisión y contador</summary><p>Precisión informada: {row.location.accuracyM===null?"desconocida":`± ${row.location.accuracyM} m`}<br/>Contador: {row.readCounter===null?"No informado":row.readCounter}</p></details></td>
        </tr>)}</tbody></table></div>:<p className={styles.notice}>La fuente confirmó una muestra vacía para este lote y esta ventana.</p>}
      </>}
    </>}
    {canMap&&<div className={styles.actions} style={{marginTop:16}}><Link prefetch={false} href={`/analytics/map?tenant=${encodeURIComponent(tenant)}&bid=${encodeURIComponent(bid)}&range=${range}`} className={styles.button}><MapPin size={15} aria-hidden="true"/>Abrir mapa de este lote</Link></div>}
  </section>;
}
