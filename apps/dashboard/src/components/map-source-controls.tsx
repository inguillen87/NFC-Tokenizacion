"use client";
import type { MapSourceFilter } from "../lib/map-location-evidence";
import styles from "./control-room.module.css";
export function MapSourceControls({value,onChange,counts}:{value:MapSourceFilter;onChange:(value:MapSourceFilter)=>void;counts:{phone:number;network:number;other:number;none:number}}) {
  return <div className={styles.sources} data-testid="map-source-controls">
    <div className={styles.sourceButtons} role="group" aria-label="Procedencia de la ubicación">
      {([["all","Todas",counts.phone+counts.network+counts.other],["phone","Teléfono",counts.phone],["network","Red/IP",counts.network],["other","Otra fuente",counts.other]] as const).map(([key,label,count])=>
        <button type="button" key={key} aria-pressed={value===key} data-source-filter={key} onClick={()=>onChange(key)}>{label}<span>{count}</span></button>)}
    </div>
    <details className={styles.evidenceHelp}><summary>{counts.phone===0 && counts.network>0 ? "Sin ubicación del teléfono · ¿por qué?" : "Qué significa esta ubicación"}</summary>
      <p>Teléfono: zona aproximada compartida después del TAP y con permiso. Red/IP: estimación de la conexión; puede estar en otra ciudad. La autenticación de la etiqueta no verifica la ubicación.</p>
      <p>En un TAP nuevo, la persona puede elegir «Compartir ubicación» en el pasaporte y aceptar el permiso del navegador. Sin permiso, el producto sigue disponible. {counts.none} registros de esta muestra no tienen coordenadas utilizables.</p>
      <p>Un NFC pasivo no envía GPS continuamente. Para pallets o contenedores mostramos última evidencia recibida, no una trayectoria ni posición en movimiento.</p>
    </details>
  </div>;
}
