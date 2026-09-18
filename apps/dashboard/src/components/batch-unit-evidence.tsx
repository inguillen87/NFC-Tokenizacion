"use client";
import { useMemo, useState } from "react";
import type { BatchDossier } from "../lib/batch-dossier-model";
import { dossierDate, dossierNumber } from "./batch-dossier-shell";
import styles from "./batch-dossier.module.css";
export function BatchUnitEvidence({model}:{model:BatchDossier}) {
  const [query,setQuery]=useState("");
  const rows=useMemo(()=>model.units.filter(row=>[row.uidMasked,row.serial,row.lot,row.pallet,row.container,row.caseRef].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[model.units,query]);
  return <div className={styles.stack}>
    <section className={styles.card} data-testid="batch-unit-evidence"><h2>Unidades y agrupaciones declaradas</h2><p>Hasta 12 unidades del resumen, no el inventario completo. Las referencias logísticas vienen del manifiesto; no demuestran ubicación ni custodia.</p>
      <div className={styles.toolbar}><label className={`${styles.field} ${styles.search}`}>Buscar en la muestra de unidades<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="UID enmascarado, serial, caja, pallet o contenedor" maxLength={120}/></label><span className={styles.badge}>{rows.length} de {model.units.length} en esta muestra</span></div>
      <div className={styles.tableWrap}><table className={styles.table}><caption>Identificadores enmascarados · no incluye secretos del chip</caption><thead><tr><th scope="col">Unidad / estado</th><th scope="col">Referencia logística</th><th scope="col">Identidad y metadata</th><th scope="col">Actualización declarada</th></tr></thead><tbody>
        {rows.map((row,index)=><tr key={`${row.uidMasked}-${index}`}><td><strong>{row.uidMasked}</strong><small>{row.status||"Estado no informado"}</small><small>Serial: {row.serial||"No informado"}</small></td><td>{row.pallet?<>Pallet: {row.pallet}<br/></>:null}{row.container?<>Contenedor: {row.container}<br/></>:null}{row.caseRef?<>Caja: {row.caseRef}<br/></>:null}{!row.pallet&&!row.container&&!row.caseRef?"Sin referencia en la muestra":null}</td><td>{row.override===true?"Excepción de producto declarada":row.override===false?"Usa la ficha del lote":"Origen de identidad no informado"}<small>{row.sensorFields} campos IoT declarados; no equivale a sensores transmitiendo</small></td><td>{dossierDate(row.updatedAt)}</td></tr>)}
      </tbody></table></div>
      {!rows.length&&<p className={styles.notice}>{model.units.length?"No hay coincidencias en esta muestra.":"El resumen no incluyó muestras de unidades. No se infiere que el inventario sea cero."}</p>}
    </section>
    <section className={styles.card} data-testid="batch-manifest-history"><h2>Recepciones registradas</h2><p>Últimos cinco registros de importación informados por el servidor. No representan todos los cambios del lote ni su historial editorial.</p>
      {model.manifests.length?<ol className={styles.timeline}>{model.manifests.map((item,index)=><li key={`${item.createdAt}-${index}`}><time dateTime={item.createdAt||undefined}>{dossierDate(item.createdAt)}</time><h3>{item.type||"Manifiesto"} · {item.status||"Estado no informado"}</h3><p>{dossierNumber(item.rows)} filas · {dossierNumber(item.inserted)} insertadas · {dossierNumber(item.duplicates)} duplicadas · {dossierNumber(item.rejected)} rechazadas</p></li>)}</ol>:<p className={styles.notice}>Sin registros de importación en la respuesta consultada.</p>}
    </section>
  </div>;
}
