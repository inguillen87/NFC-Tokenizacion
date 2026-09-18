"use client";
import {useRef,useState} from 'react';
import Link from 'next/link';
import {Download,Check,Copy,Terminal,FileSpreadsheet,KeyRound,Webhook,PackageCheck} from 'lucide-react';
import manifest from '../lib/integration-kit-manifest.json';
import {readIntegrationKitBytes} from '../lib/integration-kit-download';
import {integrationShellArgument} from '../lib/integration-kit-policy';
import styles from './integration-kit-console.module.css';
type Mode='local'|'read'|'receipts'|'webhook';
const template='external_id,bid,occurred_at,facility\nRECEPCION-00042,MI-LOTE,2026-09-18T12:30:00-03:00,DEPOSITO-01\n';
function saveBlob(blob:Blob,filename:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function IntegrationKitConsole({canDownload,tenant}:{canDownload:boolean;tenant:string|null}){
 const [mode,setMode]=useState<Mode>('local'),[company,setCompany]=useState(tenant||''),[bid,setBid]=useState(''),[pending,setPending]=useState(false),[status,setStatus]=useState(''),[copied,setCopied]=useState(false);const inflight=useRef(false);
 const tenantArg=integrationShellArgument(company,'mi-empresa'),bidArg=integrationShellArgument(bid,'MI-LOTE');
 const commands:Record<Mode,string>={
  local:'node verify-kit.mjs\nnpm install --offline --ignore-scripts --no-audit --no-fund\nnpm test',
  read:`node src/cli.mjs doctor --tenant ${tenantArg} --bid ${bidArg}`,
  receipts:`node src/cli.mjs plan --tenant ${tenantArg} --connector erp-main --file recepciones.csv\nnode src/cli.mjs status --tenant ${tenantArg} --connector erp-main\n# Enviar sólo después de revisar el plan y configurar NEXID_API_KEY\nnode src/cli.mjs send --tenant ${tenantArg} --connector erp-main --confirm-tenant ${tenantArg} --limit 10`,
  webhook:`node src/cli.mjs webhook --tenant ${tenantArg} --connector erp-main --tenant-id UUID-DE-LA-EMPRESA --port 8788`,
 };
 async function download(){if(inflight.current||!canDownload)return;inflight.current=true;setPending(true);setStatus('');try{
  const r=await fetch('/api/integration-kit',{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(r.status===401?'La sesión venció. Ingresá de nuevo.':r.status===403?'La cuenta necesita acceso de lectura a credenciales para descargar el kit.':'No se pudo recuperar el artefacto verificado.');
  if((r.headers.has('content-length')&&Number(r.headers.get('content-length'))!==manifest.bytes)||r.headers.get('x-content-sha256')!==manifest.sha256)throw new Error('La versión descargada no coincide. Recargá la página antes de continuar.');
  const bytes=await readIntegrationKitBytes(r,manifest.bytes);
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>))].map(v=>v.toString(16).padStart(2,'0')).join('');if(digest!==manifest.sha256)throw new Error('La comprobación de integridad falló. No se guardó el archivo.');
  saveBlob(new Blob([bytes as Uint8Array<ArrayBuffer>],{type:'application/gzip'}),manifest.filename);setStatus('Kit descargado y SHA-256 comprobado. La descarga no ejecutó llamadas de negocio.');
 }catch(e){setStatus(e instanceof Error?e.message:'No se confirmó la descarga.');}finally{inflight.current=false;setPending(false);}}
 async function copy(){try{await navigator.clipboard.writeText(commands[mode]);setCopied(true);}catch{setStatus('No se pudo copiar automáticamente. Seleccioná el comando del recuadro.');}}
 return <section className={styles.root} data-testid="integration-kit-console" aria-labelledby="integration-kit-title">
  <header className={styles.header}><div><p className={styles.kicker}>S5 · HERRAMIENTAS EJECUTABLES</p><h2 id="integration-kit-title">Conectá el sistema del cliente.</h2><p>SDK privado instalable, importador CSV y receptor de webhooks. Sin entregar el repositorio ni cargar secretos en el navegador.</p></div><span className={styles.version}><PackageCheck size={19} aria-hidden="true"/>Kit {manifest.version}</span></header>
  <div className={styles.downloads}><button type="button" className={styles.primary} onClick={()=>void download()} disabled={!canDownload||pending}><Download size={17} aria-hidden="true"/>{pending?'Verificando descarga…':'Descargar kit ejecutable'}</button><button type="button" onClick={()=>saveBlob(new Blob([template],{type:'text/csv;charset=utf-8'}),'recepciones.csv')}><FileSpreadsheet size={17} aria-hidden="true"/>Plantilla de recepciones CSV</button>{canDownload&&<Link prefetch={false} href={"/api-keys?"+new URLSearchParams({profile:"erp-csv",...(company?{tenant:tenantArg}:{})})}><KeyRound size={16} aria-hidden="true"/>Credenciales y webhooks</Link>}<span className={styles.meta}>{Math.ceil(manifest.bytes/1024)} KiB · {manifest.runtime} · SDK {manifest.sdkVersion}</span></div>
  {!canDownload&&<p className={styles.notice}>La descarga requiere una sesión no demo con permiso para consultar credenciales. No se modificaron tus permisos.</p>}
  <p role="status" className={styles.status}>{status}</p>
  <div className={styles.layout}><nav className={styles.navigation} aria-label="Tarea de integración">{([['local','Probar sin credenciales',Terminal],['read','Comprobar conexión',KeyRound],['receipts','Importar recepciones',FileSpreadsheet],['webhook','Recibir eventos firmados',Webhook]] as const).map(([id,label,Icon])=><button key={id} type="button" aria-pressed={mode===id} onClick={()=>{setMode(id);setCopied(false);}}><Icon size={18} aria-hidden="true"/><span>{label}</span></button>)}</nav>
   <div className={styles.work}>
    <div className={styles.workTitle}><h3>{mode==='local'?'Primero: ejecutalo en una carpeta nueva':mode==='read'?'Una consulta real, sin modificar el lote':mode==='receipts'?'CSV → plan local → envío confirmado':'Firma válida → registro local → acuse'}</h3><button type="button" onClick={()=>void copy()} aria-label="Copiar comandos">{copied?<Check size={16} aria-hidden="true"/>:<Copy size={16} aria-hidden="true"/>}{copied?'Copiado':'Copiar'}</button></div>
    {mode!=='local'&&<div className={styles.fields}><label>Empresa del cliente<input value={company} placeholder="mi-empresa" disabled={Boolean(tenant)} maxLength={128} onChange={e=>{setCompany(e.target.value);setCopied(false);}}/></label>{mode==='read'&&<label>Lote registrado<input value={bid} placeholder="MI-LOTE" maxLength={128} onChange={e=>{setBid(e.target.value);setCopied(false);}}/></label>}</div>}
    <pre className={styles.code}><code>{commands[mode]}</code></pre>
    {mode==='local'?<p className={styles.note}>Extraé el archivo y ejecutá estos comandos dentro de la carpeta del kit. La prueba usa datos sintéticos y almacenamiento local; no necesita acceso al repositorio ni llama a Neon.</p>:mode==='read'?<p className={styles.note}>Configurá <code>NEXID_API_KEY</code> sólo en el entorno del backend. Permiso mínimo: <strong>sdk:products</strong>. La comprobación valida empresa y lote; no acredita otros permisos.</p>:mode==='receipts'?<><p className={styles.note}><strong>Plan y estado no usan la red.</strong> El envío requiere <code>sdk:events</code> y confirmación explícita del tenant. Al reejecutar conserva la misma identidad comercial, consulta resultados inciertos y omite los ya confirmados.</p><p className={styles.notice}>Registra una recepción declarada por el ERP/WMS. No activa etiquetas, no cambia la custodia logística y no verifica físicamente el precinto.</p></>:<><p className={styles.note}>El receptor incluido verifica HMAC v2, tenant y event ID. Los duplicados no vuelven a proyectarse en su base local. Configurá el secreto y key ID en el servidor, no aquí.</p><p className={styles.notice}>Escucha en localhost. Para entregas reales necesita el endpoint HTTPS del cliente; el kit no abre túneles ni registra webhooks automáticamente.</p></>}
   </div>
  </div>
  <footer className={styles.footer}><span>Sin publicación pública en npm · sin servicios nuevos · 500 filas por archivo</span><details><summary>Integridad del artefacto</summary><code>{manifest.sha256}</code><p>SHA-256 comprueba el archivo descargado; no es una firma digital.</p></details></footer>
 </section>;
}
