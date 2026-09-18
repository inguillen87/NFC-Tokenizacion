"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./operations-workspace.module.css";
const fields = { product_name:"Nombre del producto", public_lot_label:"Lote comercial visible", sku:"SKU / referencia", winery:"Marca o fabricante", region:"Región de origen declarada", image_url:"Imagen del producto (HTTPS)" } as const;
type Field = keyof typeof fields;
export function RollProductIdentity({ bid, initial }: { bid:string; initial:Partial<Record<Field,string>> }) {
  const normalized = Object.fromEntries(Object.keys(fields).map(key=>[key,initial[key as Field] || ""])) as Record<Field,string>;
  const [form,setForm] = useState(normalized); const [baseline,setBaseline] = useState(normalized);
  const [confirmed,setConfirmed] = useState(false); const [pending,setPending] = useState(false); const busy = useRef(false);
  const [message,setMessage] = useState(""); const router=useRouter();
  const changed=(Object.keys(fields) as Field[]).filter(key=>form[key]!==baseline[key]);
  async function save(event:React.FormEvent) {
    event.preventDefault(); if (busy.current || !confirmed || !changed.length) return;
    if (!form.product_name.trim()) {setMessage("Indicá el nombre del producto.");return;}
    if(form.image_url) {try {if(new URL(form.image_url).protocol!=="https:")throw new Error();}catch {setMessage("La imagen debe usar una URL HTTPS válida.");return;}}
    busy.current=true;setPending(true);setMessage("");
    try {
      const response=await fetch(`/api/admin/batches/${encodeURIComponent(bid)}/product-config`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(changed.map(key=>[key,form[key].trim()]))),signal:AbortSignal.timeout(30000)});
      const result=await response.json().catch(()=>null);
      if(!response.ok||result?.ok!==true||result.bid!==bid)throw new Error("No se confirmó el guardado para este lote. Revisá tus permisos y volvé a consultar su estado.");
      setBaseline({...form});setConfirmed(false);setMessage("Ficha guardada para este lote. No se modificaron las claves, el estado de las etiquetas ni los campos específicos de otro rubro.");router.refresh();
    }catch(error){setMessage(error instanceof Error&&error.name!=="TimeoutError" ? error.message : "La conexión se interrumpió. Consultá el estado antes de repetir; no se reintenta automáticamente.");}
    finally{busy.current=false;setPending(false);}
  }
  return <section id="roll-product" className={`${styles.workspace} ${styles.intake}`} data-testid="roll-product-identity">
    <p className={styles.eyebrow}>01 · Identidad del producto · común a todas las unidades</p><h2 className={styles.title}>Una ficha. Todo el rollo.</h2><p className={styles.description}>Campos comunes para cualquier empresa. Las especificaciones del rubro y la seguridad del chip se administran por separado.</p>
    <form onSubmit={event=>void save(event)}>
      <div className={styles.steps} style={{gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))"}}>{(Object.entries(fields) as [Field,string][]).map(([key,label])=><label className={styles.field} key={key}>{label}<input name={key} value={form[key]} disabled={pending} required={key==="product_name"} type={key==="image_url"?"url":"text"} maxLength={key==="image_url"?1500:key==="public_lot_label"?160:180} onChange={event=>{setForm({...form,[key]:event.target.value});setConfirmed(false);setMessage("");}} /></label>)}</div>
      <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={pending||!changed.length} onChange={event=>setConfirmed(event.target.checked)}/>Confirmo que estos cambios corresponden al producto del lote {bid} y se aplicarán a su ficha compartida.</label>
      <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={pending||!confirmed||!changed.length}>{pending?"Guardando…":"Guardar ficha del rollo"}</button>
      {message&&<p className={styles.feedback} role="status">{message}</p>}
    </form>
  </section>;
}
