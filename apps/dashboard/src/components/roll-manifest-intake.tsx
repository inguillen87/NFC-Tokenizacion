"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileCheck2 } from "lucide-react";
import { inspectRollManifest, rollReceipt, rollValidationCurrent, ROLL_MANIFEST_MAX_BYTES } from "../lib/roll-manifest-policy";
import styles from "./operations-workspace.module.css";

export function RollManifestIntake({ bid, canImport, alreadyRegistered }: { bid: string; canImport: boolean; alreadyRegistered: boolean }) {
  const router = useRouter();
  const [csv, setCsv] = useState(""); const [filename, setFilename] = useState("");
  const [pending, setPending] = useState(false); const pendingRef = useRef(false);
  const [confirmed, setConfirmed] = useState(false); const [feedback, setFeedback] = useState("");
  const [uncertain, setUncertain] = useState(false); const [imported, setImported] = useState(false);
  const [validation, setValidation] = useState<{csv:string; at:number; rows:number} | null>(null);
  const policyError = inspectRollManifest(csv);
  const blocked = !canImport || alreadyRegistered || imported || uncertain;
  async function selectFile(file?: File) {
    setCsv(""); setFilename(""); setValidation(null); setConfirmed(false); setFeedback("");
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name) || file.size > ROLL_MANIFEST_MAX_BYTES) { setFeedback("Usá un CSV/TXT de hasta 1 MiB; no subas paquetes de claves ni archivos cifrados."); return; }
    const content = await file.text(); const error = inspectRollManifest(content);
    if (error) { setFeedback(error); return; }
    setCsv(content); setFilename(file.name);
  }
  async function submit(dryRun: boolean) {
    if (blocked || pendingRef.current || policyError) return;
    if (!dryRun && (!confirmed || !validation || !rollValidationCurrent(csv,validation.csv,validation.at,Date.now()))) { setValidation(null); setConfirmed(false); setFeedback("Validá nuevamente este archivo antes de importarlo."); return; }
    pendingRef.current = true; setPending(true); setFeedback("");
    try {
      const response = await fetch(`/api/admin/batches/${encodeURIComponent(bid)}/import-manifest`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({csv,dryRun,activateImported:false}), signal:AbortSignal.timeout(45000) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (!dryRun && response.status>=500) setUncertain(true);
        const reason = payload && typeof payload === "object" && "reason" in payload ? String(payload.reason).slice(0,140) : `HTTP ${response.status}`;
        setValidation(null); setFeedback(`El servidor no aprobó la operación (${reason}). Revisá el estado del lote; no se reintenta automáticamente.`); return;
      }
      const receipt = rollReceipt(payload,bid,dryRun);
      if (!receipt) { setValidation(null); if (!dryRun) setUncertain(true); setFeedback("No llegó un comprobante válido vinculado a este lote. Consultá el estado antes de repetir una importación."); return; }
      if (dryRun) { setValidation({csv,at:Date.now(),rows:receipt.rows}); setFeedback(`Validación confirmada: ${receipt.rows} filas, ${receipt.inserted} unidades nuevas. Aún no se importó ni activó el rollo.`); }
      else { setImported(true); setCsv(""); setValidation(null); setConfirmed(false); setFeedback(`Importación confirmada: ${receipt.rows} filas procesadas. Las etiquetas no fueron activadas. Continuá con el protocolo de calidad.`); router.refresh(); }
    } catch {
      if (!dryRun) setUncertain(true);
      setValidation(null); setFeedback(dryRun ? "No se pudo confirmar la validación. El archivo sigue disponible para intentar de nuevo." : "Resultado incierto: la conexión se interrumpió. No reenvíes el archivo; consultá el estado del lote primero.");
    } finally { pendingRef.current=false; setPending(false); }
  }
  return <details className={`${styles.intake} ${styles.workspace}`} id="roll-manifest" data-testid="roll-manifest-intake">
    <summary>02 · Recibir y validar el archivo del rollo</summary>
    <p className={styles.note}>Una ficha de producto para el lote; un manifiesto con las unidades. El servidor revisa pertenencia, duplicados y cantidad. Importar nunca activa etiquetas ni salta el control de calidad.</p>
    {blocked ? <p className={styles.feedback}>{uncertain ? "Importación con resultado incierto: consultá el estado antes de cualquier nueva operación." : imported || alreadyRegistered ? "Este lote ya tiene unidades registradas. Se conserva la evidencia; las correcciones se realizan con un lote correctivo o desde el circuito autorizado." : "Tu rol puede consultar el lote, pero no tiene el permiso manifest.import. Solicitá ese permiso al administrador de tu empresa."}</p> : <>
      <label className={styles.field}>Manifiesto de unidades · CSV o TXT<input type="file" accept=".csv,.txt" disabled={pending} onChange={e => void selectFile(e.target.files?.[0])} /></label>
      {filename && <p className={styles.note}>{filename} · {new TextEncoder().encode(csv).byteLength.toLocaleString("es-AR")} bytes · contenido solo en memoria de esta pestaña.</p>}
      <button type="button" className={styles.button} disabled={pending || Boolean(policyError)} onClick={() => void submit(true)}><FileCheck2 size={16}/>{pending ? "Procesando…" : "Validar sin importar"}</button>
      {validation && <><label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={pending} onChange={e => setConfirmed(e.target.checked)} />Confirmo que las {validation.rows} filas corresponden al rollo y al BID {bid}. Se importarán sin activar etiquetas.</label><button type="button" className={`${styles.button} ${styles.primary}`} disabled={pending || !confirmed} onClick={() => void submit(false)}><UploadCloud size={16}/>Importar archivo validado</button></>}
    </>}
    {feedback && <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p>}
    <p className={styles.note}>No se guardan archivos en el navegador, no se generan claves y no se permiten excepciones de cantidad desde este asistente.</p>
    <button type="button" className={styles.button} disabled={pending} onClick={() => router.refresh()}>Consultar estado actualizado</button>
  </details>;
}
