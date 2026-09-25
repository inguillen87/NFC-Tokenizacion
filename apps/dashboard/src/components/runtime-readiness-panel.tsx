'use client';
import { useEffect, useRef, useState } from 'react';
import { canReadRuntimeConsole, runtimeConsoleScopeKey, type RuntimeConsoleAccess } from '../lib/runtime-readiness-access';
import { RUNTIME_CONSOLE_FEATURES, RUNTIME_SNAPSHOT_TTL_MS, RUNTIME_STATUS_LABELS, runtimeNextStep, runtimeSupportSummary, runtimeObservedTime, runtimeSnapshotExpiresAt, type RuntimeSnapshot } from '../lib/runtime-readiness-contract';
import { fetchRuntimeSnapshot, RuntimeConsoleError } from '../lib/runtime-readiness-transport';
import styles from './runtime-readiness-panel.module.css';
type Phase='idle'|'reading'|'ready'|'expired'|'hidden'|'session'|'forbidden'|'unavailable'|'invalid';
const messages:Partial<Record<Phase,string>>={
  idle:'Consultá el estado cuando lo necesites. No hay sondeos automáticos ni consultas al abrir esta pantalla.',
  expired:'La observación venció. Se ocultó el detalle para no mostrar información antigua como vigente.',
  hidden:'Se ocultó la información al cambiar de pestaña. Consultá de nuevo para ver el estado actual.',
  session:'La sesión no está disponible o venció. Iniciá sesión como superadministrador para consultar el estado.',
  forbidden:'No se confirmó acceso al diagnóstico global. No se muestran datos de la observación anterior.',
  unavailable:'No se pudo confirmar el estado. Una consulta fallida no significa que no haya datos ni requisitos pendientes.',
  invalid:'La respuesta no cumple el contrato del diagnóstico. Se ocultó en lugar de presentar un estado incompleto.',
};
export function RuntimeReadinessPanel({access}:{access:RuntimeConsoleAccess}){
  if(!canReadRuntimeConsole(access))return <main className={styles.root}><h1>Estado operativo</h1><p role="alert">Este diagnóstico requiere una sesión global de superadministrador con acceso a auditoría.</p></main>;
  return <RuntimeWorkspace key={runtimeConsoleScopeKey(access)}/>;
}
function RuntimeWorkspace(){
  const [phase,setPhase]=useState<Phase>('idle'),[snapshot,setSnapshot]=useState<RuntimeSnapshot|null>(null);
  const [filter,setFilter]=useState<'all'|'pending'>('all'),[copyState,setCopyState]=useState('');
  const returnFocus=useRef(false),expiresAt=useRef(0);
  const alive=useRef(true),generation=useRef(0),active=useRef<AbortController|null>(null),readButton=useRef<HTMLButtonElement|null>(null);
  function hide(next:Phase){generation.current++;const previous=active.current;active.current=null;previous?.abort();setSnapshot(null);setCopyState('');setPhase(next);}
  useEffect(()=>{alive.current=true;const onVisibility=()=>{if(document.hidden)hide('hidden');};const onPageHide=()=>hide('hidden');
    document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',onPageHide);
    return()=>{alive.current=false;generation.current++;active.current?.abort();active.current=null;document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onPageHide);};
  },[]);
  useEffect(()=>{if(phase==='idle'&&returnFocus.current){returnFocus.current=false;readButton.current?.focus();}},[phase]);
  useEffect(()=>{if(!snapshot)return;const remaining=expiresAt.current-Date.now();const timer=setTimeout(()=>hide('expired'),Math.max(0,remaining));return()=>clearTimeout(timer);},[snapshot]);
  async function refresh(){
    if(active.current||document.hidden)return;
    const controller=new AbortController(),version=++generation.current;active.current=controller;setPhase('reading');setSnapshot(null);setCopyState('');
    try{const result=await fetchRuntimeSnapshot(controller.signal);if(!alive.current||generation.current!==version||document.hidden)return;
      if(Date.now()>=Date.parse(result.observedAt)+RUNTIME_SNAPSHOT_TTL_MS){hide('expired');return;}expiresAt.current=runtimeSnapshotExpiresAt(result.observedAt,Date.now());setSnapshot(result);setPhase('ready');}
    catch(error){if(alive.current&&generation.current===version){setSnapshot(null);const code=error instanceof RuntimeConsoleError?error.code:'unavailable';setPhase(code==='cancelled'?'idle':code);}}
    finally{if(active.current===controller)active.current=null;}
  }
  async function copy(){if(!snapshot)return;if(Date.now()>=expiresAt.current){hide('expired');return;}const version=generation.current;
    try{await navigator.clipboard.writeText(runtimeSupportSummary(snapshot));if(alive.current&&version===generation.current)setCopyState('Resumen copiado sin identificadores de infraestructura.');}
    catch{if(alive.current&&version===generation.current)setCopyState('No se pudo copiar automáticamente. El resumen está disponible para seleccionarlo.');}
  }
  const pending=snapshot?.requirements.filter(r=>r.status!=='named_prerequisites_present')||[];
  const visible=snapshot?.requirements.filter(r=>filter==='all'||r.status!=='named_prerequisites_present')||[];
  return <main className={styles.root} data-testid="runtime-console" data-state={phase}>
    <a href="/settings">Volver a configuración</a>
    <header className={styles.hero}><div><p className={styles.eyebrow}>Operación de NexID · sólo lectura</p><h1>Estado operativo</h1><p className={styles.muted}>Comprobá la conexión que usa la API, el registro de migraciones y los requisitos disponibles. Cada resultado corresponde a una consulta, no a un monitor permanente.</p></div>
      <button ref={readButton} className={styles.primary} type="button" data-testid="runtime-refresh" disabled={phase==='reading'} onClick={()=>void refresh()}>{phase==='reading'?'Consultando…':phase==='idle'?'Consultar estado actual':'Actualizar diagnóstico'}</button>
    </header>
    <div className={styles.notice}><strong>Consultar no modifica la plataforma.</strong><br/>Esta pantalla no ejecuta migraciones, no cambia permisos y no habilita funciones. La existencia de un requisito en la base no confirma que una función esté publicada o aceptada.</div>
    <p role="status" aria-live="polite" data-testid="runtime-status">{phase==='reading'?'Consultando una observación nueva…':phase==='ready'?`Observación recibida: ${runtimeObservedTime(snapshot!.observedAt)} UTC. Vigencia máxima: 60 segundos.`:messages[phase]}</p>
    {phase==='reading'?<button className={styles.button} type="button" data-testid="runtime-cancel" onClick={()=>{returnFocus.current=true;hide('idle');}}>Cancelar consulta</button>:null}
    {phase==='session'?<a className={styles.button} href="/settings/runtime">Volver a validar la sesión</a>:null}
    {snapshot?<div data-testid="runtime-result">
      {snapshot.enabledWithoutPrerequisites.length?<div role="alert" className={`${styles.notice} ${styles.danger}`} data-testid="runtime-inconsistent"><strong>Hay funciones habilitadas sin sus requisitos nombrados.</strong><br/>Revisá los interruptores de despliegue y la base antes de operar. Esta pantalla no los modifica.</div>:null}
      <div className={styles.metrics}><div className={styles.metric}><strong>{snapshot.requirements.length-pending.length}</strong><span>Bloques con requisitos nombrados presentes</span></div><div className={styles.metric}><strong>{pending.length}</strong><span>Bloques con requisitos pendientes</span></div><div className={styles.metric}><strong>{snapshot.enabledWithoutPrerequisites.length}</strong><span>Funciones habilitadas sin requisitos</span></div></div>
      <section className={styles.card} aria-labelledby="runtime-steps"><h2 id="runtime-steps">Qué revisar a continuación</h2><p className={styles.muted}>Los filtros no vuelven a consultar la API. No uses el número de migraciones para decidir qué archivos ejecutar.</p>
        <div className={styles.toolbar} role="group" aria-label="Filtrar requisitos"><button type="button" className={styles.button} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Todos los bloques</button><button type="button" className={styles.button} aria-pressed={filter==='pending'} onClick={()=>setFilter('pending')}>Sólo pendientes</button></div>
        {!visible.length?<p className={styles.empty}>No hay requisitos nombrados pendientes en esta consulta. Todavía falta validar la publicación compatible y el recorrido autenticado.</p>:null}
        <ul className={styles.featureList}>{visible.map(row=>{const meta=RUNTIME_CONSOLE_FEATURES.find(f=>f.id===row.id)!;const flag=snapshot.featureFlags[row.id as keyof typeof snapshot.featureFlags];return <li key={row.id} className={styles.feature} data-testid={`runtime-feature-${row.id}`}>
          <div className={styles.featureHeader}><h3>{meta.label}</h3><span className={`${styles.badge} ${row.status==='named_prerequisites_present'?styles.present:styles.missing}`}>{RUNTIME_STATUS_LABELS[row.status]}</span></div>
          {flag?<p className={styles.muted}>Interruptor de la API: <strong>{flag.enabled?'habilitado':flag.configured?'desactivado':'sin configurar (no habilitado)'}</strong>.</p>:null}
          <p>{runtimeNextStep(snapshot,row.id)}</p>
          {(row.missingMigrations.length||row.missingFunctions.length||row.unavailableExecute.length)?<details><summary>Ver requisitos que faltan</summary>
            {row.missingMigrations.length?<><p>Sin registro de aplicación:</p><ul>{row.missingMigrations.map(id=><li key={id}><code>{id}</code></li>)}</ul></>:null}
            {row.missingFunctions.length?<><p>Funciones SQL no encontradas:</p><ul>{row.missingFunctions.map(id=><li key={id}><code>{id}</code></li>)}</ul></>:null}
            {row.unavailableExecute.length?<><p>Funciones existentes sin permiso de ejecución:</p><ul>{row.unavailableExecute.map(id=><li key={id}><code>{id}</code></li>)}</ul></>:null}
          </details>:null}</li>;})}</ul>
      </section>
      <section className={styles.card} aria-labelledby="runtime-connection"><h2 id="runtime-connection">Conexión e identidad del proceso</h2>
        <div className={`${styles.notice} ${snapshot.privilegedConnection?styles.warning:''}`}><strong>{snapshot.privilegedConnection?'La conexión presenta privilegios amplios.':'No se observaron los indicadores de privilegio amplio consultados.'}</strong><br/>Esto no es una auditoría completa de permisos. Revisá el rol real sin convertirlo en dueño para resolver un fallo.</div>
        <p className={styles.muted}>Estos identificadores proceden del diagnóstico. La correspondencia con el proyecto y la rama del proveedor debe verificarse por separado.</p>
        <details data-testid="runtime-identity"><summary>Ver identificadores de la conexión y el despliegue</summary><dl className={styles.identity}>
          {[['Entorno declarado',snapshot.runtime.environment],['Despliegue',snapshot.runtime.deploymentId||'No informado'],['Commit de la API',snapshot.runtime.commit||'No informado'],['Base de datos',snapshot.database.name],['Usuario SQL efectivo',snapshot.database.sessionRole],['Usuario SQL de conexión',snapshot.database.loginRole],['Endpoint Neon',snapshot.database.endpointId||'No informado'],['Versión interna PostgreSQL',String(snapshot.database.serverVersionNumber)],['Transacción SQL de sólo lectura',snapshot.database.transactionReadOnly?'Sí':'No; el diagnóstico sólo consulta']].map(([name,value])=><div key={name}><dt>{name}</dt><dd className={styles.mono}>{value}</dd></div>)}
        </dl></details>
        <p><strong>{snapshot.ledger.count}</strong> entradas en el registro de migraciones consultado. No implica que deban ejecutarse todos los archivos del repositorio que no estén registrados.</p>
        {(snapshot.ledger.requiredRuntimeMissing.length||snapshot.catalogs.missingCarriers.length||snapshot.catalogs.missingLedgerProviders.length)?<details open><summary>Requisitos base pendientes</summary><ul>{[...snapshot.ledger.requiredRuntimeMissing,...snapshot.catalogs.missingCarriers,...snapshot.catalogs.missingLedgerProviders].map((id,index)=><li key={index}><code>{id}</code></li>)}</ul></details>:null}
      </section>
      <section className={styles.card}><h2>Resumen para revisión técnica</h2><p className={styles.muted}>Texto para compartir sin nombres de base, usuarios SQL, endpoint ni identificadores de despliegue. Revisalo antes de copiarlo.</p>
        <details data-testid="runtime-summary"><summary>Ver resumen sin identificadores</summary><pre tabIndex={0}>{runtimeSupportSummary(snapshot)}</pre><button className={styles.button} type="button" data-testid="runtime-copy" onClick={()=>void copy()}>Copiar resumen sin identificadores</button><p role="status">{copyState}</p></details>
      </section>
    </div>:null}
    <footer className={styles.muted}><strong>Límites de esta comprobación:</strong> no valida el contenido histórico completo de migraciones, las huellas de todas las funciones, todos los permisos de tablas, compatibilidad del panel, aceptación del proveedor ni etiquetas físicas.</footer>
  </main>;
}
