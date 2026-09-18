"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./operations-workspace.module.css";
export function BatchRollPicker({rows,ready,canRegister}:{rows:Array<{bid:string;label:string}>;ready:boolean;canRegister:boolean}) {
  const [selected,setSelected]=useState(""); const router=useRouter();
  return <section className={`${styles.workspace} ${styles.hero}`} data-testid="batch-roll-picker">
    <div><p className={styles.eyebrow}>Autogestión de etiquetas</p><h2 className={styles.title}>Configurar un rollo, paso a paso.</h2><p className={styles.description}>Elegí un lote provisionado para editar su ficha común, recibir las unidades del proveedor y continuar con la verificación física.</p></div>
    <form onSubmit={event=>{event.preventDefault();if(rows.some(row=>row.bid===selected))router.push(`/batches/${encodeURIComponent(selected)}`);}} className={styles.field}>
      <label htmlFor="roll-selection">Rollo / lote de tu empresa</label><select id="roll-selection" value={selected} onChange={event=>setSelected(event.target.value)} disabled={!ready||!rows.length}><option value="">{ready ? "Seleccionar lote" : "Fuente no disponible"}</option>{rows.map(row=><option key={row.bid} value={row.bid}>{row.label}</option>)}</select>
      <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={!selected||!ready}>Abrir configuración del rollo</button>
      {canRegister&&<Link prefetch={false} href="/batches/supplier#supplier-order-console" className={styles.link}>Registrar pedido industrial</Link>}
    </form>
  </section>;
}
