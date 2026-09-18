"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Expand, Layers, MapPin, Minus, Plus, RotateCcw, ArrowUpRight } from "lucide-react";
import type { PhysicalTapsResult } from "../lib/physical-taps-contract";
import { physicalMapModel, sealLabel } from "../lib/physical-map-workspace";
import type { BaseMapLayer } from "./realtime-maplibre-map";
import styles from "./operations-workspace.module.css";
const MapCanvas = dynamic(() => import("./realtime-maplibre-map").then(m => m.RealtimeMapLibreMap), { ssr: false, loading: () => <p role="status" className={styles.note}>Preparando cartografía interactiva…</p> });

export function PhysicalMapWorkspace({ result, tenantSlug = "", dedicated = false, country = "" }: { result: PhysicalTapsResult; tenantSlug?: string; dedicated?: boolean; country?: string }) {
  const [query, setQuery] = useState("");
  const [seal, setSeal] = useState("all");
  const [view, setView] = useState<"heat" | "points" | "nearby">("heat");
  const [base, setBase] = useState<BaseMapLayer>("light");
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const model = useMemo(() => physicalMapModel(result, tenantSlug, query, seal, country), [result, tenantSlug, query, seal, country]);
  const scopeQuery = tenantSlug ? `?tenant=${encodeURIComponent(tenantSlug)}` : "";
  useEffect(() => { const update = () => { setExpanded(document.fullscreenElement === panel.current); window.dispatchEvent(new Event("resize")); }; document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  async function fullscreen() {
    try { if (document.fullscreenElement === panel.current) await document.exitFullscreen(); else await panel.current?.requestFullscreen(); setNotice(""); }
    catch { setNotice("Tu navegador no permite pantalla completa. El mapa sigue disponible en esta vista ampliada."); }
  }
  return <section id="mapa-profesional" className={styles.workspace} data-testid="physical-map-workspace">
    <div className={styles.hero}>
      <div><p className={styles.eyebrow}>Inteligencia territorial · lectura operativa</p><h2 className={styles.title}>Tu producto, en el mapa.</h2><p className={styles.description}>Ubicaciones reportadas, lecturas y evidencia del lote. La cartografía permanece disponible si la fuente de datos no responde.</p></div>
      <div className={styles.links}><Link prefetch={false} className={styles.link} href={`/${scopeQuery}`}>CRM y mapa en vivo</Link>{!dedicated && <Link prefetch={false} className={styles.link} href={`/analytics/map${scopeQuery}`}>Abrir centro geográfico <ArrowUpRight size={15} /></Link>}</div>
    </div>
    <div className={styles.toolbar}>
      <label className={`${styles.field} ${styles.search}`}>Buscar en la muestra<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Producto, lote, ciudad o UID enmascarado" maxLength={120} /></label>
      <label className={styles.field}>Precinto reportado<select value={seal} onChange={e => setSeal(e.target.value)}><option value="all">Todos</option><option value="closed">Cerrado</option><option value="opened">Abierto</option><option value="other">Sin conclusión</option></select></label>
      <label className={styles.field}>Cartografía<select value={base} onChange={e => setBase(e.target.value as BaseMapLayer)}><option value="light">Calles</option><option value="dark">Sala de control</option><option value="satellite">Satélite</option><option value="terrain">Relieve</option></select></label>
    </div>
    <div className={styles.metrics} aria-label="Resumen de la muestra geográfica">{[[model.rows.length,"Lecturas"],[model.events.length,"Con ubicación"],[model.withoutCoordinates,"Sin ubicación"],[model.hotspots.length,"Zonas"]].map(([value,label]) => <div key={label} className={styles.metric}><b>{model.confirmed ? value : "—"}</b><span>{label}</span></div>)}</div>
    <div className={styles.mapGrid}>
      <div ref={panel} className={`${styles.mapPanel} ${expanded ? styles.expanded : ""}`}>
        <div className={styles.mapControls}>
          <div className={styles.links} role="group" aria-label="Capas de lectura">{([["heat","Densidad"],["points","Eventos"],["nearby","Proximidad"]] as const).map(([key,label]) => <button type="button" key={key} className={styles.button} aria-pressed={view===key} onClick={() => setView(key)}><Layers size={14} />{label}</button>)}</div>
          <div className={styles.links} role="group" aria-label="Controles geográficos">
            <button type="button" className={styles.button} aria-label="Acercar mapa" onClick={() => setZoom(z => Math.min(1.22,z+.08))}><Plus size={16}/></button>
            <button type="button" className={styles.button} aria-label="Alejar mapa" onClick={() => setZoom(z => Math.max(.9,z-.08))}><Minus size={16}/></button>
            <button type="button" className={styles.button} aria-label="Restablecer mapa" onClick={() => {setZoom(1);setView("heat");setQuery("");setSeal("all");}}><RotateCcw size={16}/></button>
            <button type="button" className={styles.button} aria-label={expanded ? "Salir de pantalla completa" : "Mapa en pantalla completa"} onClick={() => void fullscreen()}><Expand size={16}/></button>
          </div>
        </div>
        <div className={styles.canvas}><MapCanvas events={model.events} hotspots={model.hotspots} mapView={view} baseMap={base} zoom={zoom} mode={tenantSlug ? "tenant" : "global"} dataState={model.confirmed ? "real" : "unavailable"} dataStateDetail="La base geográfica está disponible; las lecturas requieren sesión, permisos y una respuesta válida de la fuente." /></div>
      </div>
      <aside className={styles.side}><h3><MapPin size={16} style={{display:"inline",marginRight:8}}/> Zonas de lectura</h3><p className={styles.note}>Volumen dentro de la muestra, no personas únicas ni ventas.</p>{model.hotspots.length ? model.hotspots.map(point => <div className={styles.row} key={point.key}><b>{point.city}, {point.country}</b><span>{point.taps} lecturas · {point.valid} mensajes validados</span></div>) : <p className={styles.note}>{model.confirmed ? "No hay coordenadas utilizables para este filtro. Las lecturas sin ubicación siguen en la tabla." : "Fuente sin confirmar. No se sustituyen datos faltantes por una demo."}</p>}</aside>
    </div>
    {notice && <p role="status" className={styles.note}>{notice}</p>}
    <p className={styles.note}>Muestra de hasta {model.limit} lecturas recientes. Última consulta: {new Date(result.checkedAt).toLocaleString("es-AR",{timeZone:"UTC"})} UTC. Filtros de producto y precinto se aplican a esta muestra; no ejecutan nuevas consultas. La ubicación por red/IP es aproximada. Un precinto abierto no equivale por sí solo a producto falsificado.</p>
    <div className={styles.tableWrap}><table className={styles.table}><caption className={styles.note}>Lecturas y evidencia · incluye registros sin ubicación</caption><thead><tr><th>Producto / lote</th><th>Momento UTC</th><th>Ubicación declarada</th><th>Precinto</th><th>Mensaje / evidencia</th></tr></thead><tbody>{model.rows.map(row => <tr key={row.eventId}><td>{row.productName || row.bid}<br/><small>{row.bid} · {row.uidMasked}</small></td><td>{new Date(row.occurredAt.utc).toLocaleString("es-AR",{timeZone:"UTC"})}</td><td>{row.location.city || "Sin ciudad"} {row.location.country}<br/><small>{row.location.source || "Sin coordenadas"}</small></td><td>{sealLabel(row)}</td><td>{row.messageValid && row.evidence.messageAuthentication === "validated" ? "Validado" : "No validado"}<details><summary>Ver evidencia</summary><p>Evento: {row.eventId}<br/>Contador: {row.readCounter ?? "Sin dato"}<br/>Fuente: registro persistido<br/>Precisión: {row.location.accuracyM === null ? "No informada" : `± ${row.location.accuracyM} m`}</p></details></td></tr>)}</tbody></table>{!model.rows.length && <p className={styles.note} style={{padding:"0 16px"}}>{model.confirmed ? "Sin lecturas para este filtro." : "Lecturas no disponibles para el alcance actual."}</p>}</div>
  </section>;
}
