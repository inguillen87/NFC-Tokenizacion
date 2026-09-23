"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileCheck2 } from "lucide-react";
import { inspectRollManifest, rollValidationCurrent, ROLL_MANIFEST_MAX_BYTES } from "../lib/roll-manifest-policy";
import { rollManifestCall, RollManifestError, rollManifestErrorCopy } from "../lib/roll-manifest-client";
import styles from "./operations-workspace.module.css";
import intake from "./roll-manifest-intake.module.css";

type Props = { bid: string; canImport: boolean; alreadyRegistered: boolean; scopeKey?: string };
type Validation = { csv: string; at: number; rows: number; inserted: number };
export function RollManifestIntake(props: Props) {
  // Remount, not just an effect reset: old reads cannot revive A after A -> B -> A.
  return <ManifestIntake key={JSON.stringify([props.bid,props.canImport,props.alreadyRegistered,props.scopeKey])} {...props}/>;
}
function ManifestIntake({ bid, canImport, alreadyRegistered }: Props) {
  const router = useRouter();
  const [csv,setCsv] = useState("");
  const [file,setFile] = useState<{name:string;bytes:number;digest:string}|null>(null);
  const [fileReading,setFileReading] = useState(false), [pending,setPending] = useState(false);
  const [confirmed,setConfirmed] = useState(false), [feedback,setFeedback] = useState("");
  const [uncertain,setUncertain] = useState(false), [imported,setImported] = useState(false), [accessLost,setAccessLost] = useState(false);
  const [validation,setValidation] = useState<Validation|null>(null);
  const pendingRef = useRef(false), alive = useRef(true), fileSequence = useRef(0), requestSequence = useRef(0);
  const controller = useRef<AbortController|null>(null), currentCsv = useRef(""), unresolved = useRef(false);
  const policyError = inspectRollManifest(csv);
  const blocked = !canImport || alreadyRegistered || imported || uncertain || accessLost;
  useEffect(() => {
    alive.current = true;
    const warn = (event:BeforeUnloadEvent) => { if (currentCsv.current || pendingRef.current || unresolved.current) { event.preventDefault(); event.returnValue=""; } };
    window.addEventListener("beforeunload",warn);
    return () => { alive.current=false;fileSequence.current++;requestSequence.current++;controller.current?.abort();window.removeEventListener("beforeunload",warn); };
  },[]);
  async function selectFile(next?:File) {
    if (blocked || pendingRef.current) return;
    const sequence=++fileSequence.current;
    currentCsv.current="";setCsv("");setFile(null);setValidation(null);setConfirmed(false);setFeedback("");setFileReading(false);
    if (!next) return;
    if (!/\.(csv|txt)$/i.test(next.name) || next.size>ROLL_MANIFEST_MAX_BYTES) {setFeedback("Usá un CSV/TXT de hasta 1 MiB; no subas paquetes de claves ni archivos cifrados.");return;}
    setFileReading(true);
    try {
      const content=await next.text();
      if (!alive.current || sequence!==fileSequence.current) return;
      const error=inspectRollManifest(content);
      if (error) {setFeedback(error);return;}
      const bytes=new TextEncoder().encode(content);
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),n=>n.toString(16).padStart(2,"0")).join("");
      if (!alive.current || sequence!==fileSequence.current) return;
      currentCsv.current=content;setCsv(content);setFile({name:next.name,bytes:bytes.byteLength,digest});
    } catch {if(alive.current&&sequence===fileSequence.current)setFeedback("No pudimos leer el archivo. Volvé a seleccionarlo; no se envió ningún contenido.");}
    finally {if(alive.current&&sequence===fileSequence.current)setFileReading(false);}
  }
  async function submit(dryRun:boolean) {
    if (blocked || pendingRef.current || fileReading || policyError || !file || currentCsv.current!==csv) return;
    const snapshot=csv, previous=validation;
    if (!dryRun && (!confirmed || !previous || !rollValidationCurrent(snapshot,previous.csv,previous.at,Date.now()))) {
      setValidation(null);setConfirmed(false);setFeedback("Validá nuevamente este archivo antes de importarlo.");return;
    }
    pendingRef.current=true;setPending(true);setFeedback("");setConfirmed(false);setValidation(null);
    const sequence=++requestSequence.current, aborter=new AbortController();controller.current=aborter;
    try {
      const receipt=await rollManifestCall({bid,csv:snapshot,dryRun,activateImported:false,signal:aborter.signal});
      if (!alive.current || sequence!==requestSequence.current) return;
      if (!dryRun && receipt.rows!==previous?.rows) throw new RollManifestError("invalid_receipt",200,true);
      if (dryRun) {
        setValidation({csv:snapshot,at:Date.now(),rows:receipt.rows,inserted:receipt.inserted});
        setFeedback(`Validación confirmada: ${receipt.rows} filas, ${receipt.inserted} unidades nuevas previstas. Aún no se importó ni activó el rollo.`);
      } else {
        setImported(true);currentCsv.current="";setCsv("");
        setFeedback(`Importación confirmada: ${receipt.rows} filas procesadas, ${receipt.inserted} unidades nuevas. Las etiquetas no fueron activadas. Continuá con el protocolo de calidad.`);
        router.refresh();
      }
    } catch (error) {
      if (!alive.current || sequence!==requestSequence.current) return;
      const issue=error instanceof RollManifestError?error:new RollManifestError("unavailable",0,!dryRun);
      if (issue.uncertain) {unresolved.current=true;setUncertain(true);}
      if ([401,403].includes(issue.status)) {setAccessLost(true);currentCsv.current="";setCsv("");setFile(null);}
      setFeedback(rollManifestErrorCopy(issue));
    } finally {if(alive.current&&sequence===requestSequence.current){pendingRef.current=false;setPending(false);}if(controller.current===aborter)controller.current=null;}
  }
  const step=imported?3:validation?2:file?1:0;
  return <details className={`${styles.intake} ${styles.workspace} ${intake.root}`} id="roll-manifest" data-testid="roll-manifest-intake">
    <summary>02 · Recibir y validar el archivo del rollo</summary>
    <p className={styles.note}>Un manifiesto por rollo y BID. Revisá el archivo del proveedor, consultá la validación del servidor y confirmá antes de importar. Importar no activa etiquetas ni aprueba calidad.</p>
    <ol className={intake.steps} aria-label="Pasos de recepción">{["Seleccionar archivo","Validar con NexID","Confirmar importación","Continuar con calidad"].map((label,index)=><li key={label} aria-current={step===index?"step":undefined}><span aria-hidden="true">{index+1}</span><strong>{label}</strong></li>)}</ol>
    {blocked ? <p className={styles.feedback}>{uncertain ? "Importación con resultado incierto: consultá el estado antes de cualquier nueva operación." : accessLost ? "Acceso no disponible. Se requiere una sesión autorizada para continuar." : imported || alreadyRegistered ? "Este lote ya tiene unidades registradas. Se conserva la evidencia; las correcciones requieren el circuito autorizado." : "Tu rol puede consultar el lote, pero no tiene el permiso manifest.import. No se consultaron ni importaron unidades."}</p> : <>
      <label className={styles.field}><span>Manifiesto de unidades &middot; CSV o TXT</span><span className={intake.picker}><UploadCloud size={16} aria-hidden="true"/><span>{file?"Cambiar archivo":"Seleccionar archivo"}</span><input data-testid="roll-manifest-file" type="file" accept=".csv,.txt" disabled={pending} onChange={event=>{const next=event.target.files?.[0];event.target.value="";void selectFile(next);}}/></span></label>
      {fileReading?<p role="status">Leyendo y calculando la huella local del archivo…</p>:null}
      {file?<section className={intake.file} aria-label="Archivo seleccionado"><div><strong>{file.name}</strong><p>{file.bytes.toLocaleString("es-AR")} bytes · BID <b>{bid}</b></p></div><details><summary>Identificar este archivo</summary><p className={styles.note}>Huella SHA-256 del texto que se enviará. Identifica el contenido seleccionado; no es una firma del proveedor ni una validación NFC.</p><code data-testid="roll-file-fingerprint">{file.digest}</code></details></section>:null}
      <div className={intake.actions}><button type="button" className={styles.button} disabled={pending||fileReading||Boolean(policyError)} onClick={()=>void submit(true)}><FileCheck2 size={16} aria-hidden="true"/>{pending?"Procesando…":"Validar sin importar"}</button></div>
      {validation?<section className={intake.review} aria-label="Revisión antes de importar"><h3>Revisá el resultado del servidor</h3><dl><div><dt>Filas validadas</dt><dd>{validation.rows}</dd></div><div><dt>Unidades nuevas previstas</dt><dd>{validation.inserted}</dd></div><div><dt>Activación de etiquetas</dt><dd>No solicitada</dd></div></dl><p className={styles.note}>Válido durante cinco minutos para este archivo y este lote. La importación vuelve a comprobar permisos, pertenencia y cantidad en el servidor.</p><label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={pending} onChange={event=>setConfirmed(event.target.checked)}/>Confirmo que las {validation.rows} filas corresponden al rollo y al BID {bid}. Se importarán sin activar etiquetas.</label><button type="button" className={`${styles.button} ${styles.primary}`} disabled={pending||!confirmed} onClick={()=>void submit(false)}><UploadCloud size={16} aria-hidden="true"/>Importar archivo validado</button></section>:null}
    </>}
    {feedback?<p className={styles.feedback} role="status" aria-live="polite">{feedback}</p>:null}
    <details className={intake.help}><summary>Qué archivo pedir al proveedor</summary><p>Usá el manifiesto de unidades del rollo, exportado como CSV/TXT UTF-8 y de hasta 1 MiB. El servidor admite los formatos del importador existente y verifica sus identificadores.</p><p>No incluyas claves, contraseñas ni paquetes cifrados. La cantidad debe coincidir con la prevista: este asistente no autoriza excepciones.</p></details>
    <p className={styles.note}>El archivo se conserva solo en memoria de esta pestaña. Seleccionarlo no lo sube; «Validar sin importar» envía el contenido a NexID para revisarlo. No certifica al proveedor, la fabricación ni la calidad física.</p>
    <button type="button" className={styles.button} disabled={pending} onClick={()=>router.refresh()}>Consultar estado actualizado</button>
  </details>;
}